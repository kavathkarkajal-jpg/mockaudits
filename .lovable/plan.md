
## Redesign `/conduct/$employeeId` to match the mockup

Pure visual redesign of `src/routes/_authenticated/conduct.$employeeId.tsx`. No changes to data, scoring, server functions, or routing.

### 1. Dark navy hero header
Replace the plain title row with a deep navy block that contains:
- Top row: back arrow (Link to `/conduct`) on left, "Conduct Audit" centered, three-dot menu placeholder on right.
- Employee strip: circular initials avatar (pastel, hashed from name) + bold name + "{Brand} · {Store}" subtitle on left; small bordered "Current Score" card on the right showing the employee's avg score in green (`87%` style), with a tiny sparkline-ish accent. If no prior score, show "—".
- Progress row: "Question X-Y of N" left, "NN%" right, then a thin green progress bar. X-Y = "answered+1" range, N = total, % = answered/total.
- Section card (still inside navy hero): rounded, slightly lighter navy with subtle border. Left: small icon tile + "Section 1" kicker + "Customer Engagement" title + "M / K Questions" subtitle. Right: small bordered "Section Score" card with trophy icon and green percentage.
  - For now (no section metadata in DB), render a single synthetic "Section 1 · Questionnaire" with `answered / total`. Real sections are out of scope.

### 2. Light questions area
Below the hero, on the page background:
- Each question rendered as a full-width white rounded card with soft shadow:
  - Left gutter: status dot — filled green check when answered, hollow blue ring when current/unanswered.
  - Header row: `Q{n}.` bold + question text. Bookmark icon on the right (visual only, non-functional).
  - Below: existing input control (yes/no, choice, rating, etc.) — keep all logic.
  - Footer row (only when answered and question has points): green pill on left showing the chosen label (e.g. "Excellent", "Greeting Only") + amber/green "+N pt(s)" pill on right with chevron. For text/date answers, show a short summary instead of a label pill; hide the points pill if `max_score === 0`.
  - The "current" (first unanswered) card gets a blue ring border to match the mockup's Q10 state.

### 3. Submit / score footer
Keep the existing computed-score + notes + submit card, restyled to match (white rounded card, navy primary button). No logic changes.

### 4. Tokens
Reuse the navy tokens already added for the list page in `src/styles.css`. Add only what's missing (e.g. a slightly lighter navy surface for the section card, success/amber pill tokens) — semantic only.

### Out of scope
- Real "sections" data model (mockup shows "Section 1 of N" — we render one synthetic section).
- Bookmark / three-dot menu functionality (icons only).
- Sparkline graphic in the score card (use a static accent line).
- Bottom tab bar (already exists in `_authenticated.tsx`).
- Any change to scoring, submission, question types, or routing.

### Files
- edit `src/routes/_authenticated/conduct.$employeeId.tsx`
- edit `src/styles.css` (only if new tokens needed)
