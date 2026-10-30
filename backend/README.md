# Mail Reply Engine Backend

FastAPI backend for automated HR email handling, onboarding, exits and follow-ups.

## Getting started

Requires Python 3.11+, PostgreSQL and the dependencies in `pyproject.toml`. Run commands from this directory using the configured Python environment.

1. Create `.env` from `.env.example` and configure the database, storage and external services.
2. Create an admin account and start the API:

```bash
guvrun scripts/create_admin.py --name "Admin" --email admin@example.com
guv app.main:app --reload --host 0.0.0.0 --port 2101
```

Swagger is available at `http://localhost:2101/docs` in development mode.

For Docker setup and running database SQL files, see the [VM commands](../CMD.md).
