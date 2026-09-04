import { describe, expect, it } from "bun:test";

import {
  openThreadItems,
  resolveThreadState,
  threadResolution,
  threadRootId,
} from "./thread-resolution";

const base = { createdA: 0 };

describe("threadRootId", () => {
  it("returns the annotation itself when it is a root", () => {
    const items = [{ ...base, id: "a" }];
    expect(threadRootId(items, "a")).toBe("a");
  });

  it("walks a reply up to its root", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "b", inReplyTo: "a" },
      { ...base, id: "c", inReplyTo: "b" },
    ];
    expect(threadRootId(items, "c")).toBe("a");
  });

  it("treats an orphan as its own root", () => {
    const items = [{ ...base, id: "b", inReplyTo: "missing" }];
    expect(threadRootId(items, "b")).toBe("b");
  });
});

describe("openThreadItems", () => {
  it("keeps everything when nothing is resolved", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "b", inReplyTo: "a" },
    ];
    expect(openThreadItems(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("drops a resolved root and every reply under it", () => {
    const items = [
      { ...base, id: "a", resolved: true },
      { ...base, id: "b", inReplyTo: "a" },
      { ...base, id: "c" },
    ];
    expect(openThreadItems(items).map((i) => i.id)).toEqual(["c"]);
  });

  it("ignores resolved on a reply, because a thread resolves as a unit", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "b", inReplyTo: "a", resolved: true },
    ];
    expect(openThreadItems(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("keeps a thread whose root was reopened", () => {
    const items = [{ ...base, id: "a", resolved: false }];
    expect(openThreadItems(items).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("threadResolution", () => {
  it("reports who resolved an open-and-closed thread", () => {
    expect(
      threadResolution({ id: "a", resolved: true, resolvedBy: "agent", resolvedAt: 7 }),
    ).toEqual({ by: "agent", at: 7 });
  });

  it("reports nothing for an open thread", () => {
    expect(threadResolution({ id: "a" })).toBeNull();
  });

  it("ignores stamps the external store could not delete on reopen", () => {
    // The store merges a PATCH, so `resolved: false` can arrive beside the old
    // stamps. `resolved` is authoritative; the stamps must not be reported.
    expect(
      threadResolution({ id: "a", resolved: false, resolvedBy: "user", resolvedAt: 7 }),
    ).toBeNull();
  });
});

describe("resolveThreadState", () => {
  it("marks the root resolved and stamps who did it", () => {
    const items = [{ ...base, id: "a" }];
    const next = resolveThreadState(items, "a", true, "user", 1000);
    expect(next[0]).toMatchObject({ resolved: true, resolvedBy: "user", resolvedAt: 1000 });
  });

  it("resolves the ROOT when a reply is the target", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "b", inReplyTo: "a" },
    ];
    const next = resolveThreadState(items, "b", true, "user", 1000);
    expect(next.find((i) => i.id === "a")?.resolved).toBe(true);
    expect(next.find((i) => i.id === "b")?.resolved).toBeUndefined();
  });

  it("clears the stamps when a thread is reopened", () => {
    const items = [{ ...base, id: "a", resolved: true, resolvedBy: "agent" as const, resolvedAt: 5 }];
    const next = resolveThreadState(items, "a", false, "user", 1000);
    expect(next[0]).toMatchObject({ resolved: false });
    expect(next[0].resolvedBy).toBeUndefined();
    expect(next[0].resolvedAt).toBeUndefined();
  });

  it("leaves other threads untouched", () => {
    const items = [
      { ...base, id: "a" },
      { ...base, id: "z" },
    ];
    const next = resolveThreadState(items, "a", true, "user", 1000);
    expect(next.find((i) => i.id === "z")?.resolved).toBeUndefined();
  });
});
