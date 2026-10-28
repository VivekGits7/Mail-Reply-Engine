# Dummy mode — backend disconnected

Date: 2026-10-28

This frontend was wired to disconnect from the real backend and run fully on
dummy (fake) data, so it can be opened and clicked through with no API server
running. **No original code was deleted.** Every real backend call was
commented out in place, directly above the dummy replacement that now runs
instead. To reconnect later, delete the dummy block in each file and
uncomment the original block.

## What changed

All backend calls in this project go through 11 `*api.ts` files, each
calling one shared axios instance (`src/redux/axios.ts`). Nothing else in the
app talks to the backend directly. In each of the 11 files below, the
`axiosInstance` import was commented out and every method on the exported
`xxxApi` object was replaced with a dummy async function that resolves
immediately with realistic-looking fake data matching the same TypeScript
response types the backend would have returned. The original implementation
is left directly above as a comment, clearly marked.

| File | What it dummies |
|---|---|
| `src/components/auth/Authapi.ts` | Login, current-user ("me"), update-my-photo, logout. Login now always succeeds and returns a fake HR Admin user (`demo.admin@tcgdigital.com`) + fake token — this is what lets you get past the login screen with no backend. |
| `src/components/admin/Usersapi.ts` | Users list/create/update — returns 2 fake users. |
| `src/components/admin/Adminapi.ts` | System status, kill-switch, dry-run, settings, checklist templates, induction templates, holidays, action log, failures + retry, statement-of-understanding upload, email templates + preview. |
| `src/components/approvals/Approvalsapi.ts` | Approvals list/detail/save-draft/approve/reject — 1 fake pending "reply" approval. |
| `src/components/cases/Casesapi.ts` | Case detail, case update, task update, sign-off, checklist override, release confirm, plan induction, appointment-letter upload, book induction session, attachment download URL, case emails — 1 fake case (`case_dummy_001`) for "Demo Joiner" with a task, a checklist item and a timeline entry. |
| `src/components/complaints/Complaintsapi.ts` | Complaints list/detail, attachment download URL, upload transcript — 1 fake complaint. |
| `src/components/exits/Exitsapi.ts` | Exits list/create — 1 fake exit case ("Demo Leaver") with all 4 clearances pending. |
| `src/components/feedback/Feedbackapi.ts` | Surveys list, upload responses, reports list/create, report download URL — 1 fake survey + 1 fake report. |
| `src/components/joiners/Joinersapi.ts` | Joiners list/create/update — 1 fake joiner ("Demo Joiner"), same person used in the case detail dummy above. |
| `src/components/reminders/Remindersapi.ts` | Reminder rules list/create/update, upload recipient list, rule tasks list — 1 fake reminder rule + 1 fake task. |
| `src/components/upload/Uploadapi.ts` | File presign + upload. Instead of calling S3/the backend, `presign` now creates a local in-browser object URL (`URL.createObjectURL`) for the picked file, so file/photo pickers still preview correctly offline. The plain `axios.post` call to cloud storage is also commented out and skipped. |

`src/redux/axios.ts` (the shared axios instance) was **left untouched** —
it's just configuration and is no longer called by anything now that every
`*api.ts` file above is dummied, so leaving it in place is harmless and makes
reconnecting later a one-step job (just uncomment the calls that use it).

## What was NOT touched

- `src/types/schema.ts` and `src/types/api.ts` — generated/shared response
  types. Dummy data is written to match these exactly, so the app keeps
  compiling in strict TypeScript.
- Every page/component that *consumes* these APIs (e.g. `Overview.tsx`,
  `Joiners.tsx`, `CaseDetail.tsx`, `UserMenu.tsx`, etc.) — they didn't need
  any changes, since they only ever import the `xxxApi` objects and never
  call axios directly.
- All `*.test.tsx` / `*.test.ts` files — they mock the `*api.ts` modules
  entirely with `vi.mock(...)`, so they don't exercise the dummy
  implementations at all and were unaffected.

## How login works now

The login screen accepts **any** email/password (the real validation — 8+
char password, valid email — still runs client-side, but nothing is checked
against a server). Submitting always succeeds and signs you in as a fake HR
Admin user. Use anything that passes the form validation, e.g.:
- Email: `demo.admin@tcgdigital.com`
- Password: `password123`

## Verified after making this change

- `npx tsc --noEmit -p tsconfig.app.json` — passes, no type errors.
- `npx oxlint` — passes, no lint errors.
- `npx vitest run` — all 20 test files / 64 tests pass.
- `npm run build` — production build succeeds.
- Ran the app in a real browser (`npm run dev`, Playwright): landing page,
  login (with dummy credentials), Overview dashboard, Joiners list, a case
  detail page, and Admin → Controls all loaded with the fake data above and
  no console errors.

## How to reconnect to the real backend later

In each file listed in the table above:
1. Delete the block under `// --- DUMMY implementation ---`.
2. Uncomment the block under `// --- Original backend-connected implementation (commented out, see dummy.md) ---`.
3. Uncomment the `// import axiosInstance from '@/redux/axios';` line at the top of the file.
4. Remove the `DUMMY_*` fixture constants that are no longer used.

Then delete this file.
