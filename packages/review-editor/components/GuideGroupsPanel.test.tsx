/**
 * DOM-gated tests (DOM_TESTS=1) for the walkthrough Groups panel.
 *
 * The behaviours under guard:
 *  - groups render in the guide's order, each with its explanation;
 *  - one file appears under every group that claims it (overlap is the point);
 *  - a file no section placed still appears, under "Everything else";
 *  - clicking a file selects it by its index in the review's file list;
 *  - a group collapses and expands;
 *  - with no guide the panel says so instead of rendering an empty tree.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { GuideGroupsPanel } from './GuideGroupsPanel';
import type { DiffFile } from '../types';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function file(path: string): DiffFile {
  return {
    path,
    patch: '',
    additions: 2,
    deletions: 1,
    sourceAdditions: 2,
    sourceDeletions: 1,
    status: 'modified',
  };
}

const guide = {
  sections: [
    {
      title: 'Payment module',
      overview: 'The core change lives here.',
      diffs: [{ file: 'pay/core.ts', summary: 'adds the module' }, { file: 'shared.ts' }],
    },
    { title: 'Wiring', overview: 'How it is reached.', diffs: [{ file: 'shared.ts' }] },
  ],
};

const files = [file('pay/core.ts'), file('shared.ts'), file('stray.ts')];

function mount(node: React.ReactElement): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

function panel(over: Partial<React.ComponentProps<typeof GuideGroupsPanel>> = {}) {
  return (
    <GuideGroupsPanel
      guide={guide}
      files={files}
      activeFileIndex={0}
      annotations={[]}
      viewedFiles={new Set()}
      onSelectFile={() => {}}
      onToggleViewed={() => {}}
      {...over}
    />
  );
}

function headers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="guide-group-header"]')].map(
    (el) => el.textContent?.replace(/[+\-\d\s]+$/, '').replace(/^[▸▾]\s*/, '').trim() ?? '',
  );
}

describe('GuideGroupsPanel', () => {
  test('renders groups in the guide order, then Everything else', () => {
    const container = mount(panel());
    expect(headers(container)).toEqual(['Payment module', 'Wiring', 'Everything else']);
  });

  test('shows each group its explanation', () => {
    const container = mount(panel());
    const overviews = [...container.querySelectorAll('[data-testid="guide-group-overview"]')].map(
      (el) => el.textContent,
    );
    expect(overviews[0]).toContain('The core change lives here.');
    expect(overviews[1]).toContain('How it is reached.');
  });

  test('lists one file under every group that claims it', () => {
    const container = mount(panel());
    const rows = [...container.querySelectorAll('.file-tree-item')].map((el) =>
      el.getAttribute('title'),
    );
    expect(rows.filter((p) => p === 'shared.ts').length).toBe(2);
  });

  test('keeps an unplaced file visible under Everything else', () => {
    const container = mount(panel());
    expect(container.textContent).toContain('stray.ts');
  });

  test('shows the guide note for a file when it has one', () => {
    const container = mount(panel());
    const summaries = [
      ...container.querySelectorAll('[data-testid="guide-group-file-summary"]'),
    ].map((el) => el.textContent);
    expect(summaries).toContain('adds the module');
  });

  test('selects a file by its index in the review file list', () => {
    const picked: number[] = [];
    const container = mount(panel({ onSelectFile: (i) => picked.push(i) }));
    const stray = [...container.querySelectorAll('.file-tree-item')].find(
      (el) => el.getAttribute('title') === 'stray.ts',
    ) as HTMLElement;
    act(() => stray.click());
    expect(picked).toEqual([2]);
  });

  test('collapses and re-expands a group', () => {
    const container = mount(panel());
    const header = container.querySelector('[data-testid="guide-group-header"]') as HTMLElement;
    act(() => header.click());
    expect(container.textContent).not.toContain('The core change lives here.');
    act(() => header.click());
    expect(container.textContent).toContain('The core change lives here.');
  });

  test('says there is no walkthrough rather than rendering an empty panel', () => {
    const container = mount(panel({ guide: null }));
    expect(container.textContent).toContain('No walkthrough yet');
  });
});
