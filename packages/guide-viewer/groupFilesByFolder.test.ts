import { describe, it, expect } from 'bun:test';
import { groupFilesByFolder } from './groupFilesByFolder';
import type { DiffFile } from './types';

function file(path: string, additions = 1, deletions = 0): DiffFile {
  return { path, patch: '', additions, deletions, status: 'modified', sourceAdditions: additions, sourceDeletions: deletions } as DiffFile;
}

describe('groupFilesByFolder', () => {
  it('keeps the guide order of folders and of files inside them', () => {
    // The guide orders files by importance. Sorting alphabetically here would
    // throw away the one signal the chapter carries.
    const groups = groupFilesByFolder([
      file('src/zeta.ts'),
      file('src/alpha.ts'),
      file('docs/readme.md'),
      file('src/mid.ts'),
    ]);

    expect(groups.map((g) => g.folder)).toEqual(['src', 'docs']);
    expect(groups[0].files.map((f) => f.path)).toEqual(['src/zeta.ts', 'src/alpha.ts', 'src/mid.ts']);
  });

  it('sums each folder’s additions and deletions', () => {
    const groups = groupFilesByFolder([
      file('src/a.ts', 10, 2),
      file('src/b.ts', 5, 3),
      file('docs/c.md', 1, 0),
    ]);

    expect(groups[0]).toMatchObject({ folder: 'src', additions: 15, deletions: 5 });
    expect(groups[1]).toMatchObject({ folder: 'docs', additions: 1, deletions: 0 });
  });

  it('puts a repository-root file in its own group', () => {
    const groups = groupFilesByFolder([file('README.md'), file('src/a.ts')]);

    expect(groups[0].folder).toBe('');
    expect(groups[0].files.map((f) => f.path)).toEqual(['README.md']);
  });

  it('returns nothing for no files', () => {
    expect(groupFilesByFolder([])).toEqual([]);
  });
});
