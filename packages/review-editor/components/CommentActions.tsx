import React from 'react';
import { CopyButton } from './CopyButton';

interface CommentActionsProps {
  /** When provided, shows the edit button (left-most). */
  onEdit?: () => void;
  /** When provided, shows the copy button (middle). */
  copyText?: string;
  /** When provided, shows the delete/close button (right-most). Omitted for
   *  read-only (e.g. externally-sourced) comments. */
  onDelete?: () => void;
  /** When provided, shows Ask — answer this one thread now, without sending
   *  the whole batch. Omitted when no agent is available. */
  onAsk?: () => void;
  /** True while this thread's Ask is running. */
  isAsking?: boolean;
  /** When provided, shows the resolve toggle. A resolved thread stops
   *  travelling to the agent; it is never deleted. */
  onToggleResolved?: () => void;
  /** Current thread state, for the toggle's label and icon. */
  isResolved?: boolean;
}

const ACTION_BTN = 'p-1 rounded text-muted-foreground transition-colors';

/**
 * The single hover-revealed action row shared by every comment card (inline
 * diff, sidebar, file banner). Bottom-aligned, right-justified, order
 * left→right: ask · resolve · edit · copy · delete (so the close/delete sits
 * furthest right). The parent card must carry the Tailwind `group` class for
 * the hover reveal.
 *
 * The resolve toggle stays visible on a resolved thread rather than hiding
 * with the rest of the row — a reviewer must be able to reopen a thread
 * without hunting for the control.
 */
export const CommentActions: React.FC<CommentActionsProps> = ({
  onEdit,
  copyText,
  onDelete,
  onAsk,
  isAsking = false,
  onToggleResolved,
  isResolved = false,
}) => {
  if (!onEdit && !copyText && !onDelete && !onAsk && !onToggleResolved) return null;
  return (
  <div
    className={`flex items-center justify-end gap-1 mt-1.5 transition-opacity ${
      isResolved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
    }`}
    onClick={(e) => e.stopPropagation()}
  >
    {onAsk && !isResolved && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAsk(); }}
        disabled={isAsking}
        className={`${ACTION_BTN} hover:bg-muted hover:text-foreground text-[10px] px-1.5 disabled:opacity-50`}
        title="Answer this comment now"
        data-testid="comment-ask"
      >
        {isAsking ? 'Asking…' : 'Ask'}
      </button>
    )}
    {onToggleResolved && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleResolved(); }}
        className={`${ACTION_BTN} text-[10px] px-1.5 ${
          isResolved ? 'text-success hover:bg-muted' : 'hover:bg-muted hover:text-foreground'
        }`}
        title={isResolved ? 'Reopen this thread' : 'Resolve this thread'}
        data-testid="comment-resolve"
      >
        {isResolved ? 'Resolved' : 'Resolve'}
      </button>
    )}
    {onEdit && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className={`${ACTION_BTN} hover:bg-muted hover:text-foreground`}
        title="Edit"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    )}
    {copyText && <CopyButton text={copyText} variant="inline" />}
    {onDelete && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className={`${ACTION_BTN} hover:bg-destructive/10 hover:text-destructive`}
        title="Delete"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
  );
};
