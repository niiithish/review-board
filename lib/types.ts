export type Status = "flagged" | "approved"

export type Review = {
  status?: Status
  comment?: string
  /** Images the user pasted, relative to the project (in .review/attachments/). */
  attachments?: string[]
  at: string
}

export type Item = {
  /** Path relative to the project root, with forward slashes. */
  path: string
  name: string
  kind: "image" | "video"
  /** Top-level folder: clips, stills, characters… ("." for the root). */
  section: string
  /** Same folder + name without its version, so v1, v2 and takes group together. */
  group: string
  /** Version and take within the group: "v2", "v1-take2", "v3-1080p". */
  label: string
  size: number
  mtime: number
  /** Prompt file for this media, relative to the project root, if one exists. */
  prompt?: string
}

export type Project = {
  path: string
  name: string
  mtime: number
}

export type ItemsResponse = {
  project: string
  name: string
  items: Item[]
  reviews: Record<string, Review>
}
