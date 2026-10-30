#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_CONTAINER="${DB_CONTAINER:-doe-postgres}"
DB_NAME="${DB_NAME:-mail_reply_engine}"
DB_USER="${DB_USER:-kuberyauser}"
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

Defaults: DB_CONTAINER=doe-postgres, DB_NAME=mail_reply_engine, DB_USER=kuberyauser.
Override these environment variables when the server uses different values.
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

if [ "${#files[@]}" -eq 0 ]; then
  usage >&2
  exit 2
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

printf 'Target: %s / %s as %s\n' "$DB_CONTAINER" "$DB_NAME" "$DB_USER"
printf 'SQL: %s\n' "${files[@]}"
if "$DRY_RUN"; then
  echo "Dry run, no Docker or database commands executed"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required, run this script on the TCG server" >&2
  exit 1
fi
if [ "$(docker inspect --format '{{.State.Running}}' "$DB_CONTAINER")" != true ]; then
  printf 'Postgres container is not running: %s\n' "$DB_CONTAINER" >&2
  exit 1
fi

docker_args=(exec -i)
if [ "${PGPASSWORD+x}" = x ]; then
  export PGPASSWORD
  docker_args+=(--env PGPASSWORD)
fi

psql_args=(psql -X --no-password --set ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" --file=-)
if "$RUN_ALL"; then
  {
    for file in "${files[@]}"; do
      if ! cat "$file"; then
        printf '\\quit 1\n'
        exit 1
      fi
      printf '\n'
    done
  } | docker "${docker_args[@]}" "$DB_CONTAINER" "${psql_args[@]}" --single-transaction
else
  for file in "${files[@]}"; do
    printf 'Applying %s\n' "$(basename "$file")"
    if grep -Eiq '^[[:space:]]*(BEGIN|START[[:space:]]+TRANSACTION)[[:space:]]*;' "$file"; then
      docker "${docker_args[@]}" "$DB_CONTAINER" "${psql_args[@]}" < "$file"
    else
      docker "${docker_args[@]}" "$DB_CONTAINER" "${psql_args[@]}" --single-transaction < "$file"
    fi
  done
fi

echo "SQL completed successfully"
