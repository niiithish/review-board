import type { NextRequest } from "next/server"

import type { Status } from "@/lib/types"
import { errorResponse, resolveFile, resolveProject } from "@/lib/server/paths"
import { saveReview } from "@/lib/server/reviews"

type Body = {
  project: string
  path: string
  status?: Status | null
  comment?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const project = resolveProject(body.project)
    resolveFile(project, body.path)
    if (body.status != null && body.status !== "flagged" && body.status !== "approved") {
      return Response.json({ error: "status must be flagged, approved or null" }, { status: 400 })
    }
    const reviews = await saveReview(project, body.path, {
      status: body.status,
      comment: body.comment,
    })
    return Response.json({ reviews })
  } catch (error) {
    return errorResponse(error)
  }
}
