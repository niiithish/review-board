import "server-only"

import { readdir, stat } from "node:fs/promises"
import path from "node:path"

import type { Item, Project } from "@/lib/types"
import { ROOT } from "@/lib/server/paths"

const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"])
const VIDEO = new Set([".mp4", ".mov", ".webm", ".m4v"])
/** `all/` holds make.py's synced copies; the rest is never media to review. */
const SKIP = new Set(["node_modules", "__pycache__", "all"])
const MEDIA_DIRS = [
  "characters",
  "environments",
  "props",
  "assets",
  "scenes",
  "stills",
  "clips",
  "final",
]
const MAX_FILES = 5000
/** Generated output lives here; anywhere else a file shows only if it has a prompt (made in this project). */
const OUTPUT_DIRS = new Set(["scenes", "stills", "clips"])

type Found = { rel: string; size: number; mtime: number }

async function walk(dir: string, root: string, media: Found[], prompts: Set<string>) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || media.length >= MAX_FILES) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) await walk(full, root, media, prompts)
      continue
    }
    if (!entry.isFile()) continue
    const rel = path.relative(root, full).split(path.sep).join("/")
    const ext = path.extname(entry.name).toLowerCase()
    if (ext === ".md" && path.basename(dir) === "prompts") {
      prompts.add(rel)
    } else if (IMAGE.has(ext) || VIDEO.has(ext)) {
      const info = await stat(full)
      media.push({ rel, size: info.size, mtime: info.mtimeMs })
    }
  }
}

/** Stems to try when looking for a media file's prompt. */
function promptStems(stem: string) {
  const plain = stem.replace(/^rejected-/, "")
  const noSuffix = plain.replace(/-(1080p|720p|4k|final|upscaled?)$/i, "")
  return [...new Set([stem, plain, noSuffix])]
}

function findPrompt(rel: string, prompts: Set<string>) {
  const stem = path.posix.basename(rel, path.posix.extname(rel))
  let dir = path.posix.dirname(rel)
  for (;;) {
    for (const s of promptStems(stem)) {
      const candidate = path.posix.join(dir, "prompts", `${s}.md`)
      if (prompts.has(candidate.replace(/^\.\//, ""))) return candidate.replace(/^\.\//, "")
    }
    if (dir === "." || dir === "") return undefined
    dir = path.posix.dirname(dir)
  }
}

function splitVersion(stem: string) {
  const match = stem.match(/^(.*?)-(v\d+.*)$/)
  if (match) return { base: match[1], label: match[2] }
  const take = stem.match(/^(.*?)-(take\d+.*)$/)
  if (take) return { base: take[1], label: take[2] }
  return { base: stem, label: "" }
}

export async function scanProject(project: string): Promise<Item[]> {
  const media: Found[] = []
  const prompts = new Set<string>()
  await walk(project, project, media, prompts)
  // Pasted sheets, style refs, reference videos, frame grabs and contact sheets have no prompt: not ours to review.
  const ours = media
    .map((m) => ({ ...m, prompt: findPrompt(m.rel, prompts) }))
    .filter((m) => m.prompt || OUTPUT_DIRS.has(m.rel.split("/")[0]))
  return ours.map(({ rel, size, mtime, prompt }) => {
    const ext = path.posix.extname(rel).toLowerCase()
    const name = path.posix.basename(rel)
    const stem = name.slice(0, name.length - ext.length)
    const dir = path.posix.dirname(rel)
    const { base, label } = splitVersion(stem.replace(/^rejected-/, ""))
    return {
      path: rel,
      name,
      kind: VIDEO.has(ext) ? "video" : "image",
      section: rel.includes("/") ? rel.split("/")[0] : ".",
      group: `${dir}/${base}`,
      label: stem.startsWith("rejected-") ? `${label || "v?"} rejected` : label,
      size,
      mtime,
      prompt,
    } satisfies Item
  })
}

async function looksLikeProject(dir: string, names: string[]) {
  const hasDoc = names.includes("AGENTS.md") || names.includes("PLAN.md")
  return hasDoc && names.some((n) => MEDIA_DIRS.includes(n))
}

/** Video projects under ROOT: folders with AGENTS.md or PLAN.md and a media folder. */
export async function listProjects(): Promise<Project[]> {
  const found: Project[] = []
  async function visit(dir: string, depth: number) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const names = entries.map((e) => e.name)
    if (await looksLikeProject(dir, names)) {
      let mtime = (await stat(dir)).mtimeMs
      for (const n of names.filter((n) => MEDIA_DIRS.includes(n))) {
        mtime = Math.max(mtime, (await stat(path.join(dir, n))).mtimeMs)
      }
      found.push({ path: dir, name: path.relative(ROOT, dir), mtime })
      return
    }
    if (depth === 0) return
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name)) {
        await visit(path.join(dir, e.name), depth - 1)
      }
    }
  }
  await visit(ROOT, 4)
  return found.sort((a, b) => b.mtime - a.mtime)
}
