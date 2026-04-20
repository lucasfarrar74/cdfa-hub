# CLAUDE.md

Guidance for AI coding agents working on this repository.

## Project at a glance

CDFA Hub is a React 19 + TypeScript + Vite single-page app. It helps run supplier/buyer B2B meeting events — scheduling, budget, project management. Data lives in browser `localStorage` with optional Firebase cloud sync. There is no backend server we own; Firebase provides auth and Firestore.

Deployed on Vercel, auto-deploying from `master`. GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests, and build on every push and PR — but it surfaces failures rather than blocking the deploy, since Vercel's GitHub integration deploys whenever master advances. A failing CI run on master means the live site is probably broken.

## The user

The primary developer is a novice coder. Prefer plain language. Define technical terms the first time they appear in a conversation. Lead with user-visible effect before implementation details.

## Critical constraints

### Changes must reach Vercel
A change working in `npm run dev` is not "done." The live app is the Vercel deploy, which updates when commits land on `origin/master`. Before claiming a feature is live, verify the commit is pushed.

### Dev-vs-prod auth gate
`src/context/AuthContext.tsx` reads `VITE_ENABLE_AUTH` from the environment. When unset or not `'true'`, the app runs in solo-dev mode with a hardcoded local user (`Lucas Farrar`). When `'true'`, Firebase auth is active and users must sign in. Set the env var to `true` in Vercel only after completing the Firebase Console checklist below.

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
The repo on GitHub is `lucasfarrar74/cdfa-hub`. Push to `master` to deploy. CI runs on every push and PR (`.github/workflows/ci.yml`: lint, tests, build). CI failure does not block the Vercel deploy — check the Actions tab after pushing to master.

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

---

## Enabling collaboration (one-time setup)

The app's real-time collaboration (two admins editing the same event) requires three things to be true: Firestore rules deployed, Firebase sign-in methods enabled, and `VITE_ENABLE_AUTH=true` in the environment. Miss any one and the UI will appear to work locally but teammates won't see each other's changes.

### 1. Deploy Firestore security rules

Rules live in `firestore.rules` at the repo root. Deploy them from a machine that has access to the Firebase project:

```bash
npx firebase-tools login
npx firebase-tools use meeting-scheduler-c045b
npx firebase-tools deploy --only firestore:rules
```

Re-run this any time `firestore.rules` changes. Without this step, Firestore denies all reads and writes — the app sees `permission-denied` and the sync indicator turns red with a rules-related message.

### 2. Firebase Console checklist

In the [Firebase Console](https://console.firebase.google.com) for project `meeting-scheduler-c045b`:

- **Authentication → Sign-in methods** → enable **Google** and **Email/Password**
- **Authentication → Settings → Authorized domains** → add the Vercel production domain (e.g. `cdfa-hub.vercel.app`) and any custom domains
- **Firestore Database** → if not already created, create in production mode. Region `us-west1` is a reasonable default
- Mirror the six `VITE_FIREBASE_*` env vars from local `.env` into the Vercel project dashboard (Production + Preview environments)

### 3. Flip the auth switch

Add `VITE_ENABLE_AUTH=true` to the Vercel production env vars, then trigger a new deploy (push any commit or use the Vercel dashboard's "Redeploy" button). Local `.env` can follow the same pattern when you want to test auth locally.

### Two-browser smoke test

After a change to the collaboration code, run this five-minute check:

1. Browser A: sign in, create a project, click Share, copy the link.
2. Browser B (incognito, different account): open the link. Project loads.
3. Browser A: add a meeting → Browser B shows it within ~2 seconds.
4. Browser B: bump the meeting → Browser A reflects the move.
5. Both browsers show a green "Synced" indicator.

If step 2 or 3 fails, check the sync indicator tooltip — it now surfaces the Firebase error code (e.g. `permission-denied` means rules weren't deployed).

### Version banner

Every page mounts `<NewVersionBanner>` (see `src/components/NewVersionBanner.tsx`), which polls `/version.json` every 60 seconds and prompts a refresh when the deployed build is newer than what the browser is running. This is the defense against "teammate on a stale tab" problems during live events — don't remove it.
