"use client"

import * as React from "react"
import { IconArrowLeft, IconCopy } from "@tabler/icons-react"
import { toast } from "sonner"

import { agentSummary, byPath, natural, sortSections, timeAgo } from "@/lib/client"
import type { Item, ItemsResponse, Review, Status } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { MediaTile } from "@/components/media-tile"
import { Viewer } from "@/components/viewer"

type Filter = "all" | "unreviewed" | "flagged" | "approved"
const POLL_MS = 3000

function matches(filter: Filter, review?: Review) {
  if (filter === "all") return true
  if (filter === "unreviewed") return !review?.status
  return review?.status === filter
}

export function Board({ project }: { project: string }) {
  const [data, setData] = React.useState<ItemsResponse | null>(null)
  const [reviews, setReviews] = React.useState<Record<string, Review>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [syncedAt, setSyncedAt] = React.useState(0)
  const [now, setNow] = React.useState(0)
  const [section, setSection] = React.useState("all")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [latestOnly, setLatestOnly] = React.useState(true)
  const [open, setOpen] = React.useState<string | null>(null)
  // A poll that started before our last local change must not undo it.
  const lastLocal = React.useRef(0)

  const load = React.useCallback(async () => {
    const started = Date.now()
    try {
      const res = await fetch(`/api/items?project=${encodeURIComponent(project)}`, { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? res.statusText)
      setData(body)
      if (started > lastLocal.current) setReviews(body.reviews)
      setError(null)
      setSyncedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [project])

  React.useEffect(() => {
    void load()
    const tick = setInterval(() => {
      setNow(Date.now())
      if (document.visibilityState === "visible") void load()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === "visible" && void load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const save = React.useCallback(
    async (path: string, change: { status?: Status | null; comment?: string }) => {
      lastLocal.current = Date.now()
      setReviews((prev) => {
        const next = { ...prev }
        const r: Review = { ...next[path], at: new Date().toISOString() }
        if (change.status !== undefined) r.status = change.status ?? undefined
        if (change.comment !== undefined) r.comment = change.comment.trim() || undefined
        if (!r.status && !r.comment) delete next[path]
        else next[path] = r
        return next
      })
      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, path, ...change }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? res.statusText)
        lastLocal.current = Date.now()
        setReviews(body.reviews)
      } catch (e) {
        toast.error(`Not saved: ${e instanceof Error ? e.message : e}`)
        lastLocal.current = 0
        void load()
      }
    },
    [project, load]
  )

  const setStatus = React.useCallback(
    (path: string, status: Status | null) => void save(path, { status }),
    [save]
  )
  const setComment = React.useCallback(
    (path: string, comment: string) => void save(path, { comment }),
    [save]
  )

  const items = React.useMemo(() => [...(data?.items ?? [])].sort(byPath), [data])

  const groups = React.useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) map.set(item.group, [...(map.get(item.group) ?? []), item])
    for (const list of map.values()) list.sort((a, b) => natural.compare(a.label, b.label))
    return map
  }, [items])

  // Newest file of each group, or every file.
  const pool = React.useMemo(() => {
    if (!latestOnly) return items
    const latest = [...groups.values()].map((list) =>
      list.reduce((a, b) => (b.mtime > a.mtime ? b : a))
    )
    return latest.sort(byPath)
  }, [items, groups, latestOnly])

  const sections = React.useMemo(
    () => sortSections([...new Set(items.map((i) => i.section))]),
    [items]
  )
  const inSection = pool.filter((i) => section === "all" || i.section === section)
  const visible = inSection.filter((i) => matches(filter, reviews[i.path]))
  const count = (f: Filter) => inSection.filter((i) => matches(f, reviews[i.path])).length

  const openItem = open ? items.find((i) => i.path === open) : undefined
  const openIndex = openItem ? visible.findIndex((i) => i.group === openItem.group) : -1

  const step = React.useCallback(
    (delta: 1 | -1) => {
      if (!visible.length) return
      const from = openIndex === -1 ? (delta === 1 ? -1 : 0) : openIndex
      const next = visible[(from + delta + visible.length) % visible.length]
      setOpen(next.path)
    },
    [visible, openIndex]
  )

  async function copySummary() {
    const text = agentSummary(project, items, reviews)
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied. Paste it to the agent.")
    } catch {
      toast.error("Couldn't copy; your browser blocked the clipboard.")
    }
  }

  const flagged = Object.values(reviews).filter((r) => r.status === "flagged").length

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" nativeButton={false} render={<a href="/" />} title="All projects">
            <IconArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">{data?.name ?? project}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block size-1.5 rounded-full ${error ? "bg-destructive" : syncedAt ? "bg-primary" : "bg-muted-foreground"}`}
              />
              {error
                ? error
                : syncedAt
                  ? `Live · ${items.length} files · synced ${timeAgo(syncedAt, Math.max(now, syncedAt))}`
                  : "Loading…"}
            </p>
          </div>
          <Button size="sm" variant={flagged ? "default" : "outline"} onClick={copySummary}>
            <IconCopy data-icon="inline-start" />
            Copy for agent
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={section} onValueChange={(v) => setSection(String(v))}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              {sections.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {s === "." ? "root" : s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              {(["all", "unreviewed", "flagged", "approved"] as const).map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f} <span className="text-muted-foreground tabular-nums">{count(f)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Toggle
            size="sm"
            variant="outline"
            pressed={latestOnly}
            onPressedChange={setLatestOnly}
            title="Show only the newest version of each shot"
          >
            Latest only
          </Toggle>
        </div>
      </header>

      <main className="flex-1 p-4">
        {data && visible.length === 0 && (
          <p className="py-20 text-center text-sm text-muted-foreground">Nothing here.</p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {visible.map((item) => (
            <MediaTile
              key={item.path}
              project={project}
              item={item}
              review={reviews[item.path]}
              versions={groups.get(item.group)?.length ?? 1}
              onOpen={() => setOpen(item.path)}
              onStatus={(s) => setStatus(item.path, s)}
            />
          ))}
        </div>
      </main>

      {openItem && (
        <Viewer
          project={project}
          item={openItem}
          review={reviews[openItem.path]}
          versions={groups.get(openItem.group) ?? [openItem]}
          position={openIndex === -1 ? "not in this view" : `${openIndex + 1} of ${visible.length}`}
          onSelect={setOpen}
          onStep={step}
          onClose={() => setOpen(null)}
          onStatus={(s) => setStatus(openItem.path, s)}
          onComment={setComment}
        />
      )}
    </div>
  )
}
