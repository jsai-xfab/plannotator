---
name: plannotator-review
description: Open Plannotator's browser-based code review UI for the current worktree or a pull request URL, then act on the feedback that comes back.
disable-model-invocation: true
---

# Plannotator Review

Use this skill when the user wants to review current code changes in Plannotator instead of reading a diff inline.

Run:

```bash
plannotator review [optional-pr-url]
```

Behavior:

1. Launch the command with Bash.
2. Wait for it to finish.
3. If it returns feedback or annotations, act on them as described below.
4. If it returns an approval/LGTM-style message, acknowledge that review passed and continue.

Do not ask the user to copy shell commands into chat. Run the command yourself.

## Acting on returned feedback

Each returned comment is one thread. Read every thread and decide what it asks
for. The reviewer does not label them, so you classify.

- **A change request** asks you to alter code or prose. Make the change.
- **A question** asks you to explain something. Answer it. Change nothing.

Warning: when a thread only asks a question, do not edit files for it. An
unrequested edit is harder for the reviewer to undo than a missing answer.

Always say how you read the comment. Begin each reply by naming what you took
it to be and what you did, so the reviewer can catch a misreading:

- "Read as a change request — renamed `y` to `total` in `substrate/base.py`."
- "Read as a question — answered below, no files changed."

## Replying and resolving

The review server exposes the thread API on the URL the command prints.

Post a reply into a thread — create the annotation, then point it at the thread
root:

```bash
# 1. create the reply, anchored to the same file and line as the comment
curl -s -X POST "$REVIEW_URL/api/external-annotations" \
  -H 'content-type: application/json' \
  -d '{"annotations":[{"source":"agent","type":"comment",
       "filePath":"substrate/base.py","lineStart":8,"lineEnd":8,"side":"new",
       "text":"Read as a question — y is used by compute() below."}]}'

# 2. attach it to the thread, using the id returned above
curl -s -X PATCH "$REVIEW_URL/api/external-annotations?id=<new-id>" \
  -H 'content-type: application/json' \
  -d '{"inReplyTo":"<thread-root-id>"}'
```

Resolve a thread only after you have made the change it asked for:

```bash
curl -s -X PATCH "$REVIEW_URL/api/external-annotations?id=<thread-root-id>" \
  -H 'content-type: application/json' \
  -d '{"resolved":true,"resolvedAt":'"$(date +%s000)"',"resolvedBy":"agent"}'
```

Three rules govern resolving:

1. **Resolve only what you changed.** A thread you answered but did not act on
   stays open. The reviewer reads the answer and resolves it.
2. **Never resolve a thread you could not act on.** Reply with the reason and
   leave it open. A silently resolved thread is a lost review comment.
3. **Resolve the thread ROOT, never a reply.** A thread resolves as a unit.

## What the reviewer sees next

Two things follow from your edits, and neither needs anything from you.

- **The reviewer re-reads only what you changed.** Sending feedback records the
  content under review, so the next pass compares against it. Keep your edits
  scoped to what was asked; unrelated changes land in that view and cost the
  reviewer attention.
- **The diff counts source lines only.** Files marked `linguist-generated` in
  `.gitattributes` are hidden, and comment lines do not count toward the size of
  a change. Do not try to make a change look smaller by moving code into
  comments or generated files.
