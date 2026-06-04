
# Re-audit flag for failed sessions

Adds a brand-level pass mark. When an audit is submitted with a score below that mark, the session is auto-flagged for re-audit. Flagged employees surface in the Conduct list, on the result screen, in the Dashboard, and the threshold is editable in Admin → Brands.

## 1. Database migration

New columns:
- `brands.reaudit_threshold NUMERIC(5,2) DEFAULT NULL` — null disables.
- `audit_sessions.needs_reaudit BOOLEAN NOT NULL DEFAULT false`
- `audit_sessions.reaudit_cleared_at TIMESTAMPTZ DEFAULT NULL`

Index:
- Partial index on `audit_sessions(needs_reaudit) WHERE needs_reaudit = true`.

Trigger:
- `set_reaudit_flag()` BEFORE INSERT on `audit_sessions`. Joins `employees → stores → brands` via `NEW.employee_id`. If `brand.reaudit_threshold IS NOT NULL AND NEW.score < threshold` → `NEW.needs_reaudit = true`, else false. Returns NEW.
- Trigger `trg_set_reaudit_flag` BEFORE INSERT FOR EACH ROW.

RLS:
- New UPDATE policy on `audit_sessions` allowing rows where `(has_role(auth.uid(),'admin') OR has_role(auth.uid(),'trainer'))` AND `can_access_store(...)` for the employee's store. Implemented via subquery from `employees` to get `store_id`.

## 2. Server functions (`src/lib/api/mock-audit.functions.ts`)

- **`upsertBrand`**: add `reaudit_threshold: z.number().min(0).max(100).nullable().default(null)` to input schema; include in insert/update payload.
- **`toggleReauditFlag`** (new, POST, `requireSupabaseAuth`): input `{ session_id: uuid, needs_reaudit: boolean }`. Updates session, sets `reaudit_cleared_at = now()` when clearing, null when flagging. Returns `{ ok: true }`.
- **`submitAudit`**: add `needs_reaudit` to `.select()`.
- **`listEmployees`**: select `needs_reaudit`; build `reauditSet` for current week; expose `needsReaudit` on each employee.
- **`getDashboard`**: select `needs_reaudit`; build `currentWeekReaudit` set (for `week_start_date = monday`); add `flagged` to each store stat and brand stat (sum of store flagged); add `totalFlagged` to summary.

## 3. Conduct list (`src/routes/_authenticated/conduct.index.tsx`)

For each employee card:
- If `e.needsReaudit`, apply `border-destructive/50` to the card wrapper.
- Add a second `Badge variant="destructive"` below the status badge: "⚠ Re-audit required".
- Button logic:
  - flagged → destructive `Button` "Start Re-audit", linking to the audit page (enabled).
  - completed + not flagged → existing disabled "Done this week".
  - pending + not flagged → existing "Start Mock Audit".

## 4. Result screen (`src/routes/_authenticated/conduct.$employeeId.tsx`)

After submit:
- Store result as `{ score, sessionId, needsReaudit }`.
- Score number uses `text-destructive` when `needsReaudit`.
- If flagged → red callout: "⚠ Flagged for re-audit — Score is below the threshold for this brand. A re-audit is required." With a small text button "Clear flag (override)" → `toggleReauditFlag({ needs_reaudit: false })`, updates local state.
- If not flagged → small text link "Flag for re-audit manually" → `toggleReauditFlag({ needs_reaudit: true })`, updates local state.
- On success: `queryClient.invalidateQueries({ queryKey: ['employees'] })` and `['dashboard']`, toast confirmation.

## 5. Dashboard (`src/routes/_authenticated/dashboard.tsx`)

- Between stat cards and charts: alert banner rendered only when `summary.totalFlagged > 0`, destructive border/background, prominent count, copy: "[N] re-audit(s) required this week — These employees scored below the brand threshold. Go to Conduct to start their re-audit."
- Store breakdown table: add "Flagged" column header after "Done". Cell shows `s.flagged` in `text-destructive font-semibold` when > 0; otherwise em dash in muted colour.

## 6. Admin Brands tab (`src/components/admin/QuestionsTab.tsx` or the brands tab file — will locate the brands form during build)

- Add Brand form: number input "Re-audit threshold (%)", min 0, max 100, step 1, placeholder "e.g. 60 — leave blank to disable". Sent as `reaudit_threshold` (null when blank).
- Brands list table: new "Re-audit below" column showing `"{n}%"` or `"—"`.

## Technical notes

- The trigger fires only on INSERT, matching `submitAudit`'s insert path; updates won't retrigger.
- The new UPDATE RLS policy is the gate for `toggleReauditFlag`; the server fn uses the user-scoped client from `requireSupabaseAuth`, so RLS applies.
- Brand threshold stored as numeric so partial percentages (e.g. 59.5) are supported even though the UI uses integer step.
- All colors via existing `destructive` token — no new tokens added.

## Out of scope

- No notifications, emails, or scheduling of the re-audit.
- No history of past flags beyond `reaudit_cleared_at` timestamp.
- No bulk-clear UI.
