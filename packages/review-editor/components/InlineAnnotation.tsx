import React from 'react';
import { SEVERITY_STYLES, DiffAnnotationMetadata } from '@plannotator/ui/types';
import { SuggestionBlock } from './SuggestionBlock';
import { CommentMeta } from './CommentMeta';
import { CommentActions } from './CommentActions';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';
import { useReviewStateOptional } from '../dock/ReviewStateContext';

interface InlineAnnotationProps {
  metadata: DiffAnnotationMetadata;
  language?: string;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Answer this one thread now. Omitted when no agent is available. */
  onAsk?: (id: string) => void;
  /** True while this thread's Ask is running. */
  isAsking?: boolean;
  /** Resolve or reopen this thread. Omitted on a read-only surface. */
  onToggleResolved?: (id: string) => void;
  /** True when this thread's root is resolved. */
  isResolved?: boolean;
}

/** Renders a single annotation comment inside the diff view */
export const InlineAnnotation: React.FC<InlineAnnotationProps> = ({
  metadata,
  language,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onAsk,
  isAsking,
  onToggleResolved,
  isResolved,
}) => {
  const severity = metadata.severity ? SEVERITY_STYLES[metadata.severity] : null;
  // Thread state comes from the review session rather than through
  // AllFilesCodeView and DiffViewer, which are presentational and would
  // otherwise both need to forward four props they never read. Explicit props
  // still win, so a host rendering this card outside a session can supply them.
  const session = useReviewStateOptional();
  const id = metadata.annotationId;
  const resolved = isResolved ?? session?.resolvedAnnotationIds.has(id) ?? false;
  const asking = isAsking ?? session?.askingAnnotationId === id;
  const ask = onAsk ?? session?.onAskAnnotation;
  const askThread = ask ? () => ask(id) : undefined;
  const toggle = onToggleResolved ?? session?.onToggleAnnotationResolved;
  const toggleResolved = toggle ? () => toggle(id) : undefined;

  return (
    <div
      className={`review-comment group${isSelected ? ' is-selected' : ''}${resolved ? ' is-resolved' : ''}`}
      data-annotation-id={metadata.annotationId}
      data-resolved={resolved ? 'true' : undefined}
      onClick={() => onSelect(metadata.annotationId)}
    >
      <CommentMeta
        leading={
          severity && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severity.dot}`} title={severity.label} />
          )
        }
        conventionalLabel={metadata.conventionalLabel}
        decorations={metadata.decorations}
        reviewProfileLabel={metadata.reviewProfileLabel}
        source={metadata.source}
        author={metadata.author}
        createdAt={metadata.createdAt}
      />
      {metadata.text && (
        <div className="review-comment-body">{renderInlineMarkdown(metadata.text)}</div>
      )}
      {metadata.reasoning && (
        <div className="review-comment-reasoning text-[11px] text-muted-foreground/60 leading-relaxed mt-1.5">
          {metadata.reasoning}
        </div>
      )}
      {metadata.suggestedCode && (
        <div className="mt-2">
          <SuggestionBlock code={metadata.suggestedCode} originalCode={metadata.originalCode} language={language} />
        </div>
      )}
      <CommentActions
        onEdit={() => onEdit(metadata.annotationId)}
        copyText={metadata.copyText}
        onDelete={() => onDelete(metadata.annotationId)}
        onAsk={askThread}
        isAsking={asking}
        onToggleResolved={toggleResolved}
        isResolved={resolved}
      />
    </div>
  );
};
