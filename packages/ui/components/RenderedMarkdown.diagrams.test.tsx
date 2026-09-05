/**
 * DOM-gated tests (DOM_TESTS=1) for diagram dispatch in RenderedMarkdown.
 *
 * Agent-authored prose — a Code Tour stop, a PR description — may carry a
 * ```mermaid fence, and it is meant as a picture. BlockRenderer sends every
 * fenced block to CodeBlock, so without an explicit dispatch a call-flow
 * diagram arrives as diagram source, which is worse than the paragraph it
 * replaced.
 *
 * The behaviours under guard:
 *  - a mermaid fence reaches MermaidBlock, not the plain code path;
 *  - an ordinary fence is untouched and still renders as code;
 *  - `renderDiagrams={false}` opts a surface back out;
 *  - prose around a diagram still renders.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { RenderedMarkdown } from './RenderedMarkdown';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

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

/** MermaidBlock always labels its content `language-mermaid`, rendered or not. */
function hasMermaidTarget(container: HTMLElement): boolean {
  return (
    container.querySelector('.language-mermaid') !== null ||
    container.querySelector('[data-pinpoint-ignore]') !== null
  );
}

const DIAGRAM = [
  'Tokens refresh lazily.',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant Caller',
  '  participant TokenStore',
  '  Caller->>TokenStore: get(user)',
  '```',
].join('\n');

describe('RenderedMarkdown diagram dispatch', () => {
  test('sends a mermaid fence to the diagram renderer', () => {
    const container = mount(<RenderedMarkdown markdown={DIAGRAM} />);
    expect(hasMermaidTarget(container)).toBe(true);
  });

  test('keeps the prose around the diagram', () => {
    const container = mount(<RenderedMarkdown markdown={DIAGRAM} />);
    expect(container.textContent).toContain('Tokens refresh lazily.');
  });

  test('leaves an ordinary code fence as code', () => {
    const container = mount(
      <RenderedMarkdown markdown={'```python\nx = 1\n```'} />,
    );
    expect(container.querySelector('.language-mermaid')).toBeNull();
    expect(container.textContent).toContain('x = 1');
  });

  test('renderDiagrams={false} opts a surface back out', () => {
    const container = mount(<RenderedMarkdown markdown={DIAGRAM} renderDiagrams={false} />);
    expect(container.querySelector('[data-pinpoint-ignore]')).toBeNull();
    // The fence still renders — as source, which is the opt-out's whole point.
    expect(container.textContent).toContain('sequenceDiagram');
  });
});
