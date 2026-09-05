import React, { createContext, useContext } from 'react';
import type { DiffFile } from './types';

/**
 * The guide chain (GuideView → GuideSectionCard → GuideFileCard) is rendered by
 * two hosts: the Plannotator review app and the portable guide viewer. Both
 * supply the same narrow contract through this context instead of the app's
 * ~200-field ReviewState, which is what lets the chain live in a package
 * without a server, a dock, or annotations behind it.
 *
 * Decision record: adr/decisions/007-portable-guided-reviews-20260815.md (D2).
 */

/** A "reveal this file" navigation event. `token` bumps per event so re-revealing the same path re-fires. */
export interface GuideRevealTarget {
  path: string;
  token: number;
}

/** The host's active global-search match, if it has a search. */
export interface GuideActiveSearchMatch {
  id: string;
  filePath: string;
}

/**
 * The minimum a diff renderer must accept from the guide chain. In Plannotator
 * this is `AllFilesCodeView`; the props below are exactly the guide-specific
 * subset added for the virtualized guide (#1158): one file per instance, a
 * tokenized scroll target, and remount-continuity for the viewport window.
 */
export interface GuideDiffRendererProps {
  files: DiffFile[];
  fileScrollTarget: { filePath: string; token: number } | null;
  fileOrder: 'list';
  mountCollapsed: boolean;
  initialScrollPosition: number;
  onScrollPositionChange: (position: number) => void;
  onFileCollapsedChange: (filePath: string, collapsed: boolean) => void;
  /** The focused card is the keyboard/annotation target. */
  isActive: boolean;
  allowScrollChaining: true;
}

export interface GuideDiffRendererContext {
  file: DiffFile;
  focused: boolean;
}

export interface GuideHostValue<P extends object = Record<string, unknown>> {
  /** Every file of the review the guide describes. Guide refs resolve against this list. */
  files: DiffFile[];
  /** Renders one file's diff. */
  DiffRenderer: React.ComponentType<GuideDiffRendererProps & P>;
  /**
   * Extra props forwarded to every DiffRenderer instance (annotation, staging,
   * search and AI wiring in-app; nothing in a read-only host). Called per card
   * so per-card values (e.g. a pending selection only for the focused file) can
   * be expressed without leaking focus state into the host.
   */
  getDiffRendererProps: (context: GuideDiffRendererContext) => P;
  /** Host-owned reveal channel (sidebar/outline jumps). Optional — the chain falls back to a local channel. */
  revealFile?: GuideRevealTarget | null;
  onRevealFile?: (path: string) => void;
  /** Host-owned global search: the active match is routed to its chapter so an offscreen file mounts first. */
  activeSearchMatch?: GuideActiveSearchMatch | null;
  /**
   * Renders a chapter's overview markdown.
   *
   * A slot rather than a fixed renderer, because the two hosts can afford
   * different amounts of markdown. The review app renders the full thing —
   * mermaid diagrams, code blocks, tables — by supplying its own component. The
   * portable viewer cannot: it ships to guides.show from a package that depends
   * on `@plannotator/core` alone, and pulling the app's renderer in would drag
   * the whole UI (and the Mermaid runtime) into the export.
   *
   * Omitted means the built-in prose renderer: paragraphs, headings, bullets,
   * callouts and inline markdown. That is the floor every host meets, so a
   * guide always reads correctly even where it cannot draw.
   */
  ProseRenderer?: React.ComponentType<{ markdown: string; tone?: 'foreground' | 'muted' }>;
  /**
   * Reports the files of the chapter the reader is currently in.
   *
   * Where a chapter's files sit in the tree is itself information: a chapter
   * touching one package reads differently from one scattered across four, and
   * that shape is invisible inside the guide's own list. A host that shows a
   * file tree beside the guide uses this to light those rows up.
   *
   * Fires on chapter change, with the chapter's paths in guide order. Optional
   * — the portable viewer has no tree and passes nothing.
   */
  onChapterFilesChange?: (paths: string[]) => void;
}

// The context erases the renderer's extra-prop generic; hosts recover typing at the provider site.
const GuideHostContext = createContext<GuideHostValue<any> | null>(null);

export function GuideHostProvider<P extends object>({
  value,
  children,
}: {
  value: GuideHostValue<P>;
  children: React.ReactNode;
}) {
  return <GuideHostContext.Provider value={value}>{children}</GuideHostContext.Provider>;
}

/** Throws when no host is mounted — rendering the guide chain without one is always a wiring bug. */
export function useGuideHost(): GuideHostValue<Record<string, unknown>> {
  const value = useContext(GuideHostContext);
  if (!value) throw new Error('GuideHostProvider is missing above the guide chain');
  return value;
}
