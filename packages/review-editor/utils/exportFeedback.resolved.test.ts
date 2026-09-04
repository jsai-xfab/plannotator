/**
 * Resolved threads leave the Send Feedback payload.
 *
 * A resolved thread has already been acted on. Sending it again asks the agent
 * to redo work it finished, so the export must drop the root and its replies
 * together — and must put them back when the reviewer reopens the thread.
 */
import { describe, expect, it } from "bun:test";
import type { CodeAnnotation } from "@plannotator/ui/types";

import { exportReviewFeedback } from "./exportFeedback";

function comment(over: Partial<CodeAnnotation>): CodeAnnotation {
  return {
    id: "x",
    type: "comment",
    filePath: "src/app.ts",
    lineStart: 1,
    lineEnd: 1,
    side: "new",
    createdAt: 0,
    ...over,
  } as CodeAnnotation;
}

describe("exportReviewFeedback thread resolution", () => {
  it("sends an unresolved comment", () => {
    const out = exportReviewFeedback([comment({ id: "a", text: "rename this" })]);
    expect(out).toContain("rename this");
  });

  it("drops a resolved thread", () => {
    const out = exportReviewFeedback([
      comment({ id: "a", text: "rename this", resolved: true }),
      comment({ id: "b", text: "still open" }),
    ]);
    expect(out).not.toContain("rename this");
    expect(out).toContain("still open");
  });

  it("drops the replies under a resolved root too", () => {
    const out = exportReviewFeedback([
      comment({ id: "a", text: "rename this", resolved: true }),
      comment({ id: "b", text: "agent answer here", inReplyTo: "a" }),
      comment({ id: "c", text: "still open" }),
    ]);
    expect(out).not.toContain("agent answer here");
    expect(out).toContain("still open");
  });

  it("keeps a thread whose reply is marked resolved, because state lives on the root", () => {
    const out = exportReviewFeedback([
      comment({ id: "a", text: "rename this" }),
      comment({ id: "b", text: "a reply", inReplyTo: "a", resolved: true }),
    ]);
    expect(out).toContain("rename this");
  });

  it("puts a reopened thread back", () => {
    const out = exportReviewFeedback([comment({ id: "a", text: "rename this", resolved: false })]);
    expect(out).toContain("rename this");
  });

  it("reports no feedback when every thread is resolved", () => {
    const out = exportReviewFeedback([comment({ id: "a", text: "done already", resolved: true })]);
    expect(out).toContain("No feedback provided.");
  });
});
