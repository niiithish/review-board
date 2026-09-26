<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# review-board

A local review page for AI media batches; see README.md. Keep it small: grid, viewer, flag/approve/comment, `review.json`. Don't add features the user hasn't asked for.

- `lib/server/scan.ts` finds media and prompts, `lib/server/reviews.ts` owns `review.json` (its format is read by the agent skills in ai-content-skills, so change it only together with them).
- `bin/review` is the entry point the skills call. It rebuilds when the source is newer than `.next/BUILD_ID`.
- Check with `bun run typecheck` and `bun run build`. (`bun run lint` currently crashes inside eslint-plugin-react under ESLint 10; that's the template, not the code.)
