import { describe, expect, it } from "bun:test";

import { countSourceLines, languageForPath } from "./source-lines";

/** Build a one-file unified diff body from hunk lines. */
function hunk(...lines: string[]): string[] {
  return ["@@ -1,1 +1,1 @@", ...lines];
}

describe("languageForPath", () => {
  it("recognises python by extension", () => {
    expect(languageForPath("worldmodel/graph.py")).toBe("python");
  });

  it("treats every other extension as unknown", () => {
    expect(languageForPath("src/app.ts")).toBe("unknown");
    expect(languageForPath("README.md")).toBe("unknown");
    expect(languageForPath("Makefile")).toBe("unknown");
  });
});

describe("countSourceLines — unknown language", () => {
  it("counts every changed line, so an unknown language never under-counts", () => {
    const counts = countSourceLines(hunk("+# a comment", "+code = 1", "-", "-old"), "unknown");
    expect(counts.additions).toBe(2);
    expect(counts.deletions).toBe(2);
  });
});

describe("countSourceLines — python", () => {
  it("does not count a full-line comment", () => {
    expect(countSourceLines(hunk("+    # explain the guard"), "python").additions).toBe(0);
  });

  it("counts a line with a trailing comment", () => {
    expect(countSourceLines(hunk("+x = 1  # trailing comment"), "python").additions).toBe(1);
  });

  it("does not count a blank line", () => {
    expect(countSourceLines(hunk("+", "+   "), "python").additions).toBe(0);
  });

  it("does not count a one-line docstring", () => {
    expect(countSourceLines(hunk('+    """Return the graph."""'), "python").additions).toBe(0);
  });

  it("does not count any line of a multi-line docstring", () => {
    const counts = countSourceLines(
      hunk('+    """', "+    Explain the function.", "+", '+    """', "+    return 1"),
      "python",
    );
    expect(counts.additions).toBe(1);
  });

  it("counts an assigned triple-quoted string, because it is data not a comment", () => {
    const counts = countSourceLines(hunk('+s = """text"""'), "python");
    expect(counts.additions).toBe(1);
  });

  it("counts every line of an assigned multi-line string", () => {
    const counts = countSourceLines(hunk('+s = """', "+body", '+"""'), "python");
    expect(counts.additions).toBe(3);
  });

  it("counts code that follows a closing docstring on the same line", () => {
    const counts = countSourceLines(hunk('+"""doc', '+""" ; x = 1'), "python");
    expect(counts.additions).toBe(1);
  });

  it("does not count a docstring opened with a string prefix", () => {
    expect(countSourceLines(hunk('+    r"""raw doc"""'), "python").additions).toBe(0);
  });

  it("tracks the old and new sides independently", () => {
    // The removed lines open a docstring; the added lines do not. Tracking one
    // mixed sequence would leak the removed docstring state onto the additions.
    const counts = countSourceLines(
      hunk('-    """', "-    old doc", '-    """', "+    return 1"),
      "python",
    );
    expect(counts.additions).toBe(1);
    expect(counts.deletions).toBe(0);
  });

  it("counts context lines on neither side", () => {
    const counts = countSourceLines(hunk(" context = 1", "+added = 2"), "python");
    expect(counts.additions).toBe(1);
    expect(counts.deletions).toBe(0);
  });

  it("ignores diff headers above the first hunk", () => {
    const counts = countSourceLines(
      [
        "diff --git a/a.py b/a.py",
        "index 111..222 100644",
        "--- a/a.py",
        "+++ b/a.py",
        "@@ -1 +1 @@",
        "+x = 1",
      ],
      "python",
    );
    expect(counts.additions).toBe(1);
    expect(counts.deletions).toBe(0);
  });

  it("ignores the no-newline marker", () => {
    const counts = countSourceLines(hunk("+x = 1", "\\ No newline at end of file"), "python");
    expect(counts.additions).toBe(1);
  });

  it("uses a docstring closed by a different quote style only when it matches", () => {
    // A ''' inside a """ docstring does not close it.
    const counts = countSourceLines(
      hunk('+"""', "+'''", '+"""', "+x = 1"),
      "python",
    );
    expect(counts.additions).toBe(1);
  });
});
