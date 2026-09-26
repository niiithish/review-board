import type { NextRequest } from "next/server"

import { errorResponse, HttpError, resolveFile, resolveProject } from "@/lib/server/paths"
import { saveAttachment, saveReview } from "@/lib/server/reviews"

const MAX_BYTES = 20 * 1024 * 1024

/** Attach a pasted image to a file's review (multipart: project, path, image). */
export async function POST(request: NextRequest) {
  try {
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
    if (!attachment.startsWith(".review/attachments/")) throw new HttpError(400, "not an attachment")
    resolveFile(project, attachment)
    const reviews = await saveReview(project, target, { removeAttachment: attachment })
    return Response.json({ reviews })
  } catch (error) {
    return errorResponse(error)
  }
}
