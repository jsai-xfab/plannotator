# Spec: Guided Review parity for pull request review

Date: 2026-09-04 · Status: draft for alignment
Intent: `adr/intent-focused-pr-review-20260904-143000.md`

## Summary

The tool this fork replaces opened a pull request with a written walkthrough. The
reviewer read the explanation first and the diff second. Plannotator already has
this feature. It is called Guided Review.

This spec does not build a walkthrough. It measures the one that exists, then names
what to add.

Warning: do not remove the other tool before this spec closes. The comparison needs
both tools running.

## What Guided Review already does

`adr/specs/guided-review-20260702-195351.md` defines it. An agent job produces a
chaptered review of the changeset. Core implementation comes first and glue comes
last. Each section pairs prose with live, annotatable diffs.

Two properties matter for parity:

- **Coverage.** A changed file the model does not place lands in a trailing
  "Everything else" section. No file disappears.
- **Fail-closed validation.** A section referring to a file outside the changed set
  is discarded. The model cannot invent a path.

Annotations made inside a guide are ordinary annotations. They share the state and
the Send Feedback payload, so the capabilities in
`adr/specs/comment-resolution-and-ask-20260904-143000.md` apply inside a guide
without further work.

## The comparison

Run both tools on the same three branches of the same repository. Use real
branches, not fixtures, because the walkthrough quality depends on real change
shape.

Record for each branch and each tool:

| Question | Why it matters |
|---|---|
| Does the walkthrough name the change's purpose in one sentence? | This is the first thing the reviewer reads. |
| Does the ordering put the core change first? | Reading glue first wastes the reviewer's attention. |
| Does every changed file appear somewhere? | A missed file is an unreviewed file. |
| Are the source ranges exact and clickable? | A walkthrough that cannot jump to code is prose, not review. |
| Does it explain *why*, or only *what*? | Restating the diff adds nothing. |
| How long does it take to generate? | A walkthrough nobody waits for is unused. |

## Known differences to check

Three capabilities of the replaced tool have no obvious counterpart. Confirm each
before deciding whether this fork needs it.

1. **The repository map at base and head.** The replaced tool authored a structural
   map of the repository at both commits, beside the document. Guided Review
   describes the change, not the structure around it. Decide whether the map earns
   its cost.
2. **Call-flow context.** Plannotator has `packages/shared/call-flow.ts` and
   `adr/specs/calldiff-call-flow-integration-20260811.md`. This may already cover
   the call-stack comparison the replaced tool showed. Check it before building
   anything.
3. **Diagrams.** The replaced tool embedded focused visuals. The
   `plannotator-visual-explainer` skill in `apps/skills/extra` may cover this. It
   is not installed by default.

## The one change this spec commits to now

Guided Review must respect the source-only rule. A walkthrough that dedicates a
section to a lockfile repeats the problem this fork exists to solve.

The guide job receives its changed-file set from `listPatchFiles` in
`packages/shared/review-core.ts:2384`. Filter generated files out of that set
before the job plans against it. See
`adr/specs/source-only-diff-20260904-143000.md`.

The filter applies to planning only. When the reviewer turns filtering off, the
guide does not regenerate. A guide describes the change it was generated against,
and `guideContext` already records that context at build time.

## Test first

**Integration.** Run a guide job on a fixture branch whose changes include a
lockfile and a generated test directory. Assert no section references a generated
file, and assert the generated files do not appear in `unplacedFiles`.

**Manual — the comparison above.** Write the six answers per branch per tool before
deciding what to extend. The comparison is the deliverable of this spec.

## Open question

The comparison decides the rest of this spec. Do not plan extensions before it
runs.
