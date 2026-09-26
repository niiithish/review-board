import { readFile, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { NextRequest } from "next/server"

import {
  errorResponse,
  HttpError,
  resolveFile,
  resolveProject,
} from "@/lib/server/paths"
import { saveAttachment, saveReview } from "@/lib/server/reviews"

const MAX_BYTES = 20 * 1024 * 1024

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

/** A pasted path ("/home/…/x.png", "~/x.png" or "file:///…") read from disk. */
async function imageFromPath(source: string) {
  let file = source.trim()
  if (file.startsWith("file://"))
    file = decodeURIComponent(new URL(file).pathname)
  if (file.startsWith("~/")) file = path.join(os.homedir(), file.slice(2))
  file = path.resolve(file)
  const allowed = [os.homedir(), os.tmpdir(), "/tmp"].some(
    (dir) => file === dir || file.startsWith(dir + path.sep)
  )
  if (!allowed)
    throw new HttpError(403, "only images in your home folder or /tmp")
  const type = MIME[path.extname(file).toLowerCase()]
  if (!type) throw new HttpError(415, `not an image: ${path.basename(file)}`)
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) throw new HttpError(404, `no such file: ${file}`)
  if (info.size > MAX_BYTES) throw new HttpError(413, "image over 20 MB")
  return new Blob([await readFile(file)], { type })
}

/**
 * Attach an image to a file's review: multipart (project, path, image),
 * or JSON (project, path, source) where source is a local image path.
 */
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as {
        project: string
        path: string
        source: string
      }
      const project = resolveProject(body.project)
      resolveFile(project, body.path)
      const image = await imageFromPath(body.source)
      const rel = await saveAttachment(project, body.path, image)
      return Response.json({
        reviews: await saveReview(project, body.path, { addAttachment: rel }),
      })
    }
    const form = await request.formData()
    const project = resolveProject(String(form.get("project") ?? ""))
    const target = String(form.get("path") ?? "")
    resolveFile(project, target)
    const image = form.get("image")
    if (!(image instanceof Blob)) throw new HttpError(400, "missing image")
    if (image.size > MAX_BYTES) throw new HttpError(413, "image over 20 MB")
    const rel = await saveAttachment(project, target, image).catch((e) => {
      throw new HttpError(415, e.message)
    })
    const reviews = await saveReview(project, target, { addAttachment: rel })
    return Response.json({ reviews })
  } catch (error) {
    return errorResponse(error)
  }
}

/** Remove one attachment: ?project=&path=&attachment= */
export async function DELETE(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams
    const project = resolveProject(q.get("project"))
    const target = q.get("path") ?? ""
    resolveFile(project, target)
    const attachment = q.get("attachment") ?? ""
    if (!attachment.startsWith(".review/attachments/"))
      throw new HttpError(400, "not an attachment")
    resolveFile(project, attachment)
    const reviews = await saveReview(project, target, {
      removeAttachment: attachment,
    })
    return Response.json({ reviews })
  } catch (error) {
    return errorResponse(error)
  }
}
