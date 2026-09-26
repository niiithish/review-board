import path from "node:path"

import type { NextRequest } from "next/server"

import type { ItemsResponse } from "@/lib/types"
import { errorResponse, resolveProject, ROOT } from "@/lib/server/paths"
import { readReviews } from "@/lib/server/reviews"
import { scanProject } from "@/lib/server/scan"

export async function GET(request: NextRequest) {
  try {
    const project = resolveProject(request.nextUrl.searchParams.get("project"))
    const [items, reviews] = await Promise.all([
      scanProject(project),
      readReviews(project),
    ])
    const body: ItemsResponse = {
      project,
      name: path.relative(ROOT, project) || path.basename(project),
      items,
      reviews,
    }
    return Response.json(body)
  } catch (error) {
    return errorResponse(error)
  }
}
