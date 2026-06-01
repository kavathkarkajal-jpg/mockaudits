## Mock Audit Manager — Build Plan

A retail L&D web app for conducting weekly mock audits across brands and stores, with a live operations dashboard.

### 1. Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud and create the following schema.

**Tables**
- `brands` — id, name, primary_color (hex, for theming), created_at
- `stores` — id, brand_id (fk), store_code (unique), store_name, region
- `employees` — id, store_id (fk), name, employee_code, active
- `audit_sessions` — id, employee_id (fk), conducted_by (fk → profiles), submitted_at, score, week_start_date (Monday of submission, computed in trigger)
- `audit_questions` — id, brand_id (nullable), question_text, question_type, order (placeholder; no UI yet)
- `profiles` — id (= auth.users.id), store_code, full_name, brand_id (nullable), store_id (nullable), region (nullable)
- `user_roles` — id, user_id, role (enum: `store_manager`, `regional_manager`, `trainer`, `business_head`, `admin`)

**Security**
- Roles stored in `user_roles` (never on profiles) with `has_role(uuid, app_role)` security-definer function.
- Additional helpers: `current_brand_id()`, `current_store_id()`, `current_region()` — security-definer, return values from caller's profile.
- RLS on every table; grants for `authenticated` and `service_role`.

**Access rules (scope by role + brand/store)**
- `store_manager`: read employees of own store; create audits for own store's employees.
- `regional_manager`: read employees of own region (within own brand); create audits for them.
- `business_head`: read/audit all stores within own brand.
- `trainer`: read/audit all stores across all brands.
- `admin`: full CRUD on all master tables.
- Dashboard reads: same brand-scope rule (Adidas users see Adidas only; Trainer/Admin see all). Implemented via RLS on `audit_sessions` + filtered views.

**Weekly reset logic**
- Trigger on `audit_sessions` insert sets `week_start_date = date_trunc('week', submitted_at)` (Postgres week starts Monday).
- Uniqueness: partial unique index `(employee_id, week_start_date)` so an employee can only be audited once per week.
- "Completion this week" computed by joining employees with sessions where `week_start_date = current Monday`.

### 2. Authentication

- Login form: **Store Code** + **Password**.
- Under the hood: synthesize `{storecode}@mockaudit.app` for Supabase Auth signIn/signUp. Store Code displayed everywhere; email is internal.
- `_authenticated` layout route gates the app. Bearer attacher wired in `src/start.ts`.
- Admin creates users via Admin UI → calls a server function (`supabaseAdmin`) to create the auth user with synthesized email, then inserts `profiles` + `user_roles` rows.
- No public sign-up.

### 3. App Structure & Routes

```
/login                            Public login (Store Code + Password)
/_authenticated/
  ├─ conduct                      Tab 1: Employee list + start audit
  ├─ conduct/$employeeId          Audit questionnaire (placeholder) + submit
  ├─ dashboard                    Tab 2: Live ops dashboard
  └─ admin/                       Admin-only (gated in beforeLoad via has_role)
       ├─ brands
       ├─ stores
       ├─ employees
       ├─ users
       └─ questions               Placeholder list
```

Two-tab top nav: **Conduct Audit** | **Dashboard** (plus **Admin** tab if role=admin).

### 4. Conduct Audit flow

- Employee list filtered server-side by role scope (Store Mgr → own store, Regional → region, Brand head → brand, Trainer/Admin → all). Brand/store filter dropdowns when scope is broad.
- Employee card: large name, employee_code, status badge (green Completed / amber Pending), "Start Mock Audit" button (disabled if completed this week).
- Clicking opens questionnaire page with a "Questions coming soon" placeholder card + a Submit button that takes a manual score (0–100) for now so the flow is testable end-to-end.
- On submit: server fn inserts `audit_sessions`, returns score. Show score on screen; invalidate dashboard + employee-list queries.

### 5. Dashboard

Brand and store filters at top (auto-locked to user's brand if scoped).

Widgets:
1. **Current-week summary cards** — total due / completed / pending / % complete (within visible scope).
2. **Brand-wise completion** — horizontal bar chart (Recharts).
3. **Store-by-store breakdown** — table grouped by brand: store, due, completed, %.
4. **Week-on-week trend** — line chart, last 8 ISO weeks, completion %.

Data fetched via server functions returning aggregates (avoid pulling raw rows). React Query invalidated on audit submit for "live" feel.

### 6. Admin CRUD UI

Full CRUD tables for brands, stores, employees, users (with role + scope assignment). Inline forms via shadcn `Dialog` + `react-hook-form` + `zod`. Soft-delete employees (set `active = false`) so historical audits remain valid.

### 7. Design

- Mobile-first, two-tab bottom nav on mobile, top nav on desktop.
- Neutral dark navy (`oklch` tokens) + white surface, with a per-brand accent color pulled from `brands.primary_color` (used on dashboard widgets when filtered to one brand). Default accent teal when cross-brand.
- Status badges: green = Completed, amber = Pending.
- Recharts for bar + line charts, minimal grid lines, large numerals.

### 8. Seeding

You'll send the data. I'll write a one-off SQL migration (or `INSERT` block) to load brands, stores, employees, and create demo auth users (one per role) so you can log in immediately after.

### 9. Out of scope for this build

- Real questionnaire builder (placeholder card only).
- Email/SMS notifications.
- Exports (CSV/PDF).
- Audit edit/delete after submission.

---

### Technical details

- **Stack:** TanStack Start + React + Tailwind v4 + shadcn/ui + Recharts + Lovable Cloud (Supabase).
- **Data layer:** `createServerFn` + `requireSupabaseAuth` for all reads/writes; TanStack Query `ensureQueryData` + `useSuspenseQuery` pattern; `supabaseAdmin` only in admin user-creation server fn.
- **Routing:** `_authenticated` layout gate + child `beforeLoad` hydrating session; `_authenticated/admin` layout adds `has_role('admin')` check.
- **Week math:** Postgres `date_trunc('week', ts)` (ISO Monday) for `week_start_date`; client uses same fn via server-fn aggregates so no client/server drift.
- **Realtime feel:** Mutation `onSuccess` invalidates `['employees']`, `['dashboard']` query keys. Optional: subscribe to `audit_sessions` via Supabase Realtime for true push updates (can add later).
