/**
 * Which review threads are still open.
 *
 * A reviewer's comment and the agent's replies form one thread. The thread is
 * the unit of work: it is open until someone says the work is done, and then it
 * stops travelling to the agent. This module owns that rule for every consumer
 * — the annotations panel, the Send Feedback export, and the external ingest
 * an agent writes through.
 *
 * Two rules, and both matter:
 *
 *  1. **State lives on the root.** A reply never carries thread state. Reading
 *     it from a reply would let one thread be half-resolved.
 *  2. **Resolved is not deleted.** A resolved thread stays in the record and
 *     the reviewer can reopen it. Only its travel to the agent stops.
 *
 * Threading itself — which annotation is a reply to which — belongs to
 * `annotation-threads.ts`, and this module defers to it, cycles included.
 *
 * Browser-safe and dependency-free.
 *
 * ```
 * openThreadItems([{id:"a",resolved:true}, {id:"b",inReplyTo:"a"}, {id:"c"}])
 * // → [{id:"c"}]   the whole resolved thread stops travelling
 * ```
 */

import { resolveReplyParents, type ThreadableAnnotation } from "./annotation-threads";

/** Who marked a thread resolved. */
export type ThreadResolver = "user" | "agent";

/**
 * The thread fields, carried on a root. Additive everywhere they appear.
 *
 * `resolved` is the only authoritative field. `resolvedAt` and `resolvedBy`
 * mean something only while `resolved` is true, because the external
 * annotation store merges a PATCH and cannot delete a key: reopening a thread
 * there sets `resolved: false` and leaves the old stamps behind. Read them
 * through `threadResolution` rather than directly, and they can never be
 * reported as if they were current.
 */
export interface ResolvableAnnotation extends ThreadableAnnotation {
  resolved?: boolean;
  resolvedAt?: number;
  resolvedBy?: ThreadResolver;
}

/**
 * Who resolved this thread and when, or null when it is open.
 *
 * The one way to read the stamps. See `ResolvableAnnotation` for why reading
 * them directly is wrong.
 */
export function threadResolution(
  annotation: ResolvableAnnotation,
): { at?: number; by?: ThreadResolver } | null {
  if (annotation.resolved !== true) return null;
  return { at: annotation.resolvedAt, by: annotation.resolvedBy };
}

/**
 * The root of the thread `id` belongs to.
 *
 * Returns `id` itself for a root, an orphan, or a cycle member — the same
 * classification `annotation-threads` applies, so the panel and this module can
 * never disagree about where a thread starts.
 */
export function threadRootId<T extends ResolvableAnnotation>(
  items: readonly T[],
  id: string,
): string {
  const parents = resolveReplyParents(items);
  let current = id;
  // Bounded by the number of annotations: resolveReplyParents has already
  // broken cycles, so this walk always reaches a null parent.
  for (let step = 0; step <= items.length; step += 1) {
    const parent = parents.get(current);
    if (!parent) return current;
    current = parent;
  }
  return current;
}

/**
 * The annotations still travelling to the agent: every thread whose root is not
 * resolved, replies included.
 *
 * Order is preserved, so a caller can render or export the result directly.
 */
export function openThreadItems<T extends ResolvableAnnotation>(
  items: readonly T[],
): T[] {
  const parents = resolveReplyParents(items);
  const byId = new Map(items.map((item) => [item.id, item]));
  const resolvedRoots = new Set(
    items.filter((item) => item.resolved === true && !parents.get(item.id)).map((item) => item.id),
  );
  if (resolvedRoots.size === 0) return [...items];

  return items.filter((item) => {
    let current: string | undefined = item.id;
    for (let step = 0; step <= items.length && current; step += 1) {
      if (resolvedRoots.has(current)) return false;
      const parent: string | null | undefined = parents.get(current);
      if (!parent || !byId.has(parent)) break;
      current = parent;
    }
    return true;
  });
}

/**
 * Resolve or reopen the thread that `id` belongs to.
 *
 * Always writes to the thread's ROOT, so resolving from a reply resolves the
 * whole thread. Reopening clears the stamps rather than leaving a stale
 * resolver name behind. Returns a new array; the input is untouched.
 */
export function resolveThreadState<T extends ResolvableAnnotation>(
  items: readonly T[],
  id: string,
  resolved: boolean,
  by: ThreadResolver,
  now: number,
): T[] {
  const rootId = threadRootId(items, id);
  return items.map((item) => {
    if (item.id !== rootId) return item;
    if (!resolved) {
      const { resolvedAt: _at, resolvedBy: _by, ...rest } = item;
      return { ...(rest as T), resolved: false };
    }
    return { ...item, resolved: true, resolvedAt: now, resolvedBy: by };
  });
}
