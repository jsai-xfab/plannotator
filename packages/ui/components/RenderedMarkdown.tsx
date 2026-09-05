import React, { useMemo } from 'react';
import { parseMarkdownToBlocks, groupBlocks, computeListIndices } from '../utils/parser';
import { BlockRenderer } from './BlockRenderer';
import { MermaidBlock } from './MermaidBlock';
import { GraphvizBlock } from './GraphvizBlock';
import { isGraphvizLanguage, isMermaidLanguage } from './diagramLanguages';

/**
 * Full markdown renderer for surfaces outside the plan editor (e.g. the PR
 * description, a Code Tour stop). Reuses the shared {@link BlockRenderer} — so
 * tables, HTML, callouts, code, and `data-block-id` all come along — without
 * dragging in the plan Viewer's toolbar/lightbox machinery.
 *
 * Diagrams are dispatched here rather than left to `BlockRenderer`, which sends
 * every fenced block to `CodeBlock`. A ```mermaid fence in agent-authored prose
 * is meant as a picture, and rendering it as source defeats the point: an
 * explanation of a call flow or a class relationship is far cheaper to read as
 * a diagram. Same rule the plan Viewer applies, so one markdown string looks
 * the same wherever it is shown.
 *
 * Sizing/spacing is inherited from the wrapper: pass `className="md-compact"`
 * (or any scope) to override the renderer's plan-sized defaults via CSS.
 */
export interface RenderedMarkdownProps {
  markdown: string;
  className?: string;
  onImageClick?: (src: string, alt: string) => void;
  onOpenLinkedDoc?: (path: string) => void;
  onOpenCodeFile?: (path: string) => void;
  githubRepo?: string;
  /** Render ```mermaid / ```dot fences as pictures (default true). */
  renderDiagrams?: boolean;
}

export const RenderedMarkdown: React.FC<RenderedMarkdownProps> = ({
  markdown,
  className,
  onImageClick,
  onOpenLinkedDoc,
  onOpenCodeFile,
  githubRepo,
  renderDiagrams = true,
}) => {
  const groups = useMemo(() => groupBlocks(parseMarkdownToBlocks(markdown)), [markdown]);
  const cb = { onImageClick, onOpenLinkedDoc, onOpenCodeFile, githubRepo };

  return (
    <div className={className}>
      {groups.map((group) => {
        if (group.type === 'list-group') {
          const indices = computeListIndices(group.blocks);
          return (
            <div key={group.key}>
              {group.blocks.map((block, i) => (
                <BlockRenderer key={block.id} block={block} orderedIndex={indices[i]} {...cb} />
              ))}
            </div>
          );
        }
        const block = group.block;
        if (renderDiagrams && block.type === 'code') {
          if (isMermaidLanguage(block.language)) {
            return <MermaidBlock key={block.id} block={block} />;
          }
          if (isGraphvizLanguage(block.language)) {
            return <GraphvizBlock key={block.id} block={block} />;
          }
        }
        return <BlockRenderer key={block.id} block={block} {...cb} />;
      })}
    </div>
  );
};
