import "server-only"

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Review, Status } from "@/lib/types"

/** Reviews live in the project, so the agent reads them without the app. */
export const REVIEW_FILE = "review.json"
/** Pasted images; a hidden folder, so the grid doesn't list them as media. */
export const ATTACH_DIR = ".review/attachments"

type ReviewFile = {
  about: string
  updated: string
  items: Record<string, Review>
}

const ABOUT =
  "Written by review-board. items: media path (relative to this folder) -> status (flagged = user rejects it, approved = user likes it) the user's comment, and attachments: images the user pasted (paths relative to this folder)."

export async function readReviews(project: string): Promise<Record<string, Review>> {
  try {
    const data = JSON.parse(await readFile(path.join(project, REVIEW_FILE), "utf8"))
    return data.items ?? {}
  } catch {
    return {}
  }
}

// One write at a time per project, so quick clicks never lose an update.
const queues = new Map<string, Promise<unknown>>()

export function saveReview(
  project: string,
  file: string,
  change: {
    status?: Status | null
    comment?: string
    addAttachment?: string
    removeAttachment?: string
  }
) {
  const run = async () => {
    const items = await readReviews(project)
    const current = items[file] ?? { at: "" }
    const next: Review = { ...current, at: new Date().toISOString() }
    if (change.status !== undefined) next.status = change.status ?? undefined
    if (change.comment !== undefined) next.comment = change.comment.trim() || undefined
    if (change.addAttachment) {
      next.attachments = [...(next.attachments ?? []), change.addAttachment]
    }
    if (change.removeAttachment) {
      next.attachments = next.attachments?.filter((a) => a !== change.removeAttachment)
      await unlink(path.join(project, change.removeAttachment)).catch(() => {})
    }
    if (!next.attachments?.length) delete next.attachments
    if (!next.status && !next.comment && !next.attachments) delete items[file]
    else items[file] = next
    const sorted = Object.fromEntries(
      Object.entries(items).sort(([a], [b]) => a.localeCompare(b))
    )
    const body: ReviewFile = { about: ABOUT, updated: next.at, items: sorted }
    const target = path.join(project, REVIEW_FILE)
    const tmp = `${target}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(body, null, 2) + "\n")
    await rename(tmp, target)
    return items
  }
  const next = (queues.get(project) ?? Promise.resolve()).then(run, run)
  queues.set(project, next)
  return next
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

/** Save a pasted image and return its project-relative path. */
export async function saveAttachment(project: string, file: string, blob: Blob) {
  const ext = IMAGE_TYPES[blob.type]
  if (!ext) throw new Error(`not an image: ${blob.type || "unknown type"}`)
  const stem = path.basename(file, path.extname(file)).replace(/[^\w.-]+/g, "_")
  const rel = `${ATTACH_DIR}/${stem}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}${ext}`
  await mkdir(path.join(project, ATTACH_DIR), { recursive: true })
  await writeFile(path.join(project, rel), Buffer.from(await blob.arrayBuffer()))
  return rel
}
