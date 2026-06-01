# Verify login works — likely a stale tab

## What I observed
- Auth logs show your most recent sign-in attempt returned **200 OK** at 09:38:46 (no more "Database error querying schema").
- I just signed in via the preview as `ADMIN` / `Training@123` and was redirected to `/conduct` successfully.
- Your browser tab, however, still shows `/login?` — that trailing `?` plus the "Page loaded" event in the replay indicates the page is doing a full reload back to the login form, which only happens when the in-tab JS/auth state is out of sync with the (now fixed) database.

## What to do
1. In the preview, hard-refresh the tab (Cmd/Ctrl+Shift+R) to drop the stale bundle and local Supabase session.
2. Sign in again with **Store Code:** `ADMIN`, **Password:** `Training@123`.
3. You should land on `/conduct`.

No code or DB changes are needed. If after a hard refresh it still bounces you back to `/login`, reply and I will dig further (capture console logs from your tab and inspect the post-login server-fn call).
