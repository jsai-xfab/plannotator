# Spec: Agent answers, agent edits, reviewer resolves

Date: 2026-09-04 · Status: draft for alignment
Intent: `adr/intent-focused-pr-review-20260904-143000.md`

## Summary

A reviewer writes two kinds of comment. One kind asks for a change. The other kind
asks a question. Today both kinds leave the app as one block of feedback text, and
nothing comes back into the thread.

This spec makes the agent reply inside the thread, edit the source when the comment
asks for a change, and mark a thread resolved when it finished the work. The
reviewer resolves a question thread after reading the answer.

This spec serves both pull request review and document review.

## What already exists

Most of the wiring is here. Do not rebuild it.

- **Threads.** `packages/core/annotation-threads.ts` resolves `inReplyTo` into
  parents. It never drops an annotation, and it survives cycles a hostile tool
  might post.
- **Agent writes.** `packages/core/external-annotation.ts` and the handler at
  `packages/server/external-annotations.ts` let an agent create annotations.
- **Agent jobs.** `packages/core/agent-jobs.ts` runs an agent against a captured
  diff snapshot and returns findings.

## What is missing

1. An annotation has no resolved state. `packages/ui/types.ts:221` defines
   `CodeAnnotation` and it carries no such field.
2. No job answers one thread.
3. No job edits the source and reports what it changed.

## Part 1 — Resolved state

Add three fields to `CodeAnnotation`. Set them on the thread root only, because a
thread resolves as a unit.

```ts
resolved?: boolean;
resolvedAt?: number;
resolvedBy?: "user" | "agent";
```

The fields are additive. An annotation without them behaves exactly as it does
today, matching the rule `inReplyTo` already follows.

A resolved thread collapses to one line in the annotations panel. It is never
deleted. The reviewer reopens it with one click. Resolved threads leave the Send
Feedback payload, because the agent already did that work.

## Part 2 — The comment kind

The agent must know whether a comment asks for a change or asks a question. Add
`question` to the annotation types beside the existing `comment`, `suggestion`,
and `concern` in `packages/core/external-annotation.ts`.

The reviewer picks the kind when writing the comment. The agent does not guess,
because a wrong guess edits code the reviewer only asked about.

## Part 3 — Two agent jobs

Add two providers to the existing agent-job framework.

### The `answer` job

Input: one thread, plus the diff context the thread is anchored in.
Output: one reply annotation with `inReplyTo` set to the thread root.

The job never edits a file. It answers and stops. The thread stays open, and the
reviewer resolves it after reading.

**Ask now.** The reviewer clicks `Ask` on a single thread. The app runs the
`answer` job for that thread alone and shows the reply in place. This is the same
provider, launched for one thread instead of a batch.

### The `apply` job

Input: every unresolved thread that is not a question, plus the diff context.
Output: file edits, plus one reply per thread naming what it changed.

The job marks a thread resolved with `resolvedBy: "agent"` only when it made the
change. When the job cannot make a change, it replies with the reason and leaves
the thread open. An agent must never resolve a thread it did not act on, because a
silently resolved thread is a lost review comment.

After the job completes, write a review round. The reviewer then reads only the
agent's edits. See `adr/specs/review-rounds-20260904-143000.md`.

## The flow

1. The reviewer comments. Some comments are questions.
2. The reviewer clicks `Ask` on a question and reads the answer immediately, or
   sends the batch.
3. The agent answers every question thread and edits for every other thread.
4. The agent resolves what it changed. Question threads stay open.
5. The reviewer reads the answers, resolves them, and opens the since-review diff.

## Test first

**Unit — resolution.** A resolved root drops from the Send Feedback payload. Its
replies drop with it. An unresolved sibling stays.

**Unit — the agent may not over-resolve.** Given a job result that reports no edit
for a thread, the thread stays unresolved even when the agent's output claims
resolution. Assert the server enforces this, not the client.

**Integration — the `answer` job.** Post a question thread, run the job against a
fixture repository, and assert exactly one reply lands with `inReplyTo` set to the
root and no file changed on disk.

**Integration — the `apply` job.** Post a change request against a fixture file,
run the job, and assert the file changed, one reply landed, and the root is
resolved with `resolvedBy: "agent"`.

**Manual — Playwright checklist.**

1. Write a question comment. Click `Ask`. An answer appears in the thread.
2. Resolve it. The thread collapses.
3. Write a change comment. Send feedback. The file changes and the thread resolves
   itself.
4. Reopen a resolved thread. It returns to the payload.

## Open questions

1. **Which agent runs the job.** Plannotator supports many agents. Decide whether
   `answer` and `apply` use the review agent, or the reviewer's own session.
2. **Document edits.** For a markdown review the `apply` job edits prose. Decide
   whether it edits the file directly or proposes a diff the reviewer accepts.
