import type { DiffFile } from './types';

/**
 * One folder's files inside a guide chapter, with the folder's own totals.
 *
 * Used only by the chapter's collapsed diff view, where every file is a single
 * row and the reader is scanning for shape rather than reading code. Grouping
 * answers the question a flat list of twenty rows cannot: how much of this
 * chapter is one package, and how much is scattered.
 */
export interface GuideFolderGroup {
  /** Repo-relative directory, or '' for a file at the repository root. */
  folder: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
}

/** The directory part of a repo-relative path, or '' at the root. */
function folderOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash) : '';
}

/**
 * Group a chapter's files by their directory.
 *
 * Order is the guide's own: folders appear in the order their first file does,
 * and files keep their order inside a folder. The guide orders files by
 * importance, so re-sorting alphabetically here would throw away the one
 * signal the chapter carries.
 */
export function groupFilesByFolder(files: DiffFile[]): GuideFolderGroup[] {
  const groups: GuideFolderGroup[] = [];
  const byFolder = new Map<string, GuideFolderGroup>();

  for (const file of files) {
    const folder = folderOf(file.path);
    let group = byFolder.get(folder);
    if (!group) {
      group = { folder, files: [], additions: 0, deletions: 0 };
      byFolder.set(folder, group);
      groups.push(group);
    }
    group.files.push(file);
    group.additions += file.additions;
    group.deletions += file.deletions;
  }

  return groups;
}
