import { errorResponse, ROOT } from "@/lib/server/paths"
import { listProjects } from "@/lib/server/scan"

export async function GET() {
  try {
    return Response.json({ root: ROOT, projects: await listProjects() })
  } catch (error) {
    return errorResponse(error)
  }
}
