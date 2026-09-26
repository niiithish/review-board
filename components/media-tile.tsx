"use client"

import { IconCheck, IconFlagFilled, IconMessage, IconPlayerPlayFilled } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { fileUrl } from "@/lib/client"
import type { Item, Review, Status } from "@/lib/types"
import { Button } from "@/components/ui/button"

export function MediaTile({
  project,
  item,
  review,
  versions,
  onOpen,
  onStatus,
}: {
  project: string
  item: Item
  review?: Review
  versions: number
  onOpen: () => void
  onStatus: (status: Status | null) => void
}) {
  const src = fileUrl(project, item.path, item.mtime)
  const status = review?.status
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card",
        status === "flagged" && "border-destructive ring-2 ring-destructive/60",
        status === "approved" && "border-primary ring-2 ring-primary/60"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[3/4] w-full cursor-pointer bg-black"
        title={item.path}
      >
        {item.kind === "video" ? (
          <>
            <video
              src={`${src}#t=0.1`}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-contain"
              onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause()
                e.currentTarget.currentTime = 0.1
              }}
            />
            <IconPlayerPlayFilled className="pointer-events-none absolute bottom-2 left-2 size-4 text-white/80 group-hover:opacity-0" />
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.name} loading="lazy" className="size-full object-contain" />
        )}
        <div className="pointer-events-none absolute top-2 right-2 flex gap-1">
          {review?.comment && (
            <span className="rounded-md bg-black/70 p-1 text-white">
              <IconMessage className="size-3.5" />
            </span>
          )}
          {status === "flagged" && (
            <span className="rounded-md bg-destructive p-1 text-white">
              <IconFlagFilled className="size-3.5" />
            </span>
          )}
          {status === "approved" && (
            <span className="rounded-md bg-primary p-1 text-primary-foreground">
              <IconCheck className="size-3.5" />
            </span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {versions > 1 ? `${versions} versions` : item.path.split("/").slice(0, -1).join("/") || "."}
          </p>
        </div>
        <Button
          size="icon-xs"
          variant={status === "flagged" ? "destructive" : "ghost"}
          title="Flag (f)"
          onClick={() => onStatus(status === "flagged" ? null : "flagged")}
        >
          <IconFlagFilled />
        </Button>
        <Button
          size="icon-xs"
          variant={status === "approved" ? "default" : "ghost"}
          title="Approve (a)"
          onClick={() => onStatus(status === "approved" ? null : "approved")}
        >
          <IconCheck />
        </Button>
      </div>
      {review?.comment && (
        <p className="line-clamp-2 border-t px-2 py-1.5 text-[11px] text-muted-foreground">
          {review.comment}
        </p>
      )}
    </div>
  )
}
