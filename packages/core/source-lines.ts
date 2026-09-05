/**
 * Which changed lines of a diff are source code.
 *
 * A pull request reports how much it changed. That number should describe the
 * work a reviewer must read. A docstring rewrite and a logic rewrite are not
 * the same work, so this module counts source lines and skips comments and
 * blank lines.
 *
 * `countSourceLines` is the one home for the rule. `packages/core/diff-files.ts`
 * calls it for the review app, and `packages/shared/review-core.ts` calls it for
 * agent jobs. Those two counted lines separately before, and the server copy
 * described itself as a mirror of the client copy — two mirrors drift.
 *
 * This module never removes a line from a rendered diff. A comment gives a
 * reviewer context, so a comment stays on screen; it only stops adding to the
 * count.
 *
 * Only Python has a rule today. Every other language counts every changed line,
 * exactly as before, because an unknown language must never under-count —
 * under-counting hides real change.
 *
 * Browser-safe and dependency-free, like the diff helpers it serves.
 *
 * ```
 * countSourceLines(["@@ -1 +1 @@", "+# note", "+x = 1"], "python")
 * // → { additions: 1, deletions: 0 }
 * ```
 */

/** A language this module knows how to read. */
export type SourceLineLanguage = "python" | "unknown";

/** Added and removed source lines for one file of a diff. */
export interface SourceLineCounts {
  additions: number;
  deletions: number;
}

/**
 * The language rule that applies to a path. Extension-based: a diff carries
 * paths, never file contents, so nothing better is available here.
 */
export function languageForPath(path: string): SourceLineLanguage {
  return path.toLowerCase().endsWith(".py") ? "python" : "unknown";
}

/** Python's two block-string delimiters. Neither one closes the other. */
type BlockDelimiter = '"""' | "'''";

/**
 * How a Python reader carries state from one line to the next.
 *
 * `isDocstring` separates a bare string expression (a docstring — prose, not
 * counted) from a string opened inside an expression such as `s = """`, whose
 * body is program data and is counted.
 */
interface PythonState {
  delimiter: BlockDelimiter | null;
  isDocstring: boolean;
}

/** String prefixes Python allows before a quote, e.g. `r"""` or `rb'''`. */
const STRING_PREFIX = /^[a-z]{0,2}$/;

/**
 * Read one Python line and report whether it is source, given the state left by
 * the lines above it. Returns the state the next line inherits.
 */
function readPythonLine(
  line: string,
  state: PythonState,
): { isSource: boolean; state: PythonState } {
  if (state.delimiter) {
    const closeIndex = line.indexOf(state.delimiter);
    if (closeIndex === -1) {
      // Still inside the block. A docstring body is prose; any other block
      // string is program data.
      return { isSource: !state.isDocstring, state };
    }
    const after = line.slice(closeIndex + state.delimiter.length).trim();
    const closed: PythonState = { delimiter: null, isDocstring: false };
    if (after.length > 0) {
      // Code follows the closing quote on the same line, so the line is source
      // whatever the block was.
      return { isSource: true, state: closed };
    }
    return { isSource: !state.isDocstring, state: closed };
  }

  const trimmed = line.trim();
  if (trimmed.length === 0) return { isSource: false, state };
  if (trimmed.startsWith("#")) return { isSource: false, state };

  const opening = findBlockOpen(trimmed);
  if (!opening) return { isSource: true, state };

  // A bare string expression is a docstring. Anything before the quote — an
  // assignment, a call — makes the string program data instead.
  const isDocstring = STRING_PREFIX.test(trimmed.slice(0, opening.index).toLowerCase());
  const rest = trimmed.slice(opening.index + opening.delimiter.length);
  const closeIndex = rest.indexOf(opening.delimiter);

  if (closeIndex === -1) {
    return {
      isSource: !isDocstring,
      state: { delimiter: opening.delimiter, isDocstring },
    };
  }

  // Opened and closed on this line. Code after the close makes it source.
  const after = rest.slice(closeIndex + opening.delimiter.length).trim();
  return { isSource: !isDocstring || after.length > 0, state };
}

