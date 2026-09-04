# Spec: The file panel, grouped by the walkthrough

Date: 2026-09-04 · Status: built and verified
Intent: `adr/intent-focused-pr-review-20260904-143000.md`

## Summary

A Guided Review explains the change in ordered chapters, on a screen of its own.
The reviewer reads it, then returns to a flat file tree that knows nothing about
it.

This joins the two. The file panel gains a **Groups** view: the same files, in
the walkthrough's order, each group titled and explained, opening in the normal
diff.

## Why a third panel view rather than a change to the guide screen

The guide screen is a takeover — file tree and dock hidden. That is right for
reading an explanation start to finish. It is wrong for reviewing, where the
reviewer wants the explanation *and* the diff at once.

So the walkthrough becomes a way to arrange the file panel, beside Tree and Git
status, rather than a place to visit.

## The three properties a flat tree cannot express

1. **A group carries an explanation.** The reviewer reads why a set of files
   belongs together before opening any of them.
2. **A file may belong to several groups.** A file touched for two reasons is
   explained under each. Overlap is the feature. `buildGuideGroups` counts such
   a file in both groups' totals, because each group's number describes that
   group's reading.
3. **Nothing disappears.** Files no section placed land in a trailing
   "Everything else" group.

## The exclusions come for free

The panel receives the file list the reviewer already sees. Generated files —
unit-test suites, `*.md`, lockfiles, anything `linguist-generated` in
`.gitattributes` — are filtered out of that list before this runs, so this
module needs no exclusion rule of its own and cannot disagree with the tree.

For the same reason the counts are source lines: `sourceAdditions` and
`sourceDeletions` come from the files themselves. See
`adr/specs/source-only-diff-20260904-143000.md`.

A guide reference to a file that is not in the list is dropped, matching the
fail-closed rule the guide validator already applies. A path the reviewer cannot
open must never appear as a row.

## Structure

| piece | file | responsibility |
|---|---|---|
| the rule | `packages/core/guide-groups.ts` | guide + files → groups. Pure. |
| the panel | `packages/review-editor/components/GuideGroupsPanel.tsx` | rendering, collapse |
| the switch | `PanelViewToggle`, `resolvePanelView` | offering `groups` only when a guide exists |

A remembered `groups` selection outlives the guide it was made against, so it
falls back to the tree like the other views rather than rendering an empty
panel.

## Adopting a saved guide on load

The panel needs a guide before it can group. Requiring the reviewer to open the
takeover first would defeat the point, so the review adopts the newest saved
guide for the repository on load — the id only. The takeover still opens on the
reviewer's own action.

Warning: `SAVED_GUIDE_ID_PREFIX` lives in `@plannotator/core/guide`, not in
`guide-store`. The store is node-bound, and importing it into the review app
pulls `fs` and `path` into the browser bundle for one string.

## Verified 2026-09-04

Against a fixture repository with a seeded two-section guide, both sections
naming the same file:

- The Groups segment appears beside Tree, Git status and Commits.
- Two groups render, each with its title, `+2 -0` source counts, its
  explanation, and the guide's per-file note.
- `substrate/base.py` appears under **both** groups.
- No generated file appears (`uv.lock`, `docs/guide.md`,
  `worldmodel/tests/test_a.py` are all absent).
- Clicking a row opens that file's diff in the dock.

Unit tests cover the rule (`guide-groups.test.ts`, 11) and the panel
(`GuideGroupsPanel.test.tsx`, 8, DOM-gated). Full suite at the pre-change
baseline: zero new failures.

## Open question

A group has no viewed state of its own. A reviewer who has read every file in a
group still sees it expanded. Whether a group should collapse itself once all
its files are viewed is worth deciding after some real use.
