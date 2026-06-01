# Fix admin login — null auth token columns

The Supabase Auth service refuses to log in any user whose row in `auth.users` has NULL values in the internal token columns. The bootstrap admin row was inserted without populating them, so every sign-in returns 500 "Database error querying schema".

## Fix

Update the admin row (and any future-safe sibling rows) to set the four token columns to empty strings:

```sql
UPDATE auth.users
SET confirmation_token       = '',
    recovery_token           = '',
    email_change             = '',
    email_change_token_new   = ''
WHERE email = 'admin@mockaudit.app';
```

After this runs, sign in at `/login` with:
- **Store Code:** `ADMIN`
- **Password:** `Training@123`

No code changes needed.
