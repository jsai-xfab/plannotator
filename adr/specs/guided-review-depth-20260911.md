# Guided Review: depth, granularity, and refinement

Status: building · Fork: `jsai-xfab/plannotator`

Guided Review produces a chapter per logical change. A reader who used it on a
large branch reported six problems. This spec states the intended end state for
each. Read it with `FORK.md`, which says what is ours and what is upstream's.

## The problems

1. A guide explains the change. It never says a hunk looks wrong to be there:
   dead code, a leftover from an approach the branch abandoned, an old idea the
   rest of the change no longer uses.
2. A chapter highlights its files in the tree. The reader wants to hide every
   other file instead.
3. The launch screen has a custom instructions box. The reader did not find it,
   because it hides behind a collapsed disclosure in muted text.
4. Chapters are too coarse. Prose runs flat with no headings, and a diagram is
   small and cannot be enlarged.
5. Nothing collapses every chapter at once, so the shape of the whole change is
   hard to see.
6. A guide cannot be adjusted. The reader must regenerate from nothing.

## The intended end state

### 1. Loose ends

The output gains `looseEnds`: an array of `{ file, note }`. A note says why a
hunk looks like it does not belong. Three triggers, all about the CODE and never
about the topic:

- code nothing calls, and nothing in the diff will call;
- a leftover from an approach this branch abandoned partway;
- two mechanisms for one job, where the change adds the second and leaves the
  first.

A loose end is an ANNOTATION on a file, never a placement. Every file keeps its
chapter. The coverage rule is unchanged: `looseEnds` is not a fourth place a
file can live, so `validateGuideOutput` needs no change.

The reader sees them in one trailing card, after "Everything else". Empty and
absent both render nothing. The guide states a loose end plainly and does not
argue; the reader decides.

**Why this and not a findings pass.** The guide's calibration is "explain, do
not critique", and that stays. A loose end is not a bug report. It answers "why
is this here", which is orientation, and it is the one question a reader cannot
answer from the diff alone.

### 2. Chapter filter in the file tree

The tree gains a filter, beside the existing chapter highlight. On, the tree
shows only the current chapter's files. Off, it shows everything with the
chapter lit. Off is the default, because a reader who loses the surrounding
tree loses the shape of the repository, which is why the tree stays open at all.

The control lives with the other tree controls and states the count it hides,
the same way the generated-files row does.

### 3. Custom instructions, visible

The launch screen opens the instructions box by default when the reader has
saved text, and labels it so a reader who has never opened it knows what it is.
The stored text and the 2000-character cap do not change.

### 4. Sub-chapters, headings, and enlargeable diagrams

A section gains `subsections`: an array of `{ title, body }`. Each is a named
part of the chapter with its own prose and its own diagram.

Sub-chapters are NOT automatic. The prompt gives three triggers and says to use
none otherwise:

- the chapter holds more than one distinct step of one mechanism;
- two files in the chapter play different roles that need separate explanation;
- the chapter carries both a structure and a sequence worth separate diagrams.

A chapter with one idea stays one chapter. A guide of eight chapters with two
sub-chapters each is a failure of this rule, not a success.

Diagrams enlarge. A click opens the diagram over the page at full size; Escape
and a click outside close it. The chapter column is 440px on desktop, which is
too narrow for a sequence diagram of any size, and shrinking the diagram to fit
is what makes it unreadable.

### 5. Collapse all

The guide header gains one control that collapses every chapter, and expands
every chapter when all are collapsed. Collapsed chapters already show title,
diff count, and position, which is the big-picture breakdown.

Chapter collapse state today lives inside each card. It moves up to `GuideView`
so one control can drive all of them, and a card keeps its own toggle.

### 6. Refine

A reader viewing a guide can ask for a different cut of it: "break chapter 3
into its own chapters", "merge the two test chapters". The refinement launches a
new guide job that receives the current guide as a starting point, and the
reader's sentence as the change to make.

Refine does not edit a guide in place. It generates a new one, so the old one
stays until the new one validates. The same coverage rule applies to the result.

The previous guide travels in a new launch field, not in `instructions`:
`instructions` is a standing preference capped at 2000 characters and persisted
for every future guide, and a refinement is neither standing nor small.

## Test first

**Unit — loose ends.** A guide output with `looseEnds` survives parse and
validation. A file named in `looseEnds` still appears in its chapter, and
coverage passes.

**Unit — subsections.** A section with `subsections` parses. A section without
them renders exactly as it does today.

**Unit — collapse all.** Collapsing all marks every card collapsed; the control
then expands every card. A card's own toggle still works afterward.

**Playwright — end to end, on a large real branch.**
1. Launch a guide. Confirm the instructions box is visible without a click.
2. Confirm at least one chapter renders a diagram, and a click enlarges it.
3. Turn on the chapter filter. Confirm the tree shows only that chapter's files.
4. Click collapse all. Confirm every chapter collapses.
5. Refine with "break the largest chapter into smaller chapters". Confirm a new
   guide arrives with more chapters than the first.
