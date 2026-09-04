import { describe, expect, it } from "bun:test";

import { classifySinceReview } from "./since-review";

const round = [
  { path: "a.ts", objectId: "A1" },
  { path: "b.ts", objectId: "B1" },
];

describe("classifySinceReview", () => {
  it("shows a file the agent edited", () => {
    const result = classifySinceReview({
      roundFiles: round,
      currentById: { "a.ts": "A1", "b.ts": "B2" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed.map((f) => f.path)).toEqual(["b.ts"]);
    expect(result.hiddenFromBase).toEqual([]);
  });

  it("shows nothing when the agent changed nothing", () => {
    const result = classifySinceReview({
      roundFiles: round,
      currentById: { "a.ts": "A1", "b.ts": "B1" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed).toEqual([]);
  });

  it("shows a file that is new since the round", () => {
    const result = classifySinceReview({
      roundFiles: round,
      currentById: { "a.ts": "A1", "b.ts": "B1", "c.ts": "C1" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed.map((f) => f.path)).toEqual(["c.ts"]);
    expect(result.changed[0].status).toBe("added");
  });

  it("shows a file deleted since the round", () => {
    const result = classifySinceReview({
      roundFiles: round,
      currentById: { "a.ts": "A1" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed.map((f) => f.path)).toEqual(["b.ts"]);
    expect(result.changed[0].status).toBe("deleted");
  });

  it("hides a change that came only from the base branch", () => {
    // The reviewer saw the old upstream content; the new content is the new
    // upstream content. Nothing else touched it.
    const result = classifySinceReview({
      roundFiles: [{ path: "e.ts", objectId: "E1" }],
      currentById: { "e.ts": "E2" },
      baseAtRound: { "e.ts": "E1" },
      baseNow: { "e.ts": "E2" },
    });
    expect(result.changed).toEqual([]);
    expect(result.hiddenFromBase).toEqual(["e.ts"]);
  });

  it("shows a file the base AND the agent both touched", () => {
    // Current content matches neither base side, so the agent is in there too.
    const result = classifySinceReview({
      roundFiles: [{ path: "e.ts", objectId: "E1" }],
      currentById: { "e.ts": "E9" },
      baseAtRound: { "e.ts": "E1" },
      baseNow: { "e.ts": "E2" },
    });
    expect(result.changed.map((f) => f.path)).toEqual(["e.ts"]);
    expect(result.hiddenFromBase).toEqual([]);
  });

  it("shows a file whose reviewed content was never the base content", () => {
    // The reviewer saw a branch edit, not upstream — so a later base move
    // cannot explain the whole change.
    const result = classifySinceReview({
      roundFiles: [{ path: "e.ts", objectId: "LOCAL" }],
      currentById: { "e.ts": "E2" },
      baseAtRound: { "e.ts": "E1" },
      baseNow: { "e.ts": "E2" },
    });
    expect(result.changed.map((f) => f.path)).toEqual(["e.ts"]);
  });

  it("keeps the round's order for stable reading", () => {
    const result = classifySinceReview({
      roundFiles: [
        { path: "a.ts", objectId: "A1" },
        { path: "b.ts", objectId: "B1" },
      ],
      currentById: { "a.ts": "A2", "b.ts": "B2" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed.map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("treats an untracked file with no blob as changed when its content moves", () => {
    const result = classifySinceReview({
      roundFiles: [{ path: "u.ts", objectId: "" }],
      currentById: { "u.ts": "U1" },
      baseAtRound: {},
      baseNow: {},
    });
    expect(result.changed.map((f) => f.path)).toEqual(["u.ts"]);
  });
});
