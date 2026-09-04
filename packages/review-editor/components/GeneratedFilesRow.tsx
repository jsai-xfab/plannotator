import React from 'react';

import { SidebarActionRow } from './PanelNavRows';

/**
 * The control that puts generated files back into the review.
 *
 * A pull request diff shows source code by default: files marked
 * `linguist-generated` in `.gitattributes` — lockfiles, vendored trees, whole
 * generated test suites — leave the file tree, so the reviewer reads the code a
 * human wrote. This row is how the reviewer sees the rest.
 *
 * It renders in the file panel under "All files", and only when the current
 * diff actually hides something. The count is not optional: a reviewer who
 * cannot see that files are hidden cannot tell a filtered diff from a small
 * one.
 *
 * `App.tsx` owns the state and passes `onToggle`; `FileTree` places the row.
 */
export function GeneratedFilesRow({
  hiddenCount,
  showing,
  onToggle,
}: {
  /** Generated files in the current diff. The row is not rendered when zero. */
  hiddenCount: number;
  /** True when generated files are currently in the tree. */
  showing: boolean;
  onToggle: () => void;
}) {
  if (hiddenCount <= 0) return null;

  const label = showing
    ? 'Showing all files'
    : `${hiddenCount} generated ${hiddenCount === 1 ? 'file' : 'files'} hidden`;

  return (
    <SidebarActionRow
      active={false}
      onClick={onToggle}
      title={
        showing
          ? 'Hide files marked linguist-generated and review source only'
          : 'Show files marked linguist-generated in .gitattributes'
      }
    >
      <span
        className="w-3.5 h-3.5 flex flex-shrink-0 items-center justify-center font-mono"
        aria-hidden="true"
      >
        {showing ? '◉' : '◌'}
      </span>
      <span className="truncate" data-testid="generated-files-label">{label}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">
        {showing ? 'Hide' : 'Show'}
      </span>
    </SidebarActionRow>
  );
}
