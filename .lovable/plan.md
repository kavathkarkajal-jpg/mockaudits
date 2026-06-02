## Plan

1. **Fix the nested conduct route layout**
   - The button is navigating to `/conduct/$employeeId`, but `src/routes/_authenticated/conduct.tsx` is currently both the `/conduct` list page and the parent route for `/conduct/$employeeId`.
   - Because it does not render an `<Outlet />`, the child audit form route matches but cannot appear.

2. **Move the employee list into an index child route**
   - Turn `src/routes/_authenticated/conduct.tsx` into a lightweight layout route that renders `<Outlet />`.
   - Create `src/routes/_authenticated/conduct.index.tsx` for the current employee list UI.
   - Keep the existing button link target as `/conduct/$employeeId` with `params={{ employeeId: e.id }}`.

3. **Verify route behavior**
   - Confirm `/conduct` shows the employee list.
   - Confirm clicking **Start Mock Audit** changes to `/conduct/{employeeId}` and renders the audit form.
   - Confirm completed employees still show the disabled **Done this week** button.