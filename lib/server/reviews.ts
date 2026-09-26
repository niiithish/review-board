import "server-only"

import { readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Review, Status } from "@/lib/types"

/** Reviews live in the project, so the agent reads them without the app. */
export const REVIEW_FILE = "review.json"

type ReviewFile = {
  about: string
  updated: string
  items: Record<string, Review>
}

const ABOUT =
  "Written by review-board. items: media path (relative to this folder) -> status (flagged = user rejects it, approved = user likes it) and the user's comment."

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
  change: { status?: Status | null; comment?: string }
) {
  const run = async () => {
    const items = await readReviews(project)
    const current = items[file] ?? { at: "" }
    const next: Review = { ...current, at: new Date().toISOString() }
    if (change.status !== undefined) next.status = change.status ?? undefined
    if (change.comment !== undefined) next.comment = change.comment.trim() || undefined
    if (!next.status && !next.comment) delete items[file]
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
