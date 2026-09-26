import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import type { NextRequest } from "next/server"

import { errorResponse, resolveFile, resolveProject } from "@/lib/server/paths"

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".md": "text/markdown; charset=utf-8",
}

function stream(file: string, start?: number, end?: number) {
  return Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
}

/** Serves a project file, with byte ranges so videos seek. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const project = resolveProject(params.get("project"))
    const file = resolveFile(project, params.get("path"))
    const type = TYPES[path.extname(file).toLowerCase()]
    if (!type) return Response.json({ error: "not a media or prompt file" }, { status: 415 })
    const info = await stat(file).catch(() => null)
    if (!info?.isFile()) return Response.json({ error: "not found" }, { status: 404 })

    const headers = new Headers({
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      // URLs carry the file's mtime, so a changed file gets a new URL.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Last-Modified": info.mtime.toUTCString(),
    })
    const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/)
    if (range) {
      let start = range[1] ? Number(range[1]) : info.size - Number(range[2])
      let end = range[1] && range[2] ? Number(range[2]) : info.size - 1
      start = Math.max(0, start)
      end = Math.min(end, info.size - 1)
      if (start > end) {
        headers.set("Content-Range", `bytes */${info.size}`)
        return new Response(null, { status: 416, headers })
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`)
      headers.set("Content-Length", String(end - start + 1))
      return new Response(stream(file, start, end), { status: 206, headers })
    }
    headers.set("Content-Length", String(info.size))
    return new Response(stream(file), { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
