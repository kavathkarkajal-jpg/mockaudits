# CSV Bulk Import (Admin Panel)

## What gets built

A new **Import** tab inside `/admin` that lets an admin upload one CSV/XLSX file to sync brands, stores, store login passwords, and employees in one go.

## UI flow

1. **Upload screen**
   - "Download CSV template" button — generates a client-side Blob with the 7 headers + 1 example row, no server call.
   - File picker accepting `.csv` and `.xlsx`. Parsed in the browser with `papaparse` / `xlsx`.
2. **Preview screen** (after parse → calls `previewImport` server fn)
   - Top summary chips: `X new brands · Y new stores · Z updated stores · A new employees · B updated employees · C passwords reset · N skipped`
   - Per-row table with status badges (Create / Update / No change / Skip + reason)
   - Errors panel listing all skipped rows with row number + reason
   - **Confirm Import** / **Cancel** buttons
3. **Result screen** (after `commitImport`)
   - Final counts + "Download error log" (CSV of skipped rows)
   - "Import another file" button to reset

## Import logic (server-side)

For each valid row, in order:

1. **Brand** — match by `name` (case-insensitive). Insert if missing.
2. **Store** — match by `store_code`. Update `store_name`, `region`, `brand_id` if changed. Insert if missing.
3. **Store login user** — match the profile by `store_code`:
   - If exists → `supabaseAdmin.auth.admin.updateUserById(id, { password })`, refresh profile linkage.
   - If missing → create auth user (`<storeCode>@mockaudit.app`), insert `profiles` + `user_roles` (role `store_manager`).
4. **Employee** — match by `employee_code`. Update `name` / `store_id` if changed. Insert if missing.

Each row wrapped in try/catch; one failure doesn't abort the batch.

## Validation rules

- Skip + flag rows missing **Brand Name**, **Store Code**, **Employee Code**, or **Store Password**.
- Store Password min 6 chars (Supabase Auth requirement).
- Duplicate Employee Code within the same file → all duplicates flagged.
- Fully empty rows silently ignored.

## What's never touched

- `audit_sessions` and `audit_questions` — historical audit data stays intact.
- Existing employees not present in the CSV — left as-is (upsert, not destructive sync). UI will say so.

## Files changed

- **`src/lib/api/mock-audit.functions.ts`** — append `previewImport` and `commitImport` server fns (admin-gated, use `supabaseAdmin` for auth + bypassing RLS for bulk writes).
- **`src/routes/_authenticated/admin.tsx`** — add `Import` tab + `ImportTab` component (3-stage UI).
- **`package.json`** — add `papaparse`, `@types/papaparse`, `xlsx` (already installed).

## Verification

- Download template, fill 5 rows including: 1 new brand, 2 new stores, 1 existing store with changed name, 3 employees (one duplicate code, one missing Store Code) → preview shows correct counts and 2 errors.
- Confirm → log in as one of the new stores with the CSV password → succeeds.
- Re-upload with a changed password column → old password fails, new password works.
- `audit_sessions` row count unchanged before/after.
