/**
 * The review-round store.
 *
 * A round records what the reviewer saw when they sent feedback, so the next
 * pass can show only what the agent changed. These tests hold the store to the
 * guide-store discipline it is modelled on: atomic writes, a corrupt file that
 * reads as absent rather than throwing, repositories that never collide, and a
 * cap so the store cannot grow without end.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  MAX_ROUNDS_PER_REPO,
  listRounds,
  loadLatestRound,
  roundsDir,
  saveRound,
  type ReviewRound,
} from "./round-store";

let dataDir: string;
const previous = process.env.PLANNOTATOR_DATA_DIR;

function round(over: Partial<ReviewRound> = {}): ReviewRound {
  return {
    version: 1,
    id: "r1",
    createdAt: 1,
    diffContext: { mode: "since-base", base: "main" },
    files: [{ path: "a.ts", objectId: "aaa" }],
    annotationIds: [],
    ...over,
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "pn-rounds-"));
  process.env.PLANNOTATOR_DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  if (previous === undefined) delete process.env.PLANNOTATOR_DATA_DIR;
  else process.env.PLANNOTATOR_DATA_DIR = previous;
});

describe("round-store", () => {
  it("writes a round and reads it back", () => {
    expect(saveRound("repo", round({ id: "r1" }))).toBe(true);
    const loaded = loadLatestRound("repo");
    expect(loaded?.id).toBe("r1");
    expect(loaded?.files[0].objectId).toBe("aaa");
  });

  it("reports no round for a repository that has none", () => {
    expect(loadLatestRound("empty")).toBeNull();
  });

  it("returns the most recent round, not the first", () => {
    saveRound("repo", round({ id: "old", createdAt: 10 }));
    saveRound("repo", round({ id: "new", createdAt: 20 }));
    expect(loadLatestRound("repo")?.id).toBe("new");
  });

  it("keeps two repositories apart", () => {
    saveRound("repo-a", round({ id: "a" }));
    saveRound("repo-b", round({ id: "b" }));
    expect(loadLatestRound("repo-a")?.id).toBe("a");
    expect(loadLatestRound("repo-b")?.id).toBe("b");
  });

  it("reads a corrupt file as absent rather than throwing", () => {
    mkdirSync(roundsDir("repo"), { recursive: true });
    writeFileSync(join(roundsDir("repo"), "broken.json"), "{ not json", "utf-8");
    expect(loadLatestRound("repo")).toBeNull();
    expect(listRounds("repo")).toEqual([]);
  });

  it("skips a corrupt file but still finds a good one", () => {
    saveRound("repo", round({ id: "good", createdAt: 5 }));
    writeFileSync(join(roundsDir("repo"), "broken.json"), "{ not json", "utf-8");
    expect(loadLatestRound("repo")?.id).toBe("good");
  });

  it("refuses an id that would escape the directory", () => {
    expect(saveRound("repo", round({ id: "../escape" }))).toBe(false);
    expect(saveRound("repo", round({ id: "" }))).toBe(false);
  });

  it("drops the oldest round past the cap", () => {
    for (let i = 0; i < MAX_ROUNDS_PER_REPO + 3; i += 1) {
      saveRound("repo", round({ id: `r${i}`, createdAt: i }));
    }
    const kept = listRounds("repo");
    expect(kept.length).toBe(MAX_ROUNDS_PER_REPO);
    // The newest survive; the three oldest are gone.
    expect(kept.some((r) => r.id === "r0")).toBe(false);
    expect(kept.some((r) => r.id === `r${MAX_ROUNDS_PER_REPO + 2}`)).toBe(true);
  });

  it("records the merge-base so a base move can be told apart later", () => {
    saveRound("repo", round({ id: "r1", baseCommit: "abc123" }));
    expect(loadLatestRound("repo")?.baseCommit).toBe("abc123");
  });
});
