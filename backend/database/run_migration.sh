#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DRY_RUN=false
RUN_ALL=false
files=()

usage() {
  cat <<'HELP'
Usage: run_migration.sh [--dry-run] [file.sql ...]

With no files, applies the SQL files listed in schema_order.txt.
Bare file names are resolved from this directory, such as auth.sql people.sql.
--init is also supported as an alias for applying all schema files.
All schema files run in one transaction. Named files run in order and stop at
first error, preserving any existing transaction blocks.

Reads POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD and the internal
Postgres port from backend/.env through Docker Compose. Requires Docker Compose
and Python 3. DB_CONTAINER can override the default container, doe-postgres.
--dry-run resolves configuration and lists files without connecting to Postgres.
HELP
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --init) RUN_ALL=true ;;
    --help|-h) usage; exit 0 ;;
    --*) printf 'Unknown option: %s\n' "$arg" >&2; usage >&2; exit 2 ;;
    *) files+=("$arg") ;;
  esac
done

if [ "${#files[@]}" -eq 0 ]; then
  RUN_ALL=true
fi

if "$RUN_ALL"; then
  if [ "${#files[@]}" -ne 0 ]; then
    echo "Use either --init or explicit SQL files, not both" >&2
    exit 2
  fi
  while IFS= read -r file || [ -n "$file" ]; do
    case "$file" in ''|\#*) continue ;; esac
    files+=("$SCRIPT_DIR/$file")
  done < "$SCRIPT_DIR/schema_order.txt"
fi

for index in "${!files[@]}"; do
  file="${files[$index]}"
  if [ ! -f "$file" ] && [ -f "$SCRIPT_DIR/$file" ]; then
    file="$SCRIPT_DIR/$file"
  fi
  if [ ! -f "$file" ] || [ ! -r "$file" ] || [[ "$file" != *.sql ]]; then
    printf 'Readable SQL file not found: %s\n' "$file" >&2
    exit 2
  fi
  files[$index]="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"
done

if [ ! -r "$BACKEND_DIR/.env" ]; then
  echo "Create backend/.env with the server database credentials first" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo "Docker Compose and Python 3 are required on the TCG server" >&2
  exit 1
fi

docker compose --project-directory "$BACKEND_DIR" --env-file "$BACKEND_DIR/.env" \
  -f "$BACKEND_DIR/docker-compose.yml" config --format json | python3 -c '
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def fail(message, code=1):
    print(message, file=sys.stderr)
    raise SystemExit(code)


try:
    config = json.load(sys.stdin)
    db = config["services"]["mail-reply-engine-backend"]["environment"]
except (ValueError, KeyError, TypeError):
    fail("Could not load backend/.env through Docker Compose")

# Compose escapes literal dollar signs when rendering its config.
db = {key: value.replace("$$", "$") if isinstance(value, str) else value for key, value in db.items()}

for key in ("POSTGRES_DB_NAME", "POSTGRES_DB_USER"):
    if not db.get(key):
        fail(f"Set {key} in backend/.env")
if db.get("POSTGRES_DB_PASSWORD") is None:
    fail("Set POSTGRES_DB_PASSWORD in backend/.env")

container = sys.argv[1] or db.get("DB_CONTAINER") or "doe-postgres"
dry_run = sys.argv[2] == "true"
run_all = sys.argv[3] == "true"
files = [Path(value) for value in sys.argv[4:]]
if not files:
    fail("No SQL files selected", 2)
db_name = db["POSTGRES_DB_NAME"]
db_user = db["POSTGRES_DB_USER"]
db_port = str(db.get("POSTGRES_DB_PORT") or "5432")
if not db_port.isdigit() or not 0 < int(db_port) < 65536:
    fail("Set a valid internal Postgres port in backend/.env")
password = db["POSTGRES_DB_PASSWORD"]

print(f"Target: {container} / {db_name} as {db_user} (TCP 127.0.0.1:{db_port})", flush=True)
for path in files:
    print(f"SQL: {path}", flush=True)
if dry_run:
    print("Dry run, no Postgres connection or SQL execution")
    raise SystemExit(0)

state = subprocess.run(
    ["docker", "inspect", "--format", "{{.State.Running}}", container],
    capture_output=True,
    text=True,
)
if state.returncode or state.stdout.strip() != "true":
    fail(f"Postgres container is unavailable or not running: {container}")

env = os.environ.copy()
env["PGPASSWORD"] = password
env["PGCONNECT_TIMEOUT"] = "5"
psql = [
    "docker", "exec", "-i", "--env", "PGPASSWORD", "--env", "PGCONNECT_TIMEOUT", container,
    "psql", "-X", "--no-password", "--set", "ON_ERROR_STOP=1",
    "--host", "127.0.0.1", "--port", db_port,
    "--username", db_user, "--dbname", db_name,
]


def run_psql(arguments, data=b"", quiet=False):
    result = subprocess.run(
        psql + arguments,
        input=data,
        env=env,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.PIPE,
    )
    message = result.stderr.decode("utf-8", errors="replace")
    if password:
        message = message.replace(password, "[redacted]")
    if message:
        print(message, file=sys.stderr, end="" if message.endswith("\n") else "\n")
    if result.returncode:
        if quiet:
            print("Login check failed. Verify POSTGRES_DB_USER, POSTGRES_DB_PASSWORD and POSTGRES_DB_NAME in backend/.env. The configured role and database must already exist.", file=sys.stderr)
        raise SystemExit(result.returncode)


run_psql(["--command", "SELECT 1"], quiet=True)
if run_all:
    data = b"\n".join(path.read_bytes() for path in files) + b"\n"
    run_psql(["--single-transaction", "--file=-"], data)
else:
    for path in files:
        print(f"Applying {path}", flush=True)
        data = path.read_bytes()
        owns_transaction = re.search(rb"^[\t ]*(BEGIN|START[\t ]+TRANSACTION)[\t ]*;", data, re.I | re.M)
        arguments = ["--file=-"] if owns_transaction else ["--single-transaction", "--file=-"]
        run_psql(arguments, data)
print("SQL completed successfully")
' "${DB_CONTAINER:-}" "$DRY_RUN" "$RUN_ALL" "${files[@]}"
