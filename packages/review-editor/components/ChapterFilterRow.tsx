import React from 'react';

import { SidebarActionRow } from './PanelNavRows';

/**
 * The control that narrows the file tree to the guide chapter being read.
 *
 * Guided Review walks a changeset one chapter at a time. The tree lights that
 * chapter's rows, which answers "where do these files sit" — one cohesive
 * package, or four scattered ones. A large branch can still bury eight lit rows
 * among two hundred, and this row hides the rest.
 *
 * Off by default, and that default is deliberate: a reader who loses the
 * surrounding tree also loses the repository shape, which is the only reason
 * the tree stays open during a guide. The filter is for a reader who already
 * has the shape and now wants to work.
 *
 * It renders in the file panel only while a guide is open and a chapter has
 * files. `App.tsx` owns the state; `FileTree` places the row.
 */
export function ChapterFilterRow({
  chapterFileCount,
  filtering,
  onToggle,
}: {
  /** Files in the chapter being read. The row is not rendered when zero. */
  chapterFileCount: number;
  /** True when the tree currently shows only that chapter. */
  filtering: boolean;
  onToggle: () => void;
}) {
  if (chapterFileCount <= 0) return null;

  const label = filtering
    ? `Chapter only · ${chapterFileCount} ${chapterFileCount === 1 ? 'file' : 'files'}`
    : `Filter to chapter · ${chapterFileCount} ${chapterFileCount === 1 ? 'file' : 'files'}`;

  return (
    <SidebarActionRow
      active={filtering}
      onClick={onToggle}
      title={
        filtering
          ? 'Show every file again, with the chapter still highlighted'
          : 'Hide every file outside the chapter you are reading'
      }
    >
      <span
        className="w-3.5 h-3.5 flex flex-shrink-0 items-center justify-center font-mono"
        aria-hidden="true"
      >
        {filtering ? '◉' : '◌'}
      </span>
      <span className="truncate" data-testid="chapter-filter-label">{label}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">
        {filtering ? 'All' : 'Only'}
      </span>
    </SidebarActionRow>
  );
}
