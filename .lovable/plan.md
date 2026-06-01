# Brand-Scoped Audit Questions

The `audit_questions` table already has `brand_id` and `display_order` — no schema changes needed. This plan wires brand-scoped loading into the audit flow and adds full question management to the Admin panel.

## 1. Audit flow: load questions by brand

In the Conduct Audit screen (`/_authenticated/conduct/$employeeId`):
- Resolve the employee's `store.brand_id` (already fetched for the employee card).
- Add a server function `getQuestionsForBrand(brandId)` that returns `audit_questions` where `brand_id = brandId`, ordered by `display_order`.
- Replace the current placeholder questionnaire card with the rendered list. Each question shows its text and (for now) a Yes/No control plus an optional notes field — score calculation stays as-is (sum of Yes answers / total × 100) so the submit flow keeps working.
- If the brand has zero questions, show an empty state: "No audit questions configured for this brand yet. Ask an admin to add some."

## 2. Admin panel: Questions tab

Add a new tab in `/_authenticated/admin/` called **Questions** alongside Brands / Stores / Employees / Users.

Layout:
- Brand selector at the top (dropdown of all brands). Selecting a brand filters the list below.
- Ordered list of that brand's questions, each row showing: order number, question text, type badge, edit + delete buttons, and up/down arrows for reorder.
- "Add question" button opens a dialog (react-hook-form + zod) with fields: question text (textarea), question type (select: `yes_no` for now — structure ready for more types later).

Actions (all via server functions, admin-only — RLS already enforces this):
- `createQuestion({ brandId, text, type })` — inserts with `display_order = max(display_order) + 1` for that brand.
- `updateQuestion({ id, text, type })`
- `deleteQuestion({ id })` — with confirm dialog. Warn that past audits keep their recorded score but lose question-level traceability.
- `reorderQuestions({ brandId, orderedIds })` — rewrites `display_order` for all rows in that brand in one transaction.

## 3. Out of scope (for this step)

- Per-question scoring weights, sections/categories, multiple choice types, conditional logic — structure supports adding later via the existing `question_type` column.
- Versioning historical questionnaires per audit session.

## Technical notes

- All queries via `createServerFn` + `requireSupabaseAuth`; admin writes rely on existing `questions_admin_write` RLS policy.
- Invalidate `['questions', brandId]` after any admin mutation; invalidate the same key from the audit screen so a mid-session admin edit reflects on next load.
- Reorder uses optimistic UI with rollback on error.
