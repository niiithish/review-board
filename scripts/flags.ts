// Print a project's review.json for the agent: flagged first, then notes, then approved.
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

type Review = { status?: "flagged" | "approved"; comment?: string; attachments?: string[]; at: string }

const project = process.argv[2] ?? process.cwd()
const file = path.join(project, "review.json")
if (!existsSync(file)) {
  console.log(`No reviews yet (${file} doesn't exist).`)
  process.exit(0)
}
const items: Record<string, Review> = JSON.parse(readFileSync(file, "utf8")).items ?? {}
const collator = new Intl.Collator(undefined, { numeric: true })
const rows = Object.entries(items).sort(([a], [b]) => collator.compare(a, b))
const gone = (p: string) => (existsSync(path.join(project, p)) ? "" : " (file gone)")
const show = (title: string, list: [string, Review][]) => {
  if (!list.length) return
  console.log(`${title} (${list.length}):`)
  for (const [p, r] of list) {
    console.log(`- ${p}${gone(p)}${r.comment ? `: ${r.comment}` : ""}`)
    for (const a of r.attachments ?? []) console.log(`  attached image: ${path.join(project, a)}`)
  }
  console.log()
}
show("Flagged", rows.filter(([, r]) => r.status === "flagged"))
show("Notes", rows.filter(([, r]) => !r.status && (r.comment || r.attachments?.length)))
show("Approved", rows.filter(([, r]) => r.status === "approved"))
if (!rows.length) console.log("No reviews yet.")
