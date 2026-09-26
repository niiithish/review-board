"use client"

import * as React from "react"
import { IconFolder } from "@tabler/icons-react"

import { timeAgo } from "@/lib/client"
import type { Project } from "@/lib/types"

export function ProjectPicker() {
  const [data, setData] = React.useState<{ root: string; projects: Project[] } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [now, setNow] = React.useState(0)

  React.useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
        setNow(Date.now())
      })
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-lg font-medium">Review board</h1>
        <p className="text-sm text-muted-foreground">
          Pick a video project{data ? ` under ${data.root}` : ""}.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Looking for projects…</p>}
      {data && data.projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No projects found (a folder with AGENTS.md or PLAN.md and a clips, stills or scenes folder).
        </p>
      )}
      <ul className="flex flex-col divide-y rounded-lg border">
        {data?.projects.map((p) => (
          <li key={p.path}>
            <a
              href={`/?project=${encodeURIComponent(p.path)}`}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
            >
              <IconFolder className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(p.mtime, now)}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
