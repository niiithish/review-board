import "server-only"

import { realpathSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"

/** Only folders under this root can be opened. */
export const ROOT = path.resolve(
  process.env.REVIEW_ROOT ?? path.join(os.homedir(), "Work")
)

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

function inside(parent: string, child: string) {
  const rel = path.relative(parent, child)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

/** Resolve a project folder from a query value, refusing anything outside ROOT. */
export function resolveProject(value: string | null): string {
  if (!value) throw new HttpError(400, "missing ?project=")
  let dir: string
  try {
    dir = realpathSync(path.resolve(value))
  } catch {
    throw new HttpError(404, `no such folder: ${value}`)
  }
  if (!inside(ROOT, dir)) throw new HttpError(403, `outside ${ROOT}`)
  if (!statSync(dir).isDirectory()) throw new HttpError(400, "not a folder")
  return dir
}

/** Resolve a file inside a project, refusing paths that escape it. */
export function resolveFile(project: string, rel: string | null): string {
  if (!rel) throw new HttpError(400, "missing ?path=")
  const file = path.resolve(project, rel)
  if (!inside(project, file)) throw new HttpError(403, "outside the project")
  return file
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: String(error) }, { status: 500 })
}
