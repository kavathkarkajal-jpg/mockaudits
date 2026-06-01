## Goal

Restrict the Dashboard so non-admin users (store_manager, regional_manager, business_head) only see their **own brand** — both brand cards and stores. Admin and trainer roles keep full visibility.

## Change

Scope `getDashboard` in `src/lib/api/mock-audit.functions.ts`:

1. Inside the handler, after loading the auth context, read the caller's role and `brand_id` from their `profiles` / `user_roles` row (use the existing `current_user_role` / `current_brand_id` SQL helpers, or fetch via `supabase.from("profiles")` + `user_roles`).
2. If role ∈ {`store_manager`, `regional_manager`, `business_head`} **and** they have a `brand_id`:
   - Filter the `brands` query: `.eq("id", brandId)`
   - Filter the `stores` query: `.eq("brand_id", brandId)`
   - Employees are already RLS-scoped via `can_access_store`, no extra filter needed.
3. Admin / trainer: behaviour unchanged (sees all brands).

Result: a GAS store manager only sees the GAS brand card and GAS stores; all aggregations (totals, trend, brand cards, store table) compute over that scoped set automatically.

## Out of scope

- No DB migration (RLS already correctly restricts employees/audit_sessions).
- No UI changes to `dashboard.tsx` — it just renders whatever the server returns.
- Conduct / Admin pages unchanged.

## Verification

- Log in as a GAS-brand store_manager → dashboard shows only GAS brand card + GAS stores.
- Log in as admin → still sees all brands.
