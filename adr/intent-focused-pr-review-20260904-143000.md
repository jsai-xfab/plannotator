# Intent: One review surface for documents and pull requests

Replace two separate review tools with this fork. Today one tool annotates markdown.
A second tool reviews pull requests. Neither tool does the other job. Plannotator
already does both. This fork closes the four gaps that stop it from replacing them.

## The why

A reviewer reads a change twice today. The reviewer reads the markdown plan in one
tool. The reviewer reads the code in a second tool. The two tools do not share
comments, and neither tool remembers what the reviewer already read.

Three costs follow:

1. The reviewer reads the same unchanged code again after the agent edits it.
2. The reviewer counts generated files as part of the change size.
3. The reviewer answers a question by hand that the agent can answer.

## The four capabilities

Each capability has its own spec. Read the spec before you change code.

| # | Capability | Spec |
|---|---|---|
| 1 | The agent answers, edits, and the reviewer resolves | `adr/specs/comment-resolution-and-ask-20260904-143000.md` |
| 2 | The diff shows only what changed since the last review | `adr/specs/review-rounds-20260904-143000.md` |
| 3 | The pull request diff shows source code only | `adr/specs/source-only-diff-20260904-143000.md` |
| 4 | The pull request review opens with a walkthrough | `adr/specs/guided-review-parity-20260904-143000.md` |

## What this fork keeps

Plannotator already supplies most of the base. Do not rebuild these parts.

- **Generated-file detection.** `packages/shared/generated-files.ts` resolves
  `linguist-generated` through `git check-attr`. It handles stacked and negated
  rules, because git resolves them, not a hand-written parser.
- **Guided Review.** `adr/decisions/006-guided-review-first-class-feature-20260702-192821.md`
  makes a chaptered walkthrough a first-class feature.
- **Comment threads.** `packages/core/annotation-threads.ts` threads annotations
  through `inReplyTo`.
- **External annotations.** An agent writes annotations back through
  `/api/external-annotations`.
- **Agent jobs.** `packages/core/agent-jobs.ts` runs an agent against a captured
  diff snapshot.

## The boundary this fork draws

Document review and pull request review are different jobs. This fork separates
them.

- **Document review** annotates prose. It never counts lines. It never reads
  `.gitattributes`.
- **Pull request review** reads source code. It removes generated files. It counts
  source lines only.

Capabilities 1 and 2 serve both jobs. Capabilities 3 and 4 serve pull request
review alone. Keep the shared parts in `packages/core` and `packages/shared`. Keep
the pull request parts in `packages/review-editor` and `packages/server`.

## References

- `adr/decisions/005-since-base-github-view-default-20260701-223706.md`
- `adr/decisions/006-guided-review-first-class-feature-20260702-192821.md`
- `adr/specs/guided-review-20260702-195351.md`
- `packages/shared/generated-files.ts`
- `packages/core/annotation-threads.ts`
- `packages/core/agent-jobs.ts`
