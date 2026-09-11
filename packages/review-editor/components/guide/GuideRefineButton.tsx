import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { CodeGuideOutput } from '@plannotator/shared/guide';
import { GUIDE_REFINE_ASK_MAX_CHARS } from '@plannotator/shared/guide';

/**
 * "Refine" on a finished guide: the reader says what to change about the way
 * the changeset is organized, and a new guide job starts with the current
 * guide as its starting point.
 *
 * A refinement never edits the guide on screen. It launches a fresh job, so
 * the guide the reader is reading stays until the new one validates. The
 * server appends the previous guide and this sentence to the normal organizer
 * prompt (see buildGuideRefineBlock), which is why the coverage rule and the
 * diagram rules still hold for the result.
 *
 * Distinct from the launch screen's "Custom instructions": those are a
 * standing preference saved for every future guide, this is one instruction
 * about one guide.
 */
export function GuideRefineButton({
  guide,
  canLaunch,
  onRefine,
}: {
  /** The guide on screen, sent as the starting point. */
  guide: CodeGuideOutput;
  /** False while no engine is available, or while a launch is in flight. */
  canLaunch: boolean;
  onRefine: (ask: string, guide: CodeGuideOutput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = ask.trim();

  const submit = async () => {
    if (!trimmed || busy || !canLaunch) return;
    setBusy(true);
    try {
      await onRefine(trimmed, guide);
      setOpen(false);
      setAsk('');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canLaunch}
        className="flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
        title="Ask for a different cut of this guide"
      >
        <Wand2 size={12} />
        Refine
      </button>
    );
  }

  return (
    <div className="w-[min(420px,80vw)] rounded-md border border-border/60 bg-card p-2.5">
      <textarea
        autoFocus
        value={ask}
        onChange={(e) => setAsk(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          // Enter submits; Shift+Enter is a newline, the usual split for a
          // one-sentence box that occasionally holds two.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        maxLength={GUIDE_REFINE_ASK_MAX_CHARS}
        rows={3}
        spellCheck={false}
        placeholder={'What should change? e.g. "break chapter 3 into one chapter per handler", "merge the two test chapters", "add a diagram to the auth chapter".'}
        className="w-full resize-y rounded-md border border-border/50 bg-background p-2 text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-border"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!trimmed || busy || !canLaunch}
          className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Starting…' : 'Refine guide'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10.5px] text-muted-foreground/60">
          Starts a new guide; this one stays until it is ready.
        </span>
      </div>
    </div>
  );
}
