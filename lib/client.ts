import type { Item, Review } from "@/lib/types"

export function fileUrl(project: string, path: string, mtime?: number) {
  const q = new URLSearchParams({ project, path })
  if (mtime) q.set("v", String(Math.round(mtime)))
  return `/api/file?${q}`
}

/** Section tabs in pipeline order; unknown folders after, alphabetically. */
const ORDER = ["characters", "environments", "props", "assets", "scenes", "stills", "clips", "final"]

export function sortSections(sections: string[]) {
  return [...sections].sort((a, b) => {
    const ia = ORDER.indexOf(a)
    const ib = ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })
}

/** Natural sort, so clip-2 comes before clip-10. */
export const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function byPath(a: Item, b: Item) {
  return natural.compare(a.path, b.path)
}

/** The message the user pastes back to the agent. */
export function agentSummary(projectPath: string, items: Item[], reviews: Record<string, Review>) {
  const known = new Set(items.map((i) => i.path))
  const rows = Object.entries(reviews)
    .filter(([path]) => known.has(path))
    .sort(([a], [b]) => natural.compare(a, b))
  const line = ([path, r]: [string, Review]) => `- ${path}${r.comment ? `: ${r.comment}` : ""}`
  const flagged = rows.filter(([, r]) => r.status === "flagged")
  const approved = rows.filter(([, r]) => r.status === "approved")
  const notes = rows.filter(([, r]) => !r.status && r.comment)
  const parts = [
    `I reviewed ${projectPath} in review-board (full state in review.json there): ${flagged.length} flagged, ${approved.length} approved.`,
  ]
  if (flagged.length) parts.push("", "Flagged (redo these):", ...flagged.map(line))
  if (notes.length) parts.push("", "Notes:", ...notes.map(line))
  if (approved.length) parts.push("", "Approved:", ...approved.map(line))
  return parts.join("\n")
}

export function timeAgo(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
