# Mail Reply Engine on the VM

Each service reads `.env`. To use its saved VM settings, copy `vm.env` to `.env` in that service directory before running the commands below.

## MinIO

### Ports

Set these values in `services/minio/.env` on the VM. Compose reads `.env` directly.

```env
MINIO_API_BIND=0.0.0.0
MINIO_API_PORT=2103
MINIO_CONSOLE_BIND=0.0.0.0
MINIO_CONSOLE_PORT=2104
```

MinIO logs its internal ports `9000/9001`. Docker publishes them as `2103/2104` on the VM.

### Redeploy

```bash
cd /home/appadmin/mail-reply-engine/services/minio   # go to the MinIO folder
docker compose up -d --build minio                  # build and start MinIO, keeping its volume and network
docker compose run --rm minio-init                 # initialize the encrypted bucket and app user
docker compose up -d --force-recreate minio         # reload .env
docker compose ps                                 # show container status
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

Skip database creation if `mail_reply_engine` already exists. Use the server's existing database admin role if it differs from `postgres`.

```bash
cd /home/appadmin/mail-reply-engine/backend
docker exec -it doe-postgres createdb -U postgres -O kuberyauser mail_reply_engine
bash database/run_migration.sh --dry-run             # preview schema files in dependency order
bash database/run_migration.sh                       # run the SQL files in schema order
```

### Run specific SQL files

```bash
cd /home/appadmin/mail-reply-engine/backend
bash database/run_migration.sh --dry-run auth.sql people.sql
bash database/run_migration.sh auth.sql people.sql
```

The runner reads `.sql` files directly from `backend/database/` and targets `doe-postgres`, database `mail_reply_engine`, user `kuberyauser`. With no filenames, it follows `schema_order.txt`. It stops at the first SQL error. These schema files create missing tables; they do not automatically change existing columns.

### Create an admin

```bash
cd /home/appadmin/mail-reply-engine/backend
docker compose run --rm --entrypoint /app/.venv/bin/python mail-reply-engine-backend \
  scripts/create_admin.py --name "TCG User" --email tcg@tcgdigital.com
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
