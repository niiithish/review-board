# review-board

A local web page for reviewing AI image and video batches. Open a video project folder, see every still and clip in a live grid, and flag, approve or comment on each one. Your reviews are saved to `review.json` in the project, so the agent reads them straight from there.

It's only for reviewing. You don't chat with the agent here.

## Use

```bash
~/Work/review-board/bin/review ~/Work/upwork/client/video-3
```

This starts the board on port 4747 (building it first if needed) and prints the project's URL. Run it again any time; if the board is already running it only prints the URL. `http://localhost:4747` lists every project under `~/Work`.

- **Grid:** each shot shows its newest version (turn off **Latest only** to see every file). The tabs filter by folder (characters, stills, clips…) and by review state. New files appear on their own within a few seconds.
- **Viewer:** click a tile. `←` `→` move, `F` flag, `A` approve, `X` clear, `C` comment, `Space` play, `Esc` close. Comments save as you type. Paste an image (`Ctrl+V`) or drop one on the panel to attach it. The panel also shows the shot's other versions and the prompt it was made from.
- **Copy for agent:** copies a short summary (flagged with comments, notes, approved) to paste into the chat.

## For agents

```bash
~/Work/review-board/bin/review <project>        # start the board and print the URL
~/Work/review-board/bin/review flags <project>  # the user's flags and comments
~/Work/review-board/bin/review stop
```

`<project>/review.json`:

```json
{
  "items": {
    "clips/clip-8-v1.mp4": {
      "status": "flagged",
      "comment": "too dark, like this one",
      "attachments": [".review/attachments/clip-8-v1-1790407558679.png"],
      "at": "…"
    },
    "clips/clip-9-v1.mp4": { "status": "approved", "at": "…" }
  }
}
```

`flagged` means redo it, and its comment says why. `approved` means keep it. A comment with no status is a note. `attachments` are images the user pasted, relative to the project: open them. `review flags` prints their full paths. Paths are relative to the project. Reviews stay on the file they were given to, so a new version (`-v2`) shows up unreviewed.

## Settings

- `REVIEW_ROOT`: only folders under this can be opened. Default `~/Work`.
- `REVIEW_PORT`: default `4747`.

The board finds media (jpg, png, webp, mp4, mov, webm) anywhere in the project. It skips hidden folders, `node_modules` and `all/` (make.py's synced copies), and matches `name-vN.ext` to `prompts/name-vN.md` in the same folder or any folder above it.

Built with Next.js, shadcn/ui and Bun.
