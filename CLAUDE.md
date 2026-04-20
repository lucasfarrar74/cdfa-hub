# CLAUDE.md

Guidance for AI coding agents working on this repository.

## Project at a glance

CDFA Hub is a React 19 + TypeScript + Vite single-page app. It helps run supplier/buyer B2B meeting events — scheduling, budget, project management. Data lives in browser `localStorage` with optional Firebase cloud sync. There is no backend server we own; Firebase provides auth and Firestore.

Deployed on Vercel, auto-deploying from `master`. No CI runs before deploy — a broken push goes straight to the live site.

## The user

The primary developer is a novice coder. Prefer plain language. Define technical terms the first time they appear in a conversation. Lead with user-visible effect before implementation details.

## Critical constraints

### Changes must reach Vercel
A change working in `npm run dev` is not "done." The live app is the Vercel deploy, which updates when commits land on `origin/master`. Before claiming a feature is live, verify the commit is pushed.

### Dev-vs-prod auth gate
`src/context/AuthContext.tsx` has `const ENABLE_AUTH = false`. This disables Firebase login for local solo development and substitutes a default user (`Lucas Farrar`). Production should have this `true`. Do not remove the flag; when touching auth, check which mode the code assumes.

### Scheduler correctness
The scheduler in `src/features/scheduler/utils/` is the most complex and most-churned code. Core invariant: **no supplier or buyer may hold two active meetings in the same slot.** PR #1 fixed a case where the compaction phase could violate this. Any change to `scheduleCompaction.ts`, `scheduleOptimizer.ts`, or `scheduler.ts` must keep tests green and preserve this invariant.

## Tech stack quick reference

- **Framework**: React 19 + Vite 7 (NOT Next.js — no SSR, no API routes, client-side only)
- **Router**: React Router 7 (BrowserRouter)
- **Styling**: Tailwind CSS 4 (utility classes; minimal custom CSS in `index.css`)
- **Types**: Domain types in `src/features/*/types/`; shared types in `src/types/`
- **State**: React Context (`AuthContext`, `ThemeContext`) + custom hooks (`useLocalStorage`)
- **Storage**: `localStorage` primarily; Firestore via `useFirebaseSync` when cloud sync is on
- **Exports**: `docx`, `jspdf`, `xlsx`, `papaparse`, `file-saver`
- **Drag/drop**: `@dnd-kit`

## Conventions

### Routing
Routes are declared in `src/App.tsx`. Protected routes wrap in `ProtectedRoute`; public routes (just `/login`) wrap in `PublicRoute`. When adding a page, create it in `src/pages/` and register the route in `App.tsx`.

### Feature folders
Each major feature lives under `src/features/<feature>/` with its own `types/`, `utils/`, and (sometimes) `components/`. The meeting scheduler is the canonical example — mirror its shape when adding features.

### TypeScript
Strict mode is on (`noUnusedLocals`, `noUnusedParameters`, `strict`). `verbatimModuleSyntax` requires `import type` for type-only imports. Don't add unused variables or parameters.

### Tests
Vitest is set up. Test files live as `*.test.ts` next to the code they test and are excluded from the production build (`tsconfig.app.json` excludes them). Shared test fixtures live in `src/features/scheduler/utils/__testHelpers.ts`.

Run tests: `npm run test` (watch mode) or `npx vitest run` (single pass).

### Commits & PRs
The repo on GitHub is `lucasfarrar74/cdfa-hub`. Push to `master` to deploy. No CI runs pre-merge.

## Common pitfalls

- **Don't treat this like Next.js.** There are no `pages/api/`, no server components, no `getServerSideProps`. Everything is client-side.
- **Don't bypass `localStorage`.** Data flow goes through the scheduler context and `useLocalStorage` — talking to `localStorage` directly will skip updates.
- **Don't forget the auth gate.** If your change needs the user object, remember that in dev the default user is hardcoded.
- **Don't add unused imports or parameters** — TypeScript strict mode will fail the build.
- **Dates in `TimeSlot`**: `startTime` and `endTime` are `Date` objects, but they can arrive as ISO strings after JSON import. Code that compares them uses `instanceof Date ? x : new Date(x)` defensively.

## Where to start when making a change

1. **UI pages**: `src/pages/<Page>.tsx`
2. **Scheduler logic**: `src/features/scheduler/utils/`
3. **Data persistence**: `src/hooks/useLocalStorage.ts` and Firebase hooks in `src/lib/`
4. **Navigation / sidebar**: `src/config/navigation.ts` and `src/components/layout/`
5. **Types**: `src/features/scheduler/types/index.ts` for the scheduler; feature-specific folders otherwise
