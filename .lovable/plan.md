## Problem

The preview is broken by a build-time error:

```
TypeError: Duplicate declaration "QuestionsTab"
  at detectCodeSplitGroupingsFromRoute (@tanstack/router-plugin code-splitter)
```

Because the build fails, no route renders correctly — including the "Start Mock Audit" buttons on `/conduct`. This isn't a click-handler bug; the app simply isn't compiling.

## Root cause

`src/routes/_authenticated/admin.tsx` imports a component whose name matches the imported binding:

```ts
import { QuestionsTab } from "@/components/admin/QuestionsTab";
...
<QuestionsTab brands={...} />
```

TanStack Router's code-splitter rewrites route files and, in this case, ends up declaring a second `QuestionsTab` binding in the generated split chunk — Babel then throws "Duplicate declaration".

## Fix

Alias the import in `admin.tsx` so the local binding name differs from the splitter's generated name:

```ts
import { QuestionsTab as QuestionsTabPanel } from "@/components/admin/QuestionsTab";
...
<TabsContent value="questions"><QuestionsTabPanel brands={data?.brands ?? []}/></TabsContent>
```

No other files change. After the rebuild, `/conduct` renders and "Start Mock Audit" is clickable again.

## Verification

- Confirm the runtime error disappears.
- Open `/conduct`, click "Start Mock Audit" on an employee, confirm the audit page loads.
