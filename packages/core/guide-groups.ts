/**
 * The changed-file list, arranged the way the walkthrough explains it.
 *
 * A Guided Review already tells the reviewer what the change is, in ordered
 * chapters with prose. It does that on a screen of its own, so the reviewer
 * reads the explanation and then goes back to a flat file tree that knows
 * nothing about it. This module joins the two: it turns a guide plus the files
 * currently under review into **groups** — a titled, explained set of files the
 * reviewer can open in the normal diff view.
 *
 * Three properties the flat tree cannot express, and this can:
 *
 *  - **A group carries an explanation.** The reviewer reads why a set of files
 *    belongs together before opening any of them.
 *  - **A file may belong to several groups.** A file touched for two reasons is
 *    explained twice, once under each. Overlap is the point, not a defect.
 *  - **Nothing disappears.** Any file no section placed lands in a trailing
 *    "Everything else" group, so grouping never hides a change.
 *
 * The file list handed in is already the list the reviewer sees, so generated
 * files excluded by `.gitattributes` are absent here for free — this module
 * never needs its own exclusion rule. A guide reference to a file that is not
 * in that list is dropped, matching the fail-closed rule the guide validator
 * already applies: a path the reviewer cannot open must never appear as a row.
 *
 * Pure and browser-safe. `GuideGroupsPanel` renders the result.
 */

/** Title of the trailing group holding whatever no section placed. */
export const EVERYTHING_ELSE_TITLE = "Everything else";

/** The part of a guide this module reads. */
export interface GroupableGuide {
  sections: readonly {
    title: string;
    overview: string;
    diffs: readonly { file: string; summary?: string }[];
  }[];
}

/** The part of a changed file this module reads. */
export interface GroupableFile {
  path: string;
  sourceAdditions: number;
  sourceDeletions: number;
}

/** One file inside a group, with the guide's note about it. */
export interface GuideGroupFile {
  path: string;
  /** The guide's one-line note for this file in THIS group. Absent when the
   *  engine omitted it, or for a file in "Everything else". */
  summary?: string;
  sourceAdditions: number;
  sourceDeletions: number;
}

/** A titled, explained set of changed files. */
export interface GuideGroup {
  title: string;
  /** Markdown prose explaining the group. Empty for "Everything else". */
  overview: string;
  files: GuideGroupFile[];
  /** Source lines across this group's files. A file in two groups counts in both. */
  additions: number;
  deletions: number;
}

/**
 * Arrange `files` into the guide's groups.
 *
 * Section order is preserved: a guide orders core work first and glue last, and
 * that order is the reading order. Returns an empty array when there is no
 * guide, so a caller can fall back to the flat tree.
 */
export function buildGuideGroups(
  guide: GroupableGuide | null | undefined,
  files: readonly GroupableFile[],
): GuideGroup[] {
  if (!guide || guide.sections.length === 0) return [];

  const byPath = new Map(files.map((file) => [file.path, file]));
  const placed = new Set<string>();
  const groups: GuideGroup[] = [];

  for (const section of guide.sections) {
    const groupFiles: GuideGroupFile[] = [];
    // Within one group a path appears once, even when the guide names it twice
    // — a duplicate row would double the group's count and read as an error.
    const inThisGroup = new Set<string>();
    for (const ref of section.diffs) {
      const file = byPath.get(ref.file);
      if (!file || inThisGroup.has(ref.file)) continue;
      inThisGroup.add(ref.file);
      placed.add(ref.file);
      groupFiles.push({
        path: file.path,
        ...(ref.summary ? { summary: ref.summary } : {}),
        sourceAdditions: file.sourceAdditions,
        sourceDeletions: file.sourceDeletions,
      });
    }
    groups.push({
      title: section.title,
      overview: section.overview,
      files: groupFiles,
      ...totals(groupFiles),
    });
  }

  const unplaced = files.filter((file) => !placed.has(file.path));
  if (unplaced.length > 0) {
    const rest = unplaced.map((file) => ({
      path: file.path,
      sourceAdditions: file.sourceAdditions,
      sourceDeletions: file.sourceDeletions,
    }));
    groups.push({
      title: EVERYTHING_ELSE_TITLE,
      overview: "",
      files: rest,
      ...totals(rest),
    });
  }

  return groups;
}

function totals(files: readonly GuideGroupFile[]): { additions: number; deletions: number } {
  return {
    additions: files.reduce((sum, file) => sum + file.sourceAdditions, 0),
    deletions: files.reduce((sum, file) => sum + file.sourceDeletions, 0),
  };
}
