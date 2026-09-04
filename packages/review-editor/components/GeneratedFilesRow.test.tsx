/**
 * DOM-gated tests (DOM_TESTS=1) for the generated-files control.
 *
 * A pull request diff hides files marked `linguist-generated`. The reviewer
 * must always be able to see that files are hidden, and to bring them back — a
 * hidden count nobody can read turns a filtered diff into a small-looking one.
 *
 * The behaviours under guard:
 *  - the row stays out of the panel when the diff hides nothing;
 *  - the row names how many files it hid, singular and plural;
 *  - the label reports the other state once the reviewer shows everything;
 *  - a click reports the toggle to the owner.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { GeneratedFilesRow } from './GeneratedFilesRow';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: React.ReactElement): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(element);
  });
  return host;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

function label(container: HTMLElement): string {
  return container.querySelector('[data-testid="generated-files-label"]')?.textContent ?? '';
}

describe('GeneratedFilesRow', () => {
  test('stays out of the panel when the diff hides nothing', () => {
    const container = mount(
      <GeneratedFilesRow hiddenCount={0} showing={false} onToggle={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });

  test('names how many files it hid', () => {
    const container = mount(
      <GeneratedFilesRow hiddenCount={118} showing={false} onToggle={() => {}} />,
    );
    expect(label(container)).toBe('118 generated files hidden');
  });

  test('says file, not files, for one', () => {
    const container = mount(
      <GeneratedFilesRow hiddenCount={1} showing={false} onToggle={() => {}} />,
    );
    expect(label(container)).toBe('1 generated file hidden');
  });

  test('reports the other state once the reviewer shows everything', () => {
    const container = mount(
      <GeneratedFilesRow hiddenCount={118} showing={true} onToggle={() => {}} />,
    );
    expect(label(container)).toBe('Showing all files');
  });

  test('reports a click to the owner', () => {
    let clicks = 0;
    const container = mount(
      <GeneratedFilesRow
        hiddenCount={3}
        showing={false}
        onToggle={() => {
          clicks += 1;
        }}
      />,
    );
    const row = container.querySelector('[data-testid="generated-files-label"]')
      ?.closest('button, [role="button"]') as HTMLElement | null;
    expect(row).not.toBeNull();
    act(() => {
      row!.click();
    });
    expect(clicks).toBe(1);
  });
});
