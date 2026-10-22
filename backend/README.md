# Mail Reply Engine API

HR starts a document request in the dashboard. The API sends it through SMTP. The candidate replies to the same mailbox, and an IMAP watcher passes the reply and attachments to the agent. The agent updates the document tracker and can reply in the same email thread.

See [Backend overview and testing](docs/backend-overview-and-testing.md) for the full workflow and a test walkthrough.

```text
HR request → OpenAI draft → SMTP send → candidate reply → IMAP watcher
                                              ↓
                     store attachments in S3 → review → tracker and SMTP reply
```

## Setup

1. Copy `.env.example` to `.env` and set Postgres, JWT, OpenAI, S3, SMTP, and IMAP credentials. Keep `.env` private.
2. Use a mailbox that permits SMTP password authentication and IMAP access. For Gmail, enable IMAP and use an app password where required. `IMAP_USERNAME` and `IMAP_PASSWORD` reuse the SMTP values when empty.
3. Set `SMTP_FROM_EMAIL` to that mailbox. Its domain must be in `ALLOWED_EMAIL_DOMAINS`. Candidate addresses may use any domain.
4. Set `S3_ATTACHMENTS_BUCKET` and grant the API `s3:PutObject` and `s3:GetObject` for that bucket. Set `HR_ALERT_EMAIL` if a person should get thread attention alerts.
5. Apply `database/migrations/001_initial_schema.sql` to the intended Postgres database before starting the API. The committed `database/*.sql` files describe the current tables.
6. Create an HR account and start the server:

```bash
guvrun -m scripts.create_admin --name "TCG User" --email tcg@tcgdigital.com
guv app.main:app --reload --host 0.0.0.0 --port 8000
guvtest tests/
```

Swagger is at `http://localhost:8000/docs` outside production. `GET /health` reports database and watcher state.

## Mailbox behavior

- A new watcher starts at the mailbox's current UID and ignores older inbox mail. On later starts it catches up from the saved Postgres cursor.
- IMAP IDLE waits for replies when the server supports it. Other servers are polled at `IMAP_POLL_INTERVAL_SECONDS`.
- Only one API worker watches a mailbox at a time through a Postgres advisory lock. The watcher reconnects after connection errors.
- The cursor advances after an email is handled. Processing failures leave it in place for retry after reconnect; later emails wait behind the failed one.
- The unique email `Message-ID` prevents normal duplicate processing. Auto replies, bounces, mailing lists, and mail from the sending address are skipped.
- `MAX_AUTO_REPLIES_PER_THREAD` caps automatic replies. `HR_ALERT_EMAIL` receives an alert when a thread first needs a person.
