## Plan

1. **Fix the audit card button markup**
   - Replace the current `Button asChild disabled` pattern around the `Link` in `src/routes/_authenticated/conduct.tsx`.
   - Render a real clickable `Link` for pending employees and a separate disabled-looking button/text state for completed employees.
   - This avoids invalid/fragile disabled behavior being passed through to an anchor.

2. **Clean up the related admin import regression**
   - Revert `QuestionsTab as QuestionsTabPanel` back to a direct `QuestionsTab` import in `src/routes/_authenticated/admin.tsx`, since the prior alias is a known source of unexpected click/interactivity issues in this app.

3. **Verify navigation path**
   - Confirm the pending employee button routes to `/conduct/$employeeId` and completed employees remain non-clickable.
   - Keep the existing weekly-completed business rule unchanged.