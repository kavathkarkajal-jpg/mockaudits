## Plan: Fix login bounce-back

**Root cause:** After sign-in, `_authenticated.beforeLoad` re-runs and calls `supabase.auth.getUser()`, but the protected child route also fires `getMyProfile` server-fn before the bearer token is attached. If anything in that chain throws (or the profile row is missing for the admin user), the guard redirects back to `/login`.

### Changes

1. **`src/routes/login.tsx`**
   - After `signInWithPassword` succeeds, await `supabase.auth.getUser()` to confirm session is hydrated before navigating.
   - Use `navigate({ to: "/conduct", replace: true })` to avoid back-stack returning to /login.
   - Surface any thrown error as a toast instead of silently bouncing.

2. **`src/routes/_authenticated.tsx`**
   - Wrap the profile `useQuery` with `enabled` so it only runs once Supabase has a user.
   - Make `getMyProfile` failures non-fatal (don't bubble into the error boundary that the user perceives as a redirect).

3. **`src/lib/api/mock-audit.functions.ts`** (verify only)
   - Confirm `getMyProfile` returns a sane shape for the seeded admin (id `d9612130…`) and doesn't throw if no `profiles` row exists yet — auto-insert a minimal admin profile row if missing.

4. **DB safety net** (only if step 3 shows the admin has no profile row)
   - One small migration to insert a `profiles` row + `user_roles` row for the admin user so `getMyProfile` always succeeds.

### Verification
- Hard-refresh preview, sign in as `ADMIN` / `Training@123`, confirm we land on `/conduct` and stay there.
- Check browser network: `/auth/v1/token` 200 → then `getMyProfile` server-fn 200, no redirect to `/login`.