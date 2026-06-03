
## Redesign the Conduct (first) page to match the mockup

Restyle `/conduct` (the employee list) to match the attached mobile design. Pure visual work — no business logic, data, or routing changes.

### 1. Dark hero header (above the list)
Add a deep navy hero block at the top of `conduct.index.tsx`:
- "Welcome back," small label + bold "Mock Audit Manager" headline + subtitle "Conduct weekly mock audits for your team".
- Progress card inside the hero: clipboard icon in a blue circle, "This Week's Progress · NN% Completed" with a thin green progress bar, divider, then `X/Y Completed` and `Z Pending` stats.
- Numbers computed from existing `data` (completedThisWeek vs total) — no new server calls.

### 2. Light section header
Below the hero, on light background:
- Avatar circle + "Conduct Audit" title + "Select an employee to start their weekly mock audit".

### 3. Filter row restyle
- Search input with leading magnifier icon + a square filter-icon button beside it.
- Brand and Store selects styled as rounded pill cards with leading tag/store icons (keep existing Select logic).

### 4. Employee cards restyle
Each card becomes a full-width white rounded card with shadow:
- Left: circular initials avatar with pastel background (color hashed from name).
- Middle: bold name, employee code, "{Brand} • {Store}".
- Right: pill "Pending" (amber) / "Completed" (green) with clock/check icon + chevron.
- Full-width dark navy "Start Mock Audit" button with play icon (or disabled "Done this week" when completed).

### 5. Tokens
Add navy hero color + accent tokens in `src/styles.css` (semantic only, no hard-coded colors in components).

### Out of scope
- Bottom mobile tab bar (already exists in `_authenticated.tsx`); no change.
- Notification bell / hamburger from mockup — skipped unless requested.
- Routing, queries, auth, audit form page.

### Files
- edit `src/routes/_authenticated/conduct.index.tsx`
- edit `src/styles.css` (add tokens)
