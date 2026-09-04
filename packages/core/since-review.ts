/**
 * What changed since the reviewer's last pass.
 *
 * After a reviewer sends feedback the agent edits, and the reviewer comes back
 * to a diff that looks exactly as large as before. This module answers the
 * question that second pass actually asks: which files moved since I last
 * looked, and which of those moved because of *me* rather than because the base
 * branch advanced underneath us.
 *
 * It compares the content recorded in a review round (`round-store.ts`) against
 * the content now, by git blob id. Blob ids are exact bytes, so a file whose id
 * is unchanged needs no reading at all — no line numbers, no heuristics.
 *
 * Pure: callers supply the blob ids, this decides. That keeps the rule testable
 * without a repository, and keeps every git call on the server side.
 *
 * ```
 * classifySinceReview({
 *   roundFiles: [{ path: "a.ts", objectId: "A1" }],
 *   currentById: { "a.ts": "A2" }, baseAtRound: {}, baseNow: {},
 * })
 * // → { changed: [{ path: "a.ts", status: "modified" }], hiddenFromBase: [] }
 * ```
 */

/** One file as a review round recorded it. */
export interface RoundFileRef {
  path: string;
  /** git blob id the reviewer saw. Empty when the file had no blob. */
  objectId: string;
}

/** How a file moved since the round. */
export type SinceReviewStatus = "added" | "modified" | "deleted";

export interface SinceReviewFile {
  path: string;
  status: SinceReviewStatus;
  /** The blob the reviewer saw. Empty for a file that is new to them. */
  reviewedObjectId: string;
  /** The blob now. Empty for a deleted file. */
  currentObjectId: string;
}

export interface SinceReviewInput {
  /** Files the round recorded. */
  roundFiles: readonly RoundFileRef[];
  /** Blob id per path now. A path absent here is deleted. */
  currentById: Readonly<Record<string, string>>;
  /** Blob id per path at the round's merge-base. */
  baseAtRound: Readonly<Record<string, string>>;
  /** Blob id per path at the current merge-base. */
  baseNow: Readonly<Record<string, string>>;
}

export interface SinceReviewResult {
  /** Files to show, in round order first, then paths new since the round. */
  changed: SinceReviewFile[];
  /** Paths whose whole change came from the base branch. Reported, never silent. */
  hiddenFromBase: string[];
}

/**
 * A file's change comes from the base branch alone when the reviewer saw the
 * OLD base content and now sees the NEW base content. Then nothing but upstream
 * touched it.
 *
 * When only one side matches, the base and the agent both had a hand in it.
 * Such a file is shown whole: splitting one file's diff into two sources
 * misleads more than showing all of it.
 */
function isBaseOnlyMove(
  path: string,
  reviewedObjectId: string,
  currentObjectId: string,
  { baseAtRound, baseNow }: Pick<SinceReviewInput, "baseAtRound" | "baseNow">,
): boolean {
  const wasBase = baseAtRound[path];
  const isBase = baseNow[path];
  if (!wasBase || !isBase) return false;
  return reviewedObjectId === wasBase && currentObjectId === isBase;
}

/**
 * Split the current state into what the reviewer must read and what the base
 * branch moved underneath them.
 *
 * A file whose blob id is unchanged appears in neither list: the reviewer has
 * already read those exact bytes.
 */
export function classifySinceReview(input: SinceReviewInput): SinceReviewResult {
  const { roundFiles, currentById } = input;
  const changed: SinceReviewFile[] = [];
  const hiddenFromBase: string[] = [];
  const seen = new Set<string>();

  for (const file of roundFiles) {
    seen.add(file.path);
    const currentObjectId = currentById[file.path];
    if (currentObjectId === undefined) {
      changed.push({
        path: file.path,
        status: "deleted",
        reviewedObjectId: file.objectId,
        currentObjectId: "",
      });
      continue;
    }
    // An empty recorded id means the reviewer saw content git had no blob for
    // (an untracked file). It can never match, so such a file always shows —
    // the safe direction: showing too much wastes time, hiding loses a change.
    if (file.objectId && currentObjectId === file.objectId) continue;
    if (isBaseOnlyMove(file.path, file.objectId, currentObjectId, input)) {
      hiddenFromBase.push(file.path);
      continue;
    }
    changed.push({
      path: file.path,
      status: "modified",
      reviewedObjectId: file.objectId,
      currentObjectId,
    });
  }

  for (const [path, currentObjectId] of Object.entries(currentById)) {
    if (seen.has(path)) continue;
    if (isBaseOnlyMove(path, "", currentObjectId, input)) {
      hiddenFromBase.push(path);
      continue;
    }
    changed.push({
      path,
      status: "added",
      reviewedObjectId: "",
      currentObjectId,
    });
  }

  return { changed, hiddenFromBase };
}