/** The first triple-quote on the line, whichever delimiter comes first. */
function findBlockOpen(line: string): { index: number; delimiter: BlockDelimiter } | null {
  const double = line.indexOf('"""');
  const single = line.indexOf("'''");
  if (double === -1 && single === -1) return null;
  if (single === -1 || (double !== -1 && double < single)) {
    return { index: double, delimiter: '"""' };
  }
  return { index: single, delimiter: "'''" };
}

/**
 * One side of one hunk, read line by line, with the unclosed-block rule applied.
 *
 * A hunk shows a window into a file, so a docstring it opens may close outside
 * that window. Suppressing everything after such an opening hides real code —
 * a `def` and its body can vanish from the count. When a docstring is still
 * open at the end of the hunk, the lines from its opening onward are counted
 * instead. Under-counting hides change; over-counting only wastes a little
 * attention, so the tie breaks toward counting.
 */
function countHunkSide(bodies: readonly { body: string; counts: boolean }[]): number {
  let state: PythonState = { delimiter: null, isDocstring: false };
  const isSource: boolean[] = [];
  // Where the still-open docstring started, or -1 when no block is open.
  let openedAt = -1;

  for (let i = 0; i < bodies.length; i += 1) {
    const wasOpen = state.delimiter !== null;
    const read = readPythonLine(bodies[i].body, state);
    if (!wasOpen && read.state.delimiter !== null && read.state.isDocstring) openedAt = i;
    if (wasOpen && read.state.delimiter === null) openedAt = -1;
    state = read.state;
    isSource.push(read.isSource);
  }

  if (state.delimiter !== null && state.isDocstring && openedAt >= 0) {
    // Recover the suppressed tail, but keep the two rules that hold whether or
    // not a docstring is open: a blank line and a `#` comment are never source.
    for (let i = openedAt; i < isSource.length; i += 1) {
      const trimmed = bodies[i].body.trim();
      isSource[i] = trimmed.length > 0 && !trimmed.startsWith("#");
    }
  }

  let total = 0;
  for (let i = 0; i < bodies.length; i += 1) {
    if (bodies[i].counts && isSource[i]) total += 1;
  }
  return total;
}

/**
 * Count the source lines a file's diff adds and removes.
 *
 * `lines` are the raw lines of one file's chunk, headers included. Lines above
 * the first hunk are skipped.
 *
 * Each hunk is read separately, and within it each side separately. An added
 * line belongs to the new file and a removed line to the old one, so one mixed
 * pass would leak a removed docstring's state onto the additions. Hunks are
 * independent because a hunk starts at an unknown place in the file and can
 * carry no block state across the gap.
 */
export function countSourceLines(
  lines: readonly string[],
  language: SourceLineLanguage,
): SourceLineCounts {
  if (language !== "python") return countEveryChangedLine(lines);

  let additions = 0;
  let deletions = 0;
  let newSide: { body: string; counts: boolean }[] = [];
  let oldSide: { body: string; counts: boolean }[] = [];
  let inHunk = false;

  const finishHunk = () => {
    additions += countHunkSide(newSide);
    deletions += countHunkSide(oldSide);
    newSide = [];
    oldSide = [];
  };

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (inHunk) finishHunk();
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"

    const body = line.slice(1);
    if (line.startsWith("+")) {
      newSide.push({ body, counts: true });
    } else if (line.startsWith("-")) {
      oldSide.push({ body, counts: true });
    } else {
      // A context line sits in both files and counts in neither, but it still
      // moves each side's block state.
      newSide.push({ body, counts: false });
      oldSide.push({ body, counts: false });
    }
  }
  if (inHunk) finishHunk();

  return { additions, deletions };
}

/** The rule for a language with no rule: every changed line counts. */
function countEveryChangedLine(lines: readonly string[]): SourceLineCounts {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}
