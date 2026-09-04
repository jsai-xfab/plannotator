import React, { useState } from 'react';
import type { DiffFile } from '../types';
import type { CodeAnnotation } from '@plannotator/ui/types';
import { buildGuideGroups, type GroupableGuide } from '@plannotator/shared/guide-groups';
import { TruncatedPath, ViewedControl } from './FileRowBits';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';

/**
 * The file panel, arranged the way the walkthrough explains the change.
 *
 * The flat tree lists files in path order, which is the one order that carries
 * no meaning. This panel lists them in the Guided Review's order instead: each
 * group is a titled set of files with the guide's prose above it, and opening a
 * file works exactly as it does in the tree — the same diff, the same viewed
 * checkbox, the same annotations.
 *
 * Where it sits: `buildGuideGroups` (in `@plannotator/core`) owns the grouping
 * rule and this owns the rendering. `App.tsx` supplies the guide and the file
 * list, and the panel toggle chooses between this, the tree, and Git status.
 *
 * Two behaviours a reader should expect before reading the code:
 *
 *  - **A file can appear in more than one group.** A file touched for two
 *    reasons is explained under each. That is the feature, not double-counting.
 *  - **Nothing is hidden.** Files no section placed appear under "Everything
 *    else". Generated files are already absent from `files` before this runs.
 */
export const GuideGroupsPanel: React.FC<{
  guide: GroupableGuide | null;
  files: DiffFile[];
  activeFileIndex: number;
  annotations: CodeAnnotation[];
  viewedFiles: Set<string>;
  onSelectFile: (index: number) => void;
  onDoubleClickFile?: (index: number) => void;
  onToggleViewed: (path: string) => void;
  /** Rendered above the groups — the panel view toggle and its neighbours. */
  panelControls?: React.ReactNode;
}> = ({
  guide,
  files,
  activeFileIndex,
  annotations,
  viewedFiles,
  onSelectFile,
  onDoubleClickFile,
  onToggleViewed,
  panelControls,
}) => {
  const groups = buildGuideGroups(guide, files);
  // Collapsed by title: a reviewer folds away a group they have finished, and
  // the choice survives re-renders without needing to leave the session.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const activePath = files[activeFileIndex]?.path;

  const toggleGroup = (title: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {panelControls}
        <div className="py-6 px-3 text-center text-xs text-muted-foreground/60">
          No walkthrough yet. Generate a Guided Review to group these files by what
          they do.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {panelControls}
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.title);
        return (
          <div key={group.title} className="border-b border-border/40 last:border-b-0">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 hover:bg-muted/40 transition-colors"
              title={isCollapsed ? 'Show this group' : 'Hide this group'}
              data-testid="guide-group-header"
            >
              <span className="w-3 text-[9px] text-muted-foreground" aria-hidden="true">
                {isCollapsed ? '▸' : '▾'}
              </span>
              <span className="text-[11px] font-medium truncate flex-1">{group.title}</span>
              <span className="text-[10px] tabular-nums opacity-60 flex-shrink-0">
                <span className="text-green-500">+{group.additions}</span>{' '}
                <span className="text-red-500">-{group.deletions}</span>
              </span>
            </button>
            {!isCollapsed && (
              <>
                {group.overview && (
                  <div
                    className="px-3 pb-1.5 text-[11px] leading-relaxed text-muted-foreground/80"
                    data-testid="guide-group-overview"
                  >
                    {renderInlineMarkdown(group.overview)}
                  </div>
                )}
                {group.files.map((groupFile) => {
                  // Index into `files`, because every selection handler in the
                  // review addresses a file by its position in that one list.
                  const index = files.findIndex((f) => f.path === groupFile.path);
                  if (index === -1) return null;
                  const annotationCount = annotations.filter(
                    (a) => a.filePath === groupFile.path,
                  ).length;
                  return (
                    <div key={`${group.title}:${groupFile.path}`}>
                      <button
                        onClick={() => onSelectFile(index)}
                        onDoubleClick={() => onDoubleClickFile?.(index)}
                        className={`file-tree-item w-full text-left group ${
                          activePath === groupFile.path ? 'active' : ''
                        } ${annotationCount > 0 ? 'has-annotations' : ''}`}
                        style={{ paddingLeft: 20 }}
                        title={groupFile.path}
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <ViewedControl
                            isViewed={viewedFiles.has(groupFile.path)}
                            onToggle={() => onToggleViewed(groupFile.path)}
                            forceVisible={activePath === groupFile.path}
                          />
                          <TruncatedPath path={groupFile.path} />
                        </div>
                        <span className="text-[10px] tabular-nums opacity-60 flex-shrink-0">
                          <span className="text-green-500">+{groupFile.sourceAdditions}</span>{' '}
                          <span className="text-red-500">-{groupFile.sourceDeletions}</span>
                        </span>
                      </button>
                      {groupFile.summary && (
                        <div
                          className="pl-[38px] pr-3 pb-1 text-[10px] leading-snug text-muted-foreground/60"
                          data-testid="guide-group-file-summary"
                        >
                          {groupFile.summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
