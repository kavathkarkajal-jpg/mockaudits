## Goal

Turn the Admin → Questions builder into an MS Forms replica supporting multiple question types, per-option weights for scoring, and a Required toggle. The Conduct page renders each type natively and computes the audit score from those weights.

## Question types (MS Forms parity)

1. **Choice — single select** (radio)
2. **Choice — multi-select** (checkboxes)
3. **Text — short answer** (Input)
4. **Text — long answer** (Textarea)
5. **Rating — stars** (1–5 or 1–10, configurable max)
6. **Rating — number** (1–N numeric pills)
7. **Likert** (rows × scale columns: Strongly disagree … Strongly agree)
8. **Yes/No** (kept for backward compatibility with existing questions)
9. **Date** (date picker)
10. **Ranking** (drag to reorder a fixed list)

Each question also gets a **Required** toggle (cannot submit until answered).

## Scoring model

- **Per-option weights.** Admin assigns a numeric weight to each choice / rating step / Likert column / ranked position. Weights can be 0 or negative.
- Each question contributes `earned / max` × 100, then questions are averaged into the final 0–100 audit score (same `score` column on `audit_sessions` — no migration of historical data).
- **Text / Date / Long answer**: informational only (no score contribution; excluded from average).
- **Multi-select**: sum of selected option weights, capped at the question's max positive sum.
- **Ranking**: weight is position-based (admin sets weight per rank slot).
- **Required unanswered → submit disabled** (Conduct page validates).

## Schema change (single migration)

`audit_questions` table additions:

- `question_type` enum widened (kept as `text` column, validated by Zod):
  `yes_no | single_choice | multi_choice | short_text | long_text | rating_stars | rating_number | likert | date | ranking`
- `options` `jsonb not null default '[]'` — flexible per-type payload:
  - choice: `[{ label, weight }]`
  - rating: `{ max: 5, weights: [0,1,2,3,4,5] }`
  - likert: `{ statements: [..], scale: [{label, weight}, ...] }`
  - ranking: `[{ label, weight }]` (weight = points for being placed at that rank index)
  - text / date / yes_no: `[]` (yes_no scoring stays hard-coded yes=1/no=0 as today)
- `required` `boolean not null default false`
- `max_score` `numeric not null default 0` — precomputed at save time so Conduct doesn't recalculate.

No changes to `audit_sessions` (still stores final `score` only — no per-answer history, matching current product).

## Server functions (`src/lib/api/mock-audit.functions.ts`)

- Widen `QuestionTypeEnum`.
- Extend `upsertQuestion` validator to accept `options` (Zod discriminated union per type) + `required` + compute `max_score` server-side.
- Extend `listQuestionsForBrand` / `adminListQuestions` selects to include `options, required, max_score`.

## Admin UI (`src/routes/_authenticated/admin.tsx` → `QuestionsTab`)

Rebuild as an MS Forms-style editor:

- Question list (left): drag-handle + up/down (existing reorder), card per question showing type icon, text, required asterisk.
- Editor (right): type picker, question text, **Required** toggle, then a type-specific editor:
  - Choice: add/remove options, weight input per option, "Add option" / "Add 'Other'".
  - Rating: scale max (3/5/10), shape (stars/number), weight per step (defaults 0..max).
  - Likert: statements list + scale columns with weights.
  - Ranking: items + weight per rank position.
  - Text/Date: just placeholder hint (no extra config).
- Live "Auditor preview" panel (read-only render of the question).

## Conduct UI (`src/routes/_authenticated/conduct.$employeeId.tsx`)

- Render each question with the correct control (Radio / Checkbox / Input / Textarea / star row / number pills / Likert grid / date input / draggable list).
- Validate required answers before enabling Submit.
- Compute score = average of `(earned / max_score) × 100` across scored questions; pass to `submitAudit` (unchanged signature).

## Backward compatibility

- Existing `yes_no` questions keep working untouched (empty `options`, max_score=1, yes=1/no=0).
- Existing audits (`audit_sessions`) unaffected — only forward-going audits use weighted scoring.

## Technical notes

- One `react-beautiful-dnd` alternative already not installed; use `@hello-pangea/dnd` (drop-in) for Ranking + question reorder, OR keep current up/down buttons and add native HTML5 drag for Ranking only. Recommend the latter to avoid a new dep.
- All option editing happens client-side; single `upsertQuestion` call persists the full `options` JSON.

## Out of scope

- Per-answer history storage (audits still only persist final score + notes).
- Branching/skip logic, sections, file upload questions, Net Promoter Score — not part of MS Forms core set the user asked to replicate.
