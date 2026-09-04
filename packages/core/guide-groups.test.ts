import { describe, expect, it } from "bun:test";

import { EVERYTHING_ELSE_TITLE, buildGuideGroups } from "./guide-groups";

const file = (path: string, sourceAdditions = 1, sourceDeletions = 0) => ({
  path,
  sourceAdditions,
  sourceDeletions,
});

const guide = {
  title: "Change",
  intent: "why",
  sections: [
    {
      title: "Payment module",
      overview: "The core change.",
      diffs: [{ file: "pay/core.ts", summary: "adds the module" }],
    },
    {
      title: "Wiring",
      overview: "How it is reached.",
      diffs: [{ file: "app/routes.ts" }],
    },
  ],
};

describe("buildGuideGroups", () => {
  it("groups files under their section, keeping section order", () => {
    const groups = buildGuideGroups(guide, [file("pay/core.ts"), file("app/routes.ts")]);
    expect(groups.map((g) => g.title)).toEqual(["Payment module", "Wiring"]);
    expect(groups[0].files.map((f) => f.path)).toEqual(["pay/core.ts"]);
  });

  it("carries the section's explanation", () => {
    const groups = buildGuideGroups(guide, [file("pay/core.ts"), file("app/routes.ts")]);
    expect(groups[0].overview).toBe("The core change.");
  });

  it("carries the per-file summary when the guide gave one", () => {
    const groups = buildGuideGroups(guide, [file("pay/core.ts"), file("app/routes.ts")]);
    expect(groups[0].files[0].summary).toBe("adds the module");
    expect(groups[1].files[0].summary).toBeUndefined();
  });

  it("lets one file belong to several groups", () => {
    const overlapping = {
      ...guide,
      sections: [
        { title: "A", overview: "", diffs: [{ file: "shared.ts" }] },
        { title: "B", overview: "", diffs: [{ file: "shared.ts" }] },
      ],
    };
    const groups = buildGuideGroups(overlapping, [file("shared.ts")]);
    expect(groups[0].files.map((f) => f.path)).toEqual(["shared.ts"]);
    expect(groups[1].files.map((f) => f.path)).toEqual(["shared.ts"]);
  });

  it("collects a file no section placed into Everything else", () => {
    const groups = buildGuideGroups(guide, [
      file("pay/core.ts"),
      file("app/routes.ts"),
      file("stray.ts"),
    ]);
    const last = groups[groups.length - 1];
    expect(last.title).toBe(EVERYTHING_ELSE_TITLE);
    expect(last.files.map((f) => f.path)).toEqual(["stray.ts"]);
  });

  it("adds no Everything else group when every file is placed", () => {
    const groups = buildGuideGroups(guide, [file("pay/core.ts"), file("app/routes.ts")]);
    expect(groups.some((g) => g.title === EVERYTHING_ELSE_TITLE)).toBe(false);
  });

  it("drops a reference to a file that is not in the diff", () => {
    // A generated file the reviewer hid, or a path the guide named that no
    // longer changes. It must not appear as an empty row.
    const groups = buildGuideGroups(guide, [file("pay/core.ts")]);
    expect(groups.find((g) => g.title === "Wiring")?.files).toEqual([]);
  });

  it("keeps a prose-only section, because that is a valid guide output", () => {
    const prose = {
      ...guide,
      sections: [{ title: "Context", overview: "Read this first.", diffs: [] }],
    };
    const groups = buildGuideGroups(prose, [file("a.ts")]);
    expect(groups[0].title).toBe("Context");
    expect(groups[0].files).toEqual([]);
  });

  it("counts a group by the source lines of its files", () => {
    const groups = buildGuideGroups(guide, [
      file("pay/core.ts", 10, 2),
      file("app/routes.ts", 3, 1),
    ]);
    expect(groups[0].additions).toBe(10);
    expect(groups[0].deletions).toBe(2);
  });

  it("counts a file once per group even when the guide names it twice", () => {
    const twice = {
      ...guide,
      sections: [{ title: "A", overview: "", diffs: [{ file: "a.ts" }, { file: "a.ts" }] }],
    };
    const groups = buildGuideGroups(twice, [file("a.ts", 5, 0)]);
    expect(groups[0].files.length).toBe(1);
    expect(groups[0].additions).toBe(5);
  });

  it("returns nothing when there is no guide", () => {
    expect(buildGuideGroups(null, [file("a.ts")])).toEqual([]);
  });
});
