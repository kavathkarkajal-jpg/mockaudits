# Login page tweak + bootstrap admin account

## 1. Login page (`src/routes/login.tsx`)

- Replace the tagline "Retail L&D operations" with **"Adidas Kids"**, shown as a small uppercase brand line above the "Mock Audit Manager" title (so the brand reads as the parent, the app name reads as the product).
- No other layout, color, or copy changes.

## 2. Bootstrap admin account

Create a one-shot migration that provisions the admin user via Postgres so you can sign in immediately:

- Insert a row in `auth.users` with email `admin@mockaudit.app`, password `Training@123` (bcrypt-hashed via `crypt()`), `email_confirmed_at = now()`.
- Insert matching `public.profiles` row (store_code `ADMIN`, full name "Admin").
- Insert `public.user_roles` row with role `admin`.
- Idempotent: skip inserts if the email already exists.

### Your login credentials
- **Store Code:** `ADMIN`
- **Password:** `Training@123`

Once signed in you can create all other users (store managers, regional managers, trainers, business heads) from the Admin → Users tab.
