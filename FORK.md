# What this fork changes

This is a fork of [backnotprop/plannotator](https://github.com/backnotprop/plannotator).
This file is the one place that says what is **ours** and what is **upstream's**.

Keep it current. Add a row when you change upstream behaviour, and delete a row
when upstream absorbs the change.

Fork: `jsai-xfab/plannotator` · branch `feat/focused-pr-review` · upstream remote `upstream`

## Why the fork exists

A source change arrives buried. A branch that touches forty lines of logic lands
beside several hundred lines of generated tests, markdown, and lockfiles, and the
review counts all of it. The reviewer then sends feedback, the agent edits, and
the whole change has to be read again to find what moved.

Everything below serves one of those two problems.

## Ours — behaviour that differs from upstream

| # | What | Where |
|---|---|---|
| 1 | **Source lines, not raw lines.** Comment lines and blank lines stop counting toward a change's size. Python only so far; every other language counts every line, as before. | `packages/core/source-lines.ts` |
| 2 | **Generated files leave the review.** Files marked `linguist-generated` in `.gitattributes` are removed from the file tree and the counts, not merely collapsed. One row restores them and always names how many are hidden. | `packages/review-editor/components/GeneratedFilesRow.tsx`, `App.tsx` |
| 3 | **`.gitattributes` applies to PR reviews.** Upstream resolved attributes only for a plain local git session; a PR review fell back to name-based defaults. It now resolves them against the PR's local checkout, and a PR switch recomputes the set. | `packages/server/review.ts` |
| 4 | **Threads resolve.** A comment thread can be marked handled: it stops travelling to the agent, is never deleted, and reopens with the same control. Code review and document review both. | `packages/core/thread-resolution.ts`, `CommentActions.tsx`, `AnnotationPanel.tsx` |
| 5 | **Ask answers one thread.** Answers that thread in place and posts the reply inside it, without sending the batch. Never resolves anything — an answer is not a change. | `packages/review-editor/App.tsx` |
| 6 | **Review rounds.** Sending feedback records the files under review by git blob id, so a later pass can show only what the agent changed. **No UI yet** — the record is written, the view is not built. | `packages/shared/round-store.ts`, `packages/core/since-review.ts` |
| 7 | **Guided Review plans against source only.** Generated files are no longer sent to the guide agent, so no chapter is spent on a lockfile. | `packages/server/review.ts` |
| 8 | **The review skill teaches the loop.** Classify each thread, say how you read it, edit for a change request, answer a question without touching files, resolve only what you changed. | `apps/skills/core/plannotator-review/SKILL.md` |
| 9 | **Code Tour stops render diagrams.** A stop's detail goes through the full markdown renderer, so a ```mermaid fence renders as a picture — plus code blocks and tables. The tour prompt asks for a diagram when a stop is about structure or sequence, drawn from real names in the diff. | `packages/ui/components/RenderedMarkdown.tsx`, `TourStopCard.tsx`, `packages/server/tour/tour-review.ts` |
| 10 | **Guided Review chapters render diagrams, and the prompt asks for them.** The guide chain gained a `ProseRenderer` slot on its host contract: the review app supplies the full renderer, the portable guides.show export keeps the light one and its `core`-only dependency. The prompt names five shapes a chapter can carry, and asks for the matching diagram: call path (`sequenceDiagram`), types (`classDiagram`), branching process (`flowchart`), lifecycle (`stateDiagram-v2`), data shape (`erDiagram`). Chapter prose also grew from 2-6 sentences to 4-10. | `packages/guide-viewer/host.tsx`, `GuideSectionCard.tsx`, `ReviewGuideHost.tsx`, `packages/server/guide/guide-review.ts` |
| 11 | **The file tree stays open during a guide, and lights the current chapter.** Upstream hides the tree in the takeover. Where a chapter's files sit in the repository is itself information — one cohesive package or four scattered ones — and the guide's own list cannot show it. The chapter is derived from the focused file and reported through the same host seam. | `packages/guide-viewer/host.tsx`, `GuideView.tsx`, `FileTreeNode.tsx`, `App.tsx` |

### The cost of row 9

The code review bundle grew **17.63 MB → 21.90 MB (+24%,** gzip 5.6 → 6.9 MB) because
Mermaid is now inlined into it. Upstream deliberately keeps Mermaid out of that
bundle, and `tests/entry-assets.test.ts` guards it; this fork changes that
expectation on purpose.

The trade is acceptable only because the bundle is served from localhost. It
would not be on a hosted page. Revert the dispatch in `RenderedMarkdown` and the
marker expectation together if the tour stops drawing.

## Upstream — not ours, do not claim it

These arrived with plannotator. Several are easy to mistake for our work.

| What | Note |
|---|---|
| **Guided Review** | Chaptered walkthrough: ordered sections, prose per chapter, annotatable diffs inline, coverage guarantee, fail-closed validation, saved to disk, portable HTML export. Its unit is the **file**. |
| **Code Tour** | A separate feature. Narrative arc (`greeting`/`intent`/`before`/`after`), ordered stops with `transition` between them, severity-tagged takeaways, a QA checklist, and **chunk-level anchors** (`file`, `line`..`end_line`, `hunk`, `label`). Opens as a modal. |
| **Generated-file detection** | `packages/shared/generated-files.ts` — resolves `linguist-generated` through `git check-attr`. We changed what happens to the result, not the detection. |
| **Comment threading** | `inReplyTo`, `packages/core/annotation-threads.ts`. |
| **External annotations** | The API an agent writes findings and replies through. |
| **Agent jobs** | The runner behind Guided Review, Code Tour, and agent review. |
| **Since-base diff, Git status panel, Commits, call flow, semantic diff** | All upstream. |

## Removed from this fork

| What | Why |
|---|---|
| **Groups panel** (a file-panel view grouping by guide section) | Built, then reverted in `bcf920c0`. It duplicated Guided Review, which already renders its chapters with annotatable diffs. Deepening the upstream feature beats maintaining a parallel view of the same data. |

## Known gaps

- **Rounds have no view.** Round 6 records data nothing reads yet.
- **Markdown review records no rounds.** Only code review does; `packages/server/annotate.ts` is untouched.
- **Only Python has a comment rule.** Every other language counts every changed line.
- **A guide exported to guides.show still draws nothing.** The `ProseRenderer` slot is filled by the review app only; the portable viewer keeps the light renderer, because `guide-viewer` depends on `core` alone. A shared guide shows the diagram as source. Fixing that means a `core`-only markdown-plus-mermaid renderer.
- **Diagrams are likely, not guaranteed.** Both prompts ask for a diagram when a chapter or a stop carries one of the named shapes, and the model still decides. Observed: one diagram in one run, none in the next on the same small changeset. Placement inside the prompt changed the outcome more than the wording did: the same instruction drew nothing while it sat inside the overview's "never as decoration" bullet list, and drew reliably once it moved to its own `#### Diagrams` section.
- **Only the guide prompt names all five diagram shapes.** The tour prompt still names three: structure, sequence, and branching lifecycle.
- **Tour anchors still land on the file, not the line.** `TourDiffAnchor` carries `line` and `end_line`, and `onAnchorClick` passes only `anchor.file`. There is no line-reveal primitive — the guide reveal channel is `{ path, token }` — so this needs new plumbing.
- **Code Tour is still a modal.** It should be a center dock panel, beside the diff rather than covering it.

## Working on this fork

```sh
git fetch upstream && git rebase upstream/main   # upstream releases weekly or faster
bun install
DOM_TESTS=1 bun test --isolate                   # ~169 failures are pre-existing
bun run build:review && bun run build:hook
```

Before claiming a regression, compare the failing-test **set** against
`upstream/main`, not the count. The suite has a large pre-existing failure set
in this environment (live proxies, port binding).

Two traps this fork has already hit twice:

1. **`packages/review-editor` reaches core through `@plannotator/shared/*`.** The
   vite build has no `@plannotator/core` alias. A new core module needs its
   `exports` entry, a shared re-export, and a `vendor.sh` line — or `bun test`
   passes while the app build fails.
2. **`guide-store` is node-bound.** Importing it into the review app pulls `fs`
   and `path` into the browser bundle. Browser-safe constants belong in
   `packages/core/guide.ts`.
