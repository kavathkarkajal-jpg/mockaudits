## Redesign `/login` to match the mockup

Pure visual redesign of `src/routes/login.tsx`. No auth logic changes.

### Layout
- Dark navy full-screen background with subtle decorative accents: small indigo dot grid (top-left), large faint ring (top-right), small ring (bottom-left), tiny dot column (bottom-right). Pure CSS / inline SVG, no images.
- Centered column:
  1. **Brand mark**: rounded-square tile with soft indigo gradient + glow, containing a clipboard-check icon (lucide `ClipboardCheck`) in indigo/violet gradient stroke.
  2. **Title**: "Mock Audits" — large bold white (display weight).
  3. **Tagline**: "Smarter Audits. Better Performance." — muted slate.
  4. Short indigo underline accent.
  5. **Card**: translucent navy panel with subtle border + inner glow.
     - "Welcome back!" heading + "Sign in to continue to your account" subtitle.
     - **Store Code** field: label above, input with a leading store icon (lucide `Store`), indigo focus ring, transparent fill, rounded.
     - **Password** field: leading lock icon (lucide `Lock`), trailing eye-toggle (lucide `Eye` / `EyeOff`) that toggles input type between password/text.
     - **Sign In button**: full-width gradient indigo→violet, white text, trailing arrow (lucide `ArrowRight`), soft glow shadow. Keeps existing `onSubmit` handler.
     - Divider row with shield icon + "Secure & Private" centered between two faint lines.

### Copy changes
- Remove the "Adidas Kids" eyebrow.
- Title becomes **Mock Audits** (not "Mock Audit Manager").
- Tagline: **Smarter Audits. Better Performance.**

### Tokens
- Add a couple of semantic tokens to `src/styles.css` only if needed (e.g. `--login-bg`, `--brand-indigo`, `--brand-violet`, gradient + glow). Reuse existing navy tokens where possible. All colors via design tokens, no hard-coded hex in JSX.

### Out of scope
- No changes to `signInWithPassword` flow, email derivation, navigation, or toast behavior.
- No new routes (forgot password, signup) — not in mockup.
- Page `head()` title stays "Sign in — Mock Audit Manager" unless you want it updated too.

### Files
- edit `src/routes/login.tsx`
- edit `src/styles.css` (only if new tokens needed)
