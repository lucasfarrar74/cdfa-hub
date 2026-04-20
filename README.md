# CDFA Hub

A web-based operations tool for planning trade missions and supplier/buyer B2B meeting events — covering event setup, scheduling, budget tracking, and data import/export in one place.

Built with React 19, TypeScript, Vite, and Tailwind CSS. Data is stored in the browser (localStorage) with optional Firebase cloud sync.

## Features

| Page | Purpose |
|---|---|
| Dashboard | Quick stats and shortcuts |
| Projects | Activity list, team directory, templates |
| Meeting Scheduler | Build supplier/buyer meeting timetables with conflict-free scheduling |
| Budget Tracker | Per-activity expense tracking and reports |
| Data Import | Upload Excel files of suppliers and buyers |
| Activity Links | Connect the same event across tools |
| Backup | Export, import, and restore your data |

## Running locally

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The app will open on `http://localhost:5173` (Vite's default port).

### Scripts

- `npm run dev` — start the dev server with hot reload
- `npm run build` — type-check and build for production into `dist/`
- `npm run preview` — serve the production build locally
- `npm run test` — run the Vitest test suite
- `npm run lint` — check code for lint errors

## Environment setup

Firebase credentials live in a `.env` file at the repo root. Copy `.env.example` to `.env` and fill in values from the Firebase console for project `meeting-scheduler-c045b`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

For solo local development, login is currently disabled. See `ENABLE_AUTH` in `src/context/AuthContext.tsx`.

## Deployment

The live site is hosted on Vercel and auto-deploys whenever the `master` branch advances on GitHub. There is no separate deploy step.

Vercel configuration lives in `vercel.json`. Environment variables for the live build are set in the Vercel project dashboard (mirror the local `.env` keys).

**A change isn't live until it's on `origin/master` and Vercel has picked it up.** Running it locally only verifies it works on your computer.

## Project structure

```
src/
├── pages/          # Top-level screens (one per route)
├── features/       # Feature logic (scheduler, budget, projects)
├── components/     # Reusable UI components
├── context/        # React context providers (auth, theme)
├── lib/            # Firebase setup and external integrations
├── config/         # App-level config (navigation, etc.)
├── hooks/          # Custom React hooks
├── types/          # Shared TypeScript types
└── utils/          # Helper functions
```

Tests sit alongside the code they cover as `*.test.ts` files. The scheduler utilities in `src/features/scheduler/utils/` are the most thoroughly tested; add more tests there as the logic grows.
