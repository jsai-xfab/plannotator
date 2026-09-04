/**
 * What the reviewer had already read, remembered across sessions.
 *
 * A reviewer sends feedback, the agent edits, and the reviewer comes back. Without
 * a record of the first pass the reviewer reads the whole change again to find
 * the few files the agent touched. A **review round** is that record: the files
 * under review at the moment feedback was sent, each named by the exact content
 * the reviewer saw.
 *
 * The `since-review` diff type reads the newest round and compares it against the
 * working tree, so the second pass shows the agent's edits and nothing else.
 *
 * Content is identified by git blob id, never by line numbers — lines move, bytes
 * do not, and git can diff two blob ids directly. `baseCommit` records the
 * merge-base at send time so a later diff can tell an agent's edit from a commit
 * that arrived on the base branch.
 *
 * Modelled on `guide-store.ts`, which solved the same persistence problem:
 *
 *     ${PLANNOTATOR_DATA_DIR}/rounds/{repo-key}/{id}.json
 *
 * Same discipline as that store, and each rule earns its place. Writes are atomic
 * (tmp then rename) so a crash mid-write cannot leave half a round. A corrupt or
 * unreadable file reads as "no round" rather than throwing, because losing the
 * since-review view must never break the review session. Ids are validated so a
 * crafted id cannot write outside the directory. The store is capped, because
 * nothing else would ever delete an old round.
 *
 * Node-bound (`node:fs`), like the stores it sits beside. Repo keys come from
 * `guide-store`'s derivation helpers, so a PR review and a local review of the
 * same repository share one shelf.
 */

import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";

import { getPlannotatorDataDir } from "./data-dir";
import {
  deriveGuideRepoKeyFallback,
  deriveGuideRepoKeyFromPRUrl,
  deriveGuideRepoKeyFromRemote,
} from "./guide-store";

/**
 * Rounds kept per repository, newest first. A reviewer needs the last pass;
 * older ones are kept only so a mistaken send is recoverable.
 */
export const MAX_ROUNDS_PER_REPO = 20;

/** One file as the reviewer saw it. */
export interface ReviewRoundFile {
  path: string;
  /**
   * git blob id of the content under review. Empty for a file that had no blob
   * — an untracked file the reviewer saw only in the working tree.
   */
  objectId: string;
}

/** One completed review pass. */
export interface ReviewRound {
  version: 1;
  id: string;
  /** Epoch ms when the reviewer sent feedback. */
  createdAt: number;
  /** What was under review. Mirrors AgentJobDiffContext's shape. */
  diffContext: { mode: string; base?: string; label?: string };
  /**
   * Merge-base commit at send time. Lets `since-review` tell an agent's edit
   * from a commit that arrived on the base branch. Absent on a round written
   * where no merge-base applies.
   */
  baseCommit?: string;
  files: ReviewRoundFile[];
  /** Annotations sent in this round, so a later pass can show what they caused. */
  annotationIds: string[];
}

/**
 * The shelf a repository's rounds live on.
 *
 * Deliberately the SAME derivation the guide store uses, so a PR review and a
 * local review of one repository share a shelf while same-named branches in
 * different repositories never collide.
 */
export function resolveRoundRepoKey(input: {
  cwd: string;
  remoteUrl?: string | null;
  prUrl?: string | null;
}): string {
  if (input.prUrl) {
    const fromPR = deriveGuideRepoKeyFromPRUrl(input.prUrl);
    if (fromPR) return fromPR;
  }
  if (input.remoteUrl) {
    const fromRemote = deriveGuideRepoKeyFromRemote(input.remoteUrl);
    if (fromRemote) return fromRemote;
  }
  return deriveGuideRepoKeyFallback(input.cwd);
}

/** Where one repository's rounds live. Exported for tests and diagnostics. */
export function roundsDir(repoKey: string): string {
  return join(getPlannotatorDataDir(), "rounds", repoKey);
}

function roundPath(repoKey: string, id: string): string {
  return join(roundsDir(repoKey), `${id}.json`);
}

/**
 * An id must be one path segment. A round id is generated locally today, but
 * this store is one PATCH away from accepting one over HTTP.
 */
function isValidRoundId(id: string): boolean {
  return /^[A-Za-z0-9_.-]{1,200}$/.test(id) && id !== "." && id !== "..";
}

function isReviewRound(value: unknown): value is ReviewRound {
  if (!value || typeof value !== "object") return false;
  const round = value as Partial<ReviewRound>;
  return (
    round.version === 1 &&
    typeof round.id === "string" &&
    typeof round.createdAt === "number" &&
    Array.isArray(round.files)
  );
}

/**
 * Every round for a repository, newest first.
 *
 * A file that will not parse is skipped, not reported — the same skip-and-log
 * discipline the guide store applies.
 */
export function listRounds(repoKey: string): ReviewRound[] {
  const dir = roundsDir(repoKey);
  if (!existsSync(dir)) return [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const rounds: ReviewRound[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      if (isReviewRound(parsed)) rounds.push(parsed);
    } catch {
      // A corrupt round is not a broken review. Skip it.
    }
  }
  return rounds.sort((a, b) => b.createdAt - a.createdAt);
}

/** The most recent round, or null when the repository has none. */
export function loadLatestRound(repoKey: string): ReviewRound | null {
  return listRounds(repoKey)[0] ?? null;
}

/**
 * Write a round atomically, then trim the store to the cap.
 *
 * Returns false rather than throwing on an invalid id or a write failure:
 * recording a round must never break the send it belongs to.
 */
export function saveRound(repoKey: string, round: ReviewRound): boolean {
  if (!isValidRoundId(round.id)) return false;
  try {
    mkdirSync(roundsDir(repoKey), { recursive: true });
    const finalPath = roundPath(repoKey, round.id);
    const tmpPath = `${finalPath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(round, null, 2), "utf-8");
    renameSync(tmpPath, finalPath);
    trimRounds(repoKey);
    return true;
  } catch (e) {
    console.error(`[round-store] Failed to save round ${round.id}: ${e}`);
    return false;
  }
}

/** Delete the oldest rounds past the cap. Best-effort, like every write here. */
function trimRounds(repoKey: string): void {
  const rounds = listRounds(repoKey);
  for (const stale of rounds.slice(MAX_ROUNDS_PER_REPO)) {
    try {
      unlinkSync(roundPath(repoKey, stale.id));
    } catch {
      // A round that will not delete is not worth failing the save for.
    }
  }
}
