# Mail Reply Engine API

HR email agent for TCG. It reads `HROperations@tcgdigital.com` through Microsoft Graph, classifies every email on masked text, runs the onboarding, exit, reminder, feedback and induction workflows, and sends replies through Microsoft Graph. HR stays in control on the dashboard. The full design is in `../plan.md`.

## Setup

1. Fill `.env`, `.env.example` lists every key. Keep `.env` private.
2. Mailbox values from the IT ticket:
   - `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`: the "HR Automation" app registration
   - `GRAPH_CLIENT_SECRET`: the secret Value, not the Secret ID. It expires on 2027-10-13.
   - `GRAPH_MAILBOX`: `HROperations@tcgdigital.com`
   - The mailbox password is not needed, the app signs in with its own secret.
3. Check the mailbox values without starting the API:

```bash
guvrun scripts/check_mail.py
guvrun scripts/check_mail.py --send-to tcg@tcgdigital.com
```

4. Create the tables from `database/*.sql` in the order of `database/schema_order.txt`, or run the migration in `database/migrations/` on an existing database.
5. Create an HR admin and start the server:

```bash
guvrun scripts/create_admin.py --name "TCG User" --email tcg@tcgdigital.com --photo ~/Pictures/tcg.jpg
guvrun scripts/create_admin.py --email tcg@tcgdigital.com --photo ~/Pictures/tcg.jpg --set-photo
guv app.main:app --reload --host 0.0.0.0 --port 8000
guvtest tests/
```

Swagger is at `http://localhost:8000/docs` outside production.

## Mailbox behavior

- Graph reads the inbox. A new mailbox starts from now, so older inbox mail is never processed.
- New mail arrives through the Graph webhook when `GRAPH_WEBHOOK_BASE_URL` is a public HTTPS URL, otherwise through a delta poll every 2 minutes.
- `EVENT_DISPATCH_MODE=inline` runs events, the mailbox poll and due follow-ups inside the API, which suits local runs. `celery` needs Redis plus the worker and beat from `docker-compose.yml`.
- Microsoft Graph sends all emails from `GRAPH_MAILBOX` and keeps replies in the same Outlook conversation.
- Dry-run is on by default. Every email is held until a test inbox is set in Admin, Sending controls, and then only goes to that inbox.
- The kill switch stops every outgoing email within one minute.
- Induction booking needs Calendars.ReadWrite on the app. Without it, booking fails with a 502 and the session stays unbooked.
