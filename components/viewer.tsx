"use client"

import * as React from "react"
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFlagFilled,
  IconPhotoPlus,
  IconX,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { fileUrl } from "@/lib/client"
import type { Item, Review, Status } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"

const IMAGE_PATH = /^(file:\/\/|~\/|\/)\S.*\.(png|jpe?g|webp|gif)$/i

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

export function Viewer({
  project,
  item,
  review,
  versions,
  position,
  neighbours,
  onSelect,
  onStep,
  onClose,
  onStatus,
  onComment,
  onAttach,
  onAttachPath,
  onDetach,
}: {
  project: string
  item: Item
  review?: Review
  versions: Item[]
  position: string
  neighbours: Item[]
  onSelect: (path: string) => void
  onStep: (delta: 1 | -1) => void
  onClose: () => void
  onStatus: (status: Status | null) => void
  onComment: (path: string, comment: string) => void
  onAttach: (image: Blob) => void
  onAttachPath: (source: string) => void
  onDetach: (attachment: string) => void
}) {
  const status = review?.status
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const commentRef = React.useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = React.useState(review?.comment ?? "")
  const [prompt, setPrompt] = React.useState<string | null>(null)
  const saved = review?.comment ?? ""

  // Keep the draft in step with the file shown (and with edits made elsewhere).
  const [shownPath, setShownPath] = React.useState(item.path)
  const [shownSaved, setShownSaved] = React.useState(saved)
  if (
    shownPath !== item.path ||
    (shownSaved !== saved && draft === shownSaved)
  ) {
    setShownPath(item.path)
    setShownSaved(saved)
    setDraft(saved)
  }

  const flush = React.useCallback(() => {
    if (draft.trim() !== saved.trim()) onComment(item.path, draft)
  }, [draft, saved, onComment, item.path])

  // Save the comment shortly after typing stops.
  React.useEffect(() => {
    if (draft.trim() === saved.trim()) return
    const t = setTimeout(() => onComment(item.path, draft), 700)
    return () => clearTimeout(t)
  }, [draft, saved, onComment, item.path])

  // Moving to another file or closing never drops an unsaved comment.
  const latest = React.useRef({ path: item.path, draft, saved, onComment })
  React.useEffect(() => {
    latest.current = { path: item.path, draft, saved, onComment }
  })
  React.useEffect(
    () => () => {
      const l = latest.current
      if (l.draft.trim() !== l.saved.trim()) l.onComment(l.path, l.draft)
    },
    [item.path]
  )

  React.useEffect(() => {
    setPrompt(null)
    if (!item.prompt) return
    let live = true
    fetch(fileUrl(project, item.prompt))
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => live && setPrompt(t))
    return () => {
      live = false
    }
  }, [project, item.prompt])

  // Paste anywhere in the viewer: image data attaches as is, and a pasted
  // image path or file:// link (a file copied in a file manager) attaches that
  // file. Any other text pastes into the comment as usual.
  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData
      if (!data) return
      const images = [...data.items]
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null)
      if (images.length) {
        e.preventDefault()
        images.forEach(onAttach)
        return
      }
      const text = (
        data.getData("text/uri-list") || data.getData("text/plain")
      ).trim()
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
      if (lines.length && lines.every((l) => IMAGE_PATH.test(l))) {
        e.preventDefault()
        lines.forEach(onAttachPath)
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [onAttach, onAttachPath])
  const [dragging, setDragging] = React.useState(false)
  const attachments = review?.attachments ?? []

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === "arrowright" || key === "j") onStep(1)
      else if (key === "arrowleft" || key === "k") onStep(-1)
      else if (key === "f") onStatus(status === "flagged" ? null : "flagged")
      else if (key === "a") onStatus(status === "approved" ? null : "approved")
      else if (key === "x") onStatus(null)
      else if (key === "c") commentRef.current?.focus()
      else if (key === " " && videoRef.current) {
        const v = videoRef.current
        if (v.paused) void v.play()
        else v.pause()
      } else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onStep, onStatus, status])

  const src = fileUrl(project, item.path, item.mtime)

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return
        // Esc while typing leaves the comment box instead of closing.
        if (
          details.reason === "escape-key" &&
          isTyping(document.activeElement)
        ) {
          details.cancel()
          ;(document.activeElement as HTMLElement).blur()
          return
        }
        onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100svh-2rem)] max-h-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1280px,calc(100vw-2rem))] md:flex-row"
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-black">
          {item.kind === "video" ? (
            <video
              key={src}
              ref={videoRef}
              src={src}
              autoPlay
              controls
              loop
              playsInline
              className="max-h-full max-w-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.name}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {neighbours.map((n) =>
            n.kind === "video" ? (
              <video
                key={n.path}
                src={fileUrl(project, n.path, n.mtime)}
                preload="auto"
                muted
                hidden
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={n.path}
                src={fileUrl(project, n.path, n.mtime)}
                alt=""
                hidden
              />
            )
          )}
          <div className="absolute inset-y-0 left-3 flex items-center">
            <Button
              variant="secondary"
              size="icon"
              className="opacity-70 transition-none hover:opacity-100 active:translate-y-0"
              onClick={() => onStep(-1)}
              title="Previous (←)"
            >
              <IconChevronLeft />
            </Button>
          </div>
          <div className="absolute inset-y-0 right-3 flex items-center">
            <Button
              variant="secondary"
              size="icon"
              className="opacity-70 transition-none hover:opacity-100 active:translate-y-0"
              onClick={() => onStep(1)}
              title="Next (→)"
            >
              <IconChevronRight />
            </Button>
          </div>
        </div>

        <aside className="no-scrollbar flex max-h-[45svh] w-full flex-col gap-4 overflow-y-auto border-t p-4 md:max-h-none md:w-96 md:shrink-0 md:border-t-0 md:border-l">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{item.name}</DialogTitle>
              <DialogDescription className="mt-1 truncate text-xs">
                {item.path} · {position}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="Close (Esc)"
            >
              <IconX />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={status === "flagged" ? "destructive" : "outline"}
              className={cn(
                status === "flagged" && "ring-2 ring-destructive/50"
              )}
              onClick={() => onStatus(status === "flagged" ? null : "flagged")}
            >
              <IconFlagFilled data-icon="inline-start" />
              {status === "flagged" ? "Flagged" : "Flag"} <Kbd>F</Kbd>
            </Button>
            <Button
              variant={status === "approved" ? "default" : "outline"}
              onClick={() =>
                onStatus(status === "approved" ? null : "approved")
              }
            >
              <IconCheck data-icon="inline-start" />
              {status === "approved" ? "Approved" : "Approve"} <Kbd>A</Kbd>
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="comment"
              className="text-xs font-medium text-muted-foreground"
            >
              Comment <Kbd>C</Kbd>
            </label>
            <Textarea
              id="comment"
              ref={commentRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={flush}
              placeholder="What's wrong, or what to keep…"
              className="no-scrollbar max-h-56 min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              {draft.trim() === saved.trim()
                ? saved
                  ? "Saved"
                  : "Saved as you type"
                : "Saving…"}
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
              dragging && "border-primary bg-primary/10"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              ;[...e.dataTransfer.files]
                .filter((f) => f.type.startsWith("image/"))
                .forEach(onAttach)
            }}
          >
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((a) => (
                  <div
                    key={a}
                    className="group/att relative aspect-square overflow-hidden rounded-md bg-muted"
                  >
                    <a
                      href={fileUrl(project, a)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(project, a)}
                        alt="attachment"
                        className="size-full object-cover"
                      />
                    </a>
                    <Button
                      size="icon-xs"
                      variant="secondary"
                      className="absolute top-1 right-1 opacity-0 group-hover/att:opacity-100"
                      onClick={() => onDetach(a)}
                      title="Remove"
                    >
                      <IconX />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <IconPhotoPlus className="size-3.5" />
              Paste an image or its path (<Kbd>Ctrl</Kbd> <Kbd>V</Kbd>), or drop
              one here
            </p>
          </div>

          {versions.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Versions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {versions.map((v) => (
                  <Button
                    key={v.path}
                    size="xs"
                    variant={v.path === item.path ? "secondary" : "ghost"}
                    className={cn(v.path === item.path && "ring-1 ring-ring")}
                    onClick={() => onSelect(v.path)}
                    title={v.path}
                  >
                    {v.label || v.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {item.prompt && (
            <details className="group flex flex-col gap-1.5">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Prompt · {item.prompt.split("/").pop()}
              </summary>
              <pre className="mt-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {prompt ?? "Loading…"}
              </pre>
            </details>
          )}

          <p className="mt-auto hidden text-[11px] text-muted-foreground md:block">
            <Kbd>←</Kbd> <Kbd>→</Kbd> move · <Kbd>F</Kbd> flag · <Kbd>A</Kbd>{" "}
            approve · <Kbd>X</Kbd> clear · <Kbd>Space</Kbd> play ·{" "}
            <Kbd>Esc</Kbd> close
          </p>
        </aside>
      </DialogContent>
    </Dialog>
  )
}
