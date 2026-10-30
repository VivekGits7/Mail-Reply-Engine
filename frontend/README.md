# Mail Reply Engine Frontend

React dashboard for managing HR workflows, approvals and administration.

## Getting started

Requires Bun and a running backend. Run commands from this directory.

1. Create `.env` from `.env.example` and configure `APP_URL`, `APP_API_URL` and `APP_ENV`.
2. Install dependencies with `bun install`.
3. Start the frontend with `bun run dev`.

Open `http://localhost:2102` and sign in with a backend account. Set `APP_API_URL` to the backend origin without `/api`.

Run `bun run check` for lint, tests and the production build.

For Docker setup, see the [VM commands](../CMD.md).
