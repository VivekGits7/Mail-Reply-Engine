# Mail Reply Engine on the VM

Each service reads `.env`. To use its saved VM settings, copy `vm.env` to `.env` in that service directory before running the commands below.

## MinIO

### Redeploy

Update the VM checkout first. `--build` uses the latest code, `--force-recreate` reloads `.env`, and `--wait` waits for MinIO health. `minio-init` configures the encrypted private bucket and app access, then removes itself.

```bash
cd /home/appadmin/mail-reply-engine/services/minio
unset MINIO_API_PORT MINIO_CONSOLE_PORT MINIO_API_BIND MINIO_CONSOLE_BIND
docker compose --env-file .env -f docker-compose.yml up -d --build --force-recreate --wait --wait-timeout 60 minio
docker compose --env-file .env -f docker-compose.yml run --rm minio-init
docker compose --env-file .env -f docker-compose.yml ps
docker port mail-reply-engine-minio
```

### Stop and rebuild

Remove existing containers before rebuilding. Omit `-v` from `down` to preserve the storage volume and its files.

```bash
cd /home/appadmin/mail-reply-engine/services/minio
unset MINIO_API_PORT MINIO_CONSOLE_PORT MINIO_API_BIND MINIO_CONSOLE_BIND
docker compose --env-file .env -f docker-compose.yml down --remove-orphans
docker compose --env-file .env -f docker-compose.yml up -d --build --force-recreate --wait --wait-timeout 60 minio
docker compose --env-file .env -f docker-compose.yml run --rm minio-init
docker compose --env-file .env -f docker-compose.yml ps
docker port mail-reply-engine-minio
```

### Logs

```bash
cd /home/appadmin/mail-reply-engine/services/minio
docker compose logs -f --tail 100 minio             # last 100 MinIO lines, then live
```

## Backend

### Redeploy

```bash
cd /home/appadmin/mail-reply-engine/backend         # go to the backend folder
docker network inspect mail-reply-engine-network >/dev/null 2>&1 || docker network create mail-reply-engine-network
docker network inspect doe-net >/dev/null           # confirm the existing Postgres network
docker compose down --remove-orphans                # stop old application containers
docker compose up -d --build                        # build and start the backend
docker compose up -d --force-recreate               # reload .env
docker compose ps                                  # show container status
```

### Logs

```bash
cd /home/appadmin/mail-reply-engine/backend
docker compose logs -f --tail 100 mail-reply-engine-backend
```

### Initialize a fresh database

Skip creation if the database already exists. This command reads the name, user, port and password from `.env` through Compose and creates the database inside `doe-postgres`, owned by the configured user. That user must have `CREATEDB` permission.

```bash
cd /home/appadmin/mail-reply-engine/backend
docker compose --env-file .env -f docker-compose.yml config --format json | python3 -c '
import json
import os
import subprocess
import sys

db = json.load(sys.stdin)["services"]["mail-reply-engine-backend"]["environment"]
os.environ["PGPASSWORD"] = db["POSTGRES_DB_PASSWORD"]
subprocess.run([
    "docker", "exec", "--env", "PGPASSWORD", "doe-postgres",
    "createdb", "--host", "127.0.0.1", "--port", str(db["POSTGRES_DB_PORT"]),
    "--username", db["POSTGRES_DB_USER"], "--owner", db["POSTGRES_DB_USER"],
    "--no-password", "--", db["POSTGRES_DB_NAME"],
], check=True)
'
bash database/run_migration.sh --dry-run             # preview schema files in dependency order
bash database/run_migration.sh                       # run the SQL files in schema order
```

### Run specific SQL files

```bash
cd /home/appadmin/mail-reply-engine/backend
bash database/run_migration.sh --dry-run auth.sql people.sql
bash database/run_migration.sh auth.sql people.sql
```

The runner reads `.sql` files directly from `backend/database/` and loads database credentials from `backend/.env` through Compose. It connects over TCP inside `doe-postgres` and checks the login before running SQL. Set `POSTGRES_DB_USER` to a role that already exists on the server, with the matching password. With no filenames, it follows `schema_order.txt` and applies all files in one transaction. It stops at the first error. These schema files create missing tables; they do not automatically change existing columns.

### Create an admin

```bash
cd /home/appadmin/mail-reply-engine/backend
docker compose run --rm --entrypoint /app/.venv/bin/python mail-reply-engine-backend \
  scripts/create_admin.py --name "TCG Hr" --email hr.tcg@tcgdigital.com
```

## Frontend

### Redeploy

```bash
cd /home/appadmin/mail-reply-engine/frontend        # go to the frontend folder
docker network inspect mail-reply-engine-network >/dev/null 2>&1 || docker network create mail-reply-engine-network
docker compose down --remove-orphans                # stop old application containers
docker compose up -d --build                        # rebuild the frontend with the .env URLs
docker compose up -d --force-recreate               # recreate the container
docker compose ps                                  # show container status
```

### Logs

```bash
cd /home/appadmin/mail-reply-engine/frontend
docker compose logs -f --tail 100 mail-reply-engine-frontend
```

## Health checks

```bash
curl -fsS http://3.219.186.189:2102/healthz           # frontend
curl -fsS http://3.219.186.189:2101/health            # backend and database
curl -fsS http://3.219.186.189:2103/minio/health/live  # MinIO
```

Frontend: `http://3.219.186.189:2102`  
Backend docs: `http://3.219.186.189:2101/docs`  
MinIO console: `http://3.219.186.189:2104`
