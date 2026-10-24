# Mail Reply Engine: Rebuild Plan

HR email agent for TCG. One dedicated mailbox , 7 use cases. The AI decides, our code acts, and HR stays in control on the dashboard.

- Brief: `archive/HR Assistant claude clone.md`
- Real mail samples: `archive/` (pre-onboarding and exit chains)
- Storage stack: `services/minio/`

---

## 1. Locked decisions

- Mail: Graph reads `HROperations@tcgdigital.com` through the "HR Automation" app (Mail.ReadWrite + Mail.Send), using a webhook, a 2 min delta poll as backup, and auto renewal of the subscription. Sending goes through Graph by default, or through the IT SMTP server (STARTTLS, port 587) when `MAIL_SEND_PROVIDER=smtp`.
- Calendar: induction booking uses Graph and needs Calendars.ReadWrite on the app, which IT has not granted yet.
- Queue + scheduler: Redis + Celery worker + beat, with one event loop and DB pool per worker process. For local runs, `EVENT_DISPATCH_MODE=inline` runs events, the mailbox poll and due jobs inside the API instead.
- Files: self-hosted MinIO with a private bucket, SSE-S3 encryption at rest, 5 min presigned links, behind HTTPS.
- Joiner data: the brief's 8 fields + DOB at creation; the rest of the onboarding template + Employee ID at sign-off.
- Exit mails: one group mail to the offboarding group + manager, then follow-ups only to pending teams, Finance every 24h and others every 48h.
- Salary docs: never requested. If one shows up, its text never reaches the AI or the DB, the file is deleted, and HR is flagged.
- Personal data in Postgres: our code encrypts each field with AES-256-GCM before insert and decrypts only when building an API response. Search and A to Z sort on encrypted fields run in the app after decrypt. HR dashboard users, employee code, joining date, level, location and hire category stay plaintext. See 7.1.
- Code: Feature-wise MVC in `backend/app/`, rewritten in place.

## 2. My calls, correct me if wrong

1. Packages are layered (section 5) instead of one orchestrator, because 7 use cases in one package gets too big.
2. Masking is local Presidio, never an AI call. The brief lists it as an AI helper, but that would send raw PII to the AI.
3. Credential lines are redacted from every inbound mail before saving. One archive IT reply has a plaintext password.
4. Dry-run is ON by default. Real sending starts only when HR switches it off.
5. The daily cap of 3 counts individuals only. Team mailboxes like IT, the onboarding group and Finance are exempt.
6. No acknowledgement mail per document. I read "nothing changed, don't resend" as: no extra mail when docs arrive, and identical reminder content never goes twice in the same gap.
7. Document reading stays behind `document_reading_enabled`, which is off until security approves. Files are stored, and HR verifies by hand.
8. Extracted document text is never stored. PAN is kept only as a salted hash taken from the verified PAN card.
9. The passport photo is verified by HR with one click, since OCR can't check a face.
10. The passport photo is attached to the IT request and the onboarding group mail, same as today's real mails.
11. The onboarding group mail goes out once the work email is known, even if D365 access is still pending.
12. The "Send credentials" HR task is skipped when IT says it sent credentials straight to the joiner, as in the archive replies.
13. The welcome email goes to the personal email, cc the work email.
14. A calendar conflict on an agreed time flags HR instead of auto re-asking.
15. A reminder reply saying "on leave" pauses the task until the return date, or flags HR if no date is given.
16. Reading Forms responses through Graph Excel is R&D. HR uploading the Forms export is the fallback.
17. The "release letter can be issued" final call is HR clicking Confirm release, which closes the exit case.
18. The AI stays OpenAI behind `llm_client`, which is already wired. Masked requests are kept 30 days in a restricted table to prove no PII leaks.
19. Login stays JWT email + password. Roles are `hr_admin` and `hr_viewer`, plus a `complaints_access` flag.
20. The senior induction track is Director and above, editable in settings.
21. A small Feedback tab is added to the dashboard. The brief lists no screen for it.

## 3. Rules baked into code

- Only the dedicated mailbox is read or sent from. The main HR inbox is never touched.
- Template emails send automatically. AI-written emails wait for HR approval.
- Complaints are stored restricted, never replied to, and never shown on timelines.
- No category match, or confidence below threshold, means log quietly and do nothing.
- The AI only ever sees masked text. A final regex guard blocks the call if a PAN, Aadhaar, phone or email pattern is still there.
- No salary data anywhere. The appointment letter is an opaque attachment and is never opened.
- The AI returns JSON only. Code performs every action, and there is no free-running agent.
- Every action goes to `action_log`: who, what, when, which case. No PII or document content in any log.
- HR alone makes three calls: ready to onboard, release letter can be issued, and induction schedule approval.
- The kill switch stops all sending within 1 minute. Dry-run sends every email to the test inbox.
- Never reply to automated mail. Always reply inside the same thread, keeping the thread's `RE:` subject so Gmail and Outlook keep one conversation; follow-ups only thread onto mail the same recipient already got.
- Graph, AI and D365 calls retry with backoff. Calls that keep failing show on the dashboard.
- Full Aadhaar numbers are never stored anywhere.
- Personal data from email is encrypted before it touches Postgres, and the keys never reach the database.

## 4. Runtime pieces

- `api`: FastAPI, serves the dashboard APIs and the Graph webhooks
- `worker`: Celery, with queues `events` and `documents` (OCR heavy)
- `beat`: Celery beat, runs the cron ticks in section 9.6
- `redis`: broker
- `postgres`: the single source of truth
- `minio`: `services/minio/`, joined over its Docker network
- External: Microsoft Graph, OpenAI via `llm_client`, and a D365 client stub until access arrives
- Docker image adds `tesseract-ocr` and the spaCy model Presidio needs. Hosted inside MQ with docker-compose.
- New deps, added to both pyproject files, then you run `uv sync`: `celery[redis]`, `msal`, `httpx`, `pymupdf`, `python-docx`, `pytesseract`, `pillow`, `presidio-analyzer`, `presidio-anonymizer`, `spacy`, `rapidfuzz`, `openpyxl`, `jinja2`, `reportlab`, `cryptography` (already pulled in by python-jose, now listed directly)

## 5. Code layout, `backend/app/`

- Shared infra, importable by anyone: `config`, `database`, `error`, `logger`, `limiter`, `middleware`, `dependencies`, `common`, `storage` (MinIO), `graph` (mail, calendar, subscriptions), `smtp` (optional sender with threading headers), `llm` (`llm_client`, PII guard, request audit), `privacy` (Presidio masking, credential redaction, field encryption, blind indexes), `worker` (Celery app, `enqueue_event`, beat schedule, events, scheduled jobs), `runtime` (settings + holidays tables, cached kill switch, dry-run and sending window reads), `audit` (action log writer), `d365` (stub client)
- Core features, which own their tables and never import each other: `auth`, `people`, `cases` (cases, tasks, checklist, approvals), `mail` (emails, attachments, templates, send pipeline), `documents` (extraction, readability, person check, salary guard), `ai` (AI helper functions), `admin` (admin APIs, checklist and induction templates)
- Use cases, grouped in `app/workflows/`, which may import infra + core but never each other, and talk through events: `workflows/onboarding` (UC-DOC + UC-IT), `workflows/exits`, `workflows/reminders`, `workflows/feedback`, `workflows/induction`, `workflows/complaints`. Imports read `from app.workflows.exits import exits_router`.
- Orchestrator: `engine` (event dispatcher, inbound email pipeline, scheduled job runner, query drafts, the full case view with its timeline). It is the only package that imports `app.workflows`.

### Full repo tree

```text
mail-reply-engine/
├── plan.md
├── .gitignore
├── archive/                          # brief + real mail samples, gitignored
│
├── services/
│   └── minio/
│       ├── docker-compose.yml
│       ├── init.sh
│       ├── .env.example
│       ├── .env                      # gitignored
│       ├── .gitignore
│       ├── README.md
│       └── license.md
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # app, lifespan, routers, /health
│   │   ├── config.py                 # all .env config
│   │   ├── database.py               # asyncpg pool + helpers
│   │   ├── error.py
│   │   ├── logger.py
│   │   ├── limiter.py
│   │   ├── middleware.py
│   │   ├── dependencies.py           # get_current_user, require_admin, require_complaints_access
│   │   │
│   │   ├── common/                   # BaseResponse, error models, SortOrder, FileAttachment
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py
│   │   │   ├── enums.py
│   │   │   └── attachment.py
│   │   │
│   │   ├── prompts/                  # one YAML per AI helper + cached loader
│   │   │   ├── loader.py
│   │   │   ├── classify_email.yml
│   │   │   ├── identify_document.yml
│   │   │   ├── read_it_setup.yml
│   │   │   ├── read_availability.yml
│   │   │   ├── read_clearance_status.yml
│   │   │   ├── read_reminder_reply.yml
│   │   │   ├── draft_reply.yml
│   │   │   ├── build_induction_schedule.yml
│   │   │   └── analyse_feedback.yml
│   │   │
│   │   │   ── LAYER 1: shared infra, anyone can import ──
│   │   ├── storage/                  # MinIO: put, get, delete, presign
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # POST /api/uploads/presign
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── graph/                    # Microsoft Graph
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # /api/graph/notifications, /lifecycle
│   │   │   ├── client.py             # MSAL token + httpx with retry
│   │   │   ├── mail.py               # fetch, delta poll, send, reply, attachments
│   │   │   ├── calendar.py           # getSchedule, create invite
│   │   │   ├── subscriptions.py      # create, renew, recreate
│   │   │   ├── excel.py              # Forms response workbook
│   │   │   ├── model.py              # mailbox_state
│   │   │   └── schemas.py
│   │   ├── smtp/                     # optional sender when MAIL_SEND_PROVIDER=smtp
│   │   │   ├── __init__.py
│   │   │   ├── client.py             # STARTTLS or SSL login, send in a thread
│   │   │   ├── mail.py               # MIME build, Message-ID, In-Reply-To, quoted reply
│   │   │   └── schemas.py            # ReplyContext
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── client.py             # llm_client, the only file that talks to the AI model
│   │   │   ├── guard.py              # last-chance PII regex block
│   │   │   └── model.py              # llm_requests audit
│   │   ├── privacy/
│   │   │   ├── __init__.py
│   │   │   ├── masking.py            # Presidio analyzer + anonymizer
│   │   │   ├── recognizers.py        # PAN, Aadhaar, Indian phone, DOB, address
│   │   │   ├── redaction.py          # password and credential lines
│   │   │   └── encryption.py         # AES-256-GCM field encrypt/decrypt + blind index
│   │   ├── worker/                   # Celery
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py         # per-process event loop + DB pool
│   │   │   ├── beat.py               # cron schedule from 9.6
│   │   │   ├── tasks.py              # thin tasks that call engine
│   │   │   ├── events.py             # enqueue_event, dedupe, sweeper
│   │   │   ├── inline.py             # poll + due jobs inside the API in inline mode
│   │   │   └── model.py              # events, scheduled_jobs
│   │   ├── runtime/                  # live settings, cached reads
│   │   │   ├── __init__.py
│   │   │   ├── service.py            # kill switch, dry-run, sending window, holidays
│   │   │   └── model.py              # settings, holidays
│   │   ├── audit/
│   │   │   ├── __init__.py
│   │   │   ├── service.py            # log_action
│   │   │   └── model.py              # action_log
│   │   ├── d365/                     # stub client, off until access
│   │   │   ├── __init__.py
│   │   │   └── client.py
│   │   │
│   │   │   ── LAYER 2: core features, never import each other ──
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # login, logout, me, users
│   │   │   ├── service.py
│   │   │   ├── model.py              # User, RevokedToken
│   │   │   ├── schemas.py
│   │   │   └── enums.py              # UserRole
│   │   ├── people/
│   │   │   ├── __init__.py
│   │   │   ├── service.py
│   │   │   ├── model.py              # Person
│   │   │   ├── schemas.py
│   │   │   └── enums.py              # PersonRole, HireCategory, PersonStatus
│   │   ├── cases/
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # PATCH case, PATCH task, approvals routes
│   │   │   ├── service.py
│   │   │   ├── model.py              # Case, ChecklistItem, Task, Approval
│   │   │   ├── schemas.py
│   │   │   └── enums.py              # CaseType, stages, TaskStatus, ApprovalStatus
│   │   ├── mail/
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # templates CRUD + preview, attachment download links
│   │   │   ├── service.py            # save inbound, send pipeline from 9.4
│   │   │   ├── model.py              # Email, Attachment, Template
│   │   │   ├── schemas.py
│   │   │   ├── enums.py              # Direction, ProcessingStatus
│   │   │   └── utils.py              # junk filter, html_to_text, strip_quoted_reply, render
│   │   ├── documents/
│   │   │   ├── __init__.py
│   │   │   ├── service.py            # unzip, extract, OCR, readability, person check, salary guard
│   │   │   ├── schemas.py
│   │   │   ├── enums.py              # PersonCheck, CheckStatus
│   │   │   └── utils.py              # name, DOB, PAN regex + rapidfuzz
│   │   ├── ai/
│   │   │   ├── __init__.py
│   │   │   ├── service.py            # the 9 AI helpers
│   │   │   ├── schemas.py            # JSON in/out models per helper
│   │   │   └── enums.py              # EmailCategory
│   │   ├── admin/
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # status, switches, settings, holidays, checklists, SoU, action log, failures
│   │   │   ├── service.py
│   │   │   ├── model.py              # ChecklistTemplate, InductionTemplate
│   │   │   └── schemas.py
│   │   │
│   │   │   ── LAYER 3: use cases, never import each other, talk via events ──
│   │   ├── workflows/
│   │   │   ├── __init__.py           # re-exports the 6 routers
│   │   │   ├── onboarding/           # UC-DOC + UC-IT
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py         # joiners, sign-off, checklist override
│   │   │   │   ├── service.py        # handle_documents, reminders, dropout, handle_it_reply
│   │   │   │   ├── schemas.py
│   │   │   │   ├── enums.py          # OnboardingStage
│   │   │   │   └── utils.py          # work email regex, onboarding table builder
│   │   │   ├── exits/                # UC-EXIT
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py
│   │   │   │   ├── service.py        # handle_clearance, follow-ups, all-cleared
│   │   │   │   ├── schemas.py
│   │   │   │   └── enums.py          # ExitStage, ClearanceTeam
│   │   │   ├── reminders/            # UC-REM
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py
│   │   │   │   ├── service.py        # rule tick, handle_reply
│   │   │   │   ├── model.py          # ReminderRule
│   │   │   │   ├── schemas.py
│   │   │   │   └── utils.py          # CSV/XLSX parsing
│   │   │   ├── feedback/             # UC-FB
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py
│   │   │   │   ├── service.py        # milestone check, surveys, monthly report
│   │   │   │   ├── model.py          # SurveyResponse, FeedbackReport
│   │   │   │   ├── schemas.py
│   │   │   │   └── utils.py          # PDF builder
│   │   │   ├── induction/            # UC-IND
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py         # plan induction, appointment letter, book session
│   │   │   │   ├── service.py        # draft, handle_availability, welcome email
│   │   │   │   ├── model.py          # InductionSession
│   │   │   │   ├── schemas.py
│   │   │   │   └── enums.py          # InductionTrack, SessionStatus
│   │   │   └── complaints/           # UC-CMP
│   │   │       ├── __init__.py
│   │   │       ├── router.py         # restricted routes
│   │   │       ├── service.py        # capture, neutral alert
│   │   │       ├── model.py          # Complaint
│   │   │       └── schemas.py
│   │   │
│   │   │   ── LAYER 4: orchestrator, the only one importing app.workflows ──
│   │   └── engine/
│   │       ├── __init__.py
│   │       ├── router.py             # GET /api/cases/{id} full case view
│   │       ├── service.py            # event type to handler dispatch
│   │       ├── inbound.py            # the 8-step email pipeline
│   │       ├── jobs.py               # due jobs, follow-ups, escalations
│   │       └── schemas.py
│   │
│   ├── database/                     # one SQL file per feature, source of truth
│   │   ├── auth.sql
│   │   ├── people.sql
│   │   ├── cases.sql
│   │   ├── mail.sql
│   │   ├── admin.sql
│   │   ├── runtime.sql
│   │   ├── audit.sql
│   │   ├── worker.sql
│   │   ├── graph.sql
│   │   ├── llm.sql
│   │   ├── reminders.sql
│   │   ├── feedback.sql
│   │   ├── induction.sql
│   │   ├── complaints.sql
│   │   └── migrations/               # gitignored
│   │
│   ├── scripts/                      # run with guvrun
│   │   ├── create_admin.py
│   │   ├── check_mail.py             # checks Graph read, calendar access and SMTP login, can send one test mail
│   │   ├── seed_defaults.py          # settings, templates, checklists, reminder rules
│   │   ├── seed_test_data.py         # fake joiners, employees, exits for dry-run
│   │   └── rotate_pii_keys.py        # re-encrypt personal data with a new key, in batches
│   │
│   ├── tests/                        # mirrors app/
│   │   ├── conftest.py
│   │   ├── fixtures/                 # synthetic test docs + emails only, no real PII
│   │   ├── privacy/
│   │   ├── documents/
│   │   ├── mail/
│   │   ├── engine/
│   │   └── workflows/
│   │       ├── onboarding/
│   │       ├── exits/
│   │       ├── reminders/
│   │       ├── feedback/
│   │       ├── induction/
│   │       └── complaints/
│   │
│   ├── Dockerfile                    # + tesseract-ocr, spaCy model
│   ├── docker-compose.yml            # api, worker, beat, redis, joins the minio network
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── .env  .env.example  .env.test
│   └── README.md
│
└── frontend/                         # rebuilt pages, same shell
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── ui/                   # kept from the demo
        │   ├── auth/                 # login, kept
        │   ├── joiners/              # list, create form
        │   ├── cases/                # case details: checklist, docs, timeline, tasks, sign-off
        │   ├── approvals/            # queue, draft editor
        │   ├── exits/                # list, create, clearance board
        │   ├── reminders/            # rules, upload
        │   ├── feedback/             # surveys, reports
        │   ├── complaints/           # restricted area
        │   ├── admin/                # settings, templates, holidays, switches, action log
        │   └── error/
        ├── layouts/                  # sidebar + header, kept
        ├── redux/                    # store, auth slice, axios, kept
        ├── hooks/
        ├── types/
        └── utils/
```

## 6. Reuse from the demo

- Keep and adapt: `config`, `database`, `error`, `logger`, `limiter`, `middleware`, `common/schemas`, `auth` (add role + complaints flag), `prompts/loader`, `upload` → `storage` (MinIO endpoints), agent retry + structured output parsing → `llm_client`, mailbox utils (automated mail check, `html_to_text`, `strip_quoted_reply`, `sanitize_file_name`).
- Delete: IMAP watcher, SMTP sender, `threads`/`messages` tables, the demo mail router and prompts.
- Frontend: keep the shell (Vite, Tailwind, Redux, axios, ui components, login, layout) and rebuild every page.

## 7. Database tables

Every table has a UUID `<name>_id` primary key plus `created_at` and `updated_at`. Only the key columns are listed.

- `users`: name, email, password_hash, role (`hr_admin`, `hr_viewer`), complaints_access, is_active. Plus `revoked_tokens`.
- `people`: full_name, personal_email, work_email, role (`candidate`, `employee`, `stakeholder`, `manager`), hire_category (`campus`, `lateral`), level, location, employee_code, manager_name, manager_email, recruiter_email, date_of_birth, joining_date, designation, pan_hash, status (`active`, `exiting`, `exited`, `dropped`), profile JSONB holding the rest of the onboarding template
- `cases`: case_type (`onboarding`, `exit`, `induction`, `feedback`), person_id, parent_case_id, stage, status (`open`, `on_hold`, `closed`, `cancelled`), flags[], created_by, opened_at, closed_at
- `checklist_items`: case_id, document_type, is_mandatory, check_mode (`text`, `photo`), status (`pending`, `received`, `verified`, `unreadable`, `wrong_type`, `name_mismatch`), attachment_id (latest), person_check (`match`, `mismatch`, `not_found`), notes
- `tasks`: case_id (null for reminder tasks), reminder_rule_id, owner_email, owner_role, task_type, status (`open`, `partial`, `done`, `blocked`, `not_applicable`, `escalated`, `paused`, `cancelled`), sub_items JSONB, progress_notes, source_ref JSONB, due_at, paused_until, completed_at
- `emails`: graph_message_id UNIQUE, internet_message_id, conversation_id, direction (`inbound`, `outbound`), from, to[], cc[], subject, body_text (credentials redacted), received_at or sent_at, case_id, category, confidence, ai_summary, processing_status (`received`, `filtered`, `unmatched`, `routed`, `processed`, `failed`), filter_reason, template_key, approval_id, dedupe_key UNIQUE, is_dry_run, is_restricted
- `attachments`: email_id, case_id, kind (`email_document`, `appointment_letter`, `reminder_list`, `survey_export`, `transcript`, `statement_of_understanding`, `report`), file_name, mime_type, size_bytes, storage_key, sha256, parent_attachment_id (zip source), document_type_guess, ai_confidence, ocr_quality, name_match_score, person_check, check_status (`pending`, `processed`, `unreadable`, `wrong_type`, `restricted`, `duplicate`, `skipped`), issues[], is_latest
- `scheduled_jobs`: job_type, case_id, task_id, template_key, run_at, attempt, max_attempts, status (`pending`, `running`, `done`, `skipped`, `cancelled`, `failed`), dedupe_key UNIQUE (case + task + template + attempt), payload JSONB, last_error
- `events`: event_type, source (`email`, `scheduler`, `hr_action`, `d365`), payload JSONB, dedupe_key UNIQUE, status (`queued`, `processing`, `done`, `failed`), attempts, last_error
- `approvals`: case_id, approval_type (`reply`, `induction_schedule`), source_email_id, draft JSONB, status (`pending`, `approved`, `rejected`, `sent`), decided_by, decided_at, reject_reason
- `reminder_rules`: name, rule_key, data_source (`upload`, `d365`, `test`), recipient_field, required_columns[], template_key, stages JSONB, schedule_cron, followup_gap_hours, max_rounds, escalate_to_email, is_active, next_run_at
- `survey_responses`: person_id, task_id (reminder count lives on the task), milestone (30, 60, 90), form_variant (`campus`, `lateral`), sent_at, responded_at, response_ref, score, answers JSONB, flagged
- `feedback_reports`: period_start, period_end, response_count, status (`queued`, `ready`, `sent`, `failed`), storage_key, sent_at
- `induction_sessions`: case_id, title, owner_email, proposed_start, proposed_end, agreed_start, agreed_end, status (`proposed`, `asked`, `agreed`, `alternative`, `booked`, `no_reply`, `conflict`), graph_event_id
- `complaints` (restricted): received_at, source (`email`, `exit_interview`, `hr_connect`), sender_email, person_id, subject, content, email_id, storage_key
- `templates`: template_key UNIQUE, subject, body_html, placeholders[], is_active
- `checklist_templates`: hire_category, location, document_type, is_mandatory, check_mode, sort_order
- `induction_templates`: track (`campus`, `mid`, `senior`), sessions JSONB (title, owner_email, duration_mins, day_number)
- `settings`: key UNIQUE, value JSONB, updated_by
- `holidays`: holiday_date, name, location
- `action_log`: occurred_at, actor_type (`agent`, `user`, `system`), actor_id, action, case_id, entity_type, entity_id, details JSONB with no PII
- `llm_requests` (restricted, purged after 30 days): helper, model, masked_request, response, latency_ms, blocked_by_guard
- `mailbox_state`: delta_link, subscription_id, subscription_expires_at, last_poll_at

### 7.1 Encrypted personal data

- **How it's stored:**
  - Each value is encrypted in our code with AES-256-GCM and a fresh 12-byte nonce.
  - Table + column + row id are bound as associated data, so ciphertext can't be copied to another row.
  - The result goes in a `BYTEA` column named `<column>_enc`, holding key id + nonce + ciphertext.
- **Lookups:**
  - Emails we must match get a `<column>_idx` blind index: HMAC-SHA256 of the lowercased value with a separate key.
  - The blind index is itself indexed. It supports equality only and can't be reversed.
- **Keys:**
  - `.env` holds `PII_ENCRYPTION_KEYS` (key id to 32-byte key), `PII_ACTIVE_KEY_ID` and `PII_INDEX_KEY`.
  - They never go to Postgres, logs or the AI.
  - Back them up outside the VM, apart from the DB backups. Losing them loses the data.
- **Rotation:**
  - Add a new key id and switch `PII_ACTIVE_KEY_ID`.
  - Run `scripts/rotate_pii_keys.py`, which re-encrypts in batches. Old keys stay for decrypt until it finishes.
- **Where it happens:**
  - Model classes encrypt on `create` and `save` and decrypt when loading a row, so services work with plain values in memory only.
- **Showing it:**
  - Decrypted values leave the API only inside responses for allowed roles.
  - Complaint content needs `complaints_access`, and every reveal is written to `action_log`.
- **Search and sort:**
  - SQL filters on plaintext columns first.
  - The app decrypts those rows, applies the partial `search` and A to Z name sort, then paginates and counts `total`. Fine at HR volume.
- **Leak-proofing:**
  - `events` and `scheduled_jobs` payloads carry ids only.
  - MinIO storage keys use UUIDs, never file names.
  - A plain DB dump shows no readable personal data.

| Table | Encrypted | Blind index | Stays plaintext |
|-------|-----------|-------------|-----------------|
| `people` | full_name, personal_email, work_email, recruiter_email, manager_name, manager_email, date_of_birth, profile | personal_email, work_email, recruiter_email, manager_email | employee_code, hire_category, level, location, joining_date, designation, role, status, pan_hash |
| `emails` | from, to, cc, subject, body_text, ai_summary | from | message ids, conversation_id, direction, category, confidence, statuses, dates |
| `attachments` | file_name | none | kind, mime_type, size, storage_key, scores, statuses |
| `tasks` | owner_email, progress_notes, source_ref | owner_email | task_type, owner_role, status, dates |
| `checklist_items` | notes | none | everything else |
| `approvals` | draft, reject_reason | none | type, status, dates |
| `induction_sessions` | owner_email | owner_email | title, times, status |
| `survey_responses` | answers | none | milestone, score, dates, flagged |
| `complaints` | sender_email, subject, content | sender_email | received_at, source |
| `llm_requests` | masked_request, response | none | helper, model, latency |
| `users`, `templates`, `settings`, `holidays`, `action_log`, `events`, `scheduled_jobs`, `feedback_reports`, `mailbox_state`, template tables | nothing, no personal data from email | none | all |

## 8. Settings, editable by HR in Admin

| Key | Default |
|-----|---------|
| `ai_confidence_threshold` | 0.80 |
| `followup_gap_hours` | 48 |
| `finance_followup_gap_hours` | 24 |
| `max_followups` | 3, then escalate once and stop |
| `induction_followup_after_days` / `induction_max_followups` | 3 / 2 |
| `survey_reminder_after_days` / `survey_max_reminders` | 3 / 2 |
| `max_auto_emails_per_person_per_day` | 3, individuals only |
| `sending_days` / `sending_start` / `sending_end` | Mon to Fri, 09:00 to 19:00 IST |
| `working_days` | Mon to Fri, the days induction sessions can be planned on, separate from the sending window |
| `induction_day_start` / `induction_day_end` | 10:00 / 18:00 IST |
| `welcome_email_time` | 09:30 IST |
| `name_match_threshold` | 85 |
| `survey_levels` | L1 to L6 |
| `survey_low_score_threshold` | pending from HR |
| `survey_form_links` | campus and lateral links, pending from HR |
| `feedback_report_frequency` | monthly |
| `senior_track_designations` | Director and above |
| `ocr_min_chars` / `ocr_min_confidence` | 50 / 60 |
| `upload_max_mb` | 20 |
| `kill_switch` | false |
| `dry_run` / `test_inbox` | true / test mailbox |
| `document_reading_enabled` | false until security approval |
| `d365_enabled` | false |
| `contacts` | it_team, onboarding_group, offboarding_group, hr_onboarding_team, hr_onboarding_owner, recruitment_team, finance_team, admin_team, hr_owner, complaints_owner, performance_team, training_team |
| `work_email_domain` | tcgdigital.com |

## 9. Engine flows

### 9.1 Mail listener

- On startup and every 12h: create or renew the Graph subscription on the dedicated inbox, renewing when under 24h is left. Mail subscriptions live about 3 days.
- `POST /api/graph/notifications` checks `clientState`, enqueues `email.received` with the message id, and replies 202 at once.
- `POST /api/graph/lifecycle` handles reauthorize, removed (recreate it) and missed (run a delta poll now).
- Every 2 min, a delta query on the inbox catches anything the webhook missed. A new mailbox starts from now, so older inbox mail is never processed.
- When the webhook and the poll see the same message, the event `dedupe_key` (Graph message id) makes sure it is processed once.

### 9.2 Event queue

- Every trigger (an email, a scheduler tick, an HR click, later D365) becomes an `events` row plus a Celery task carrying its id.
- `dedupe_key` UNIQUE means nothing runs twice.
- Failures retry at 1m, 5m, 15m, 1h and 4h, then the event is marked `failed` and shows in Admin.
- A sweeper runs every 10 min and re-queues events stuck in `queued` or `processing`.

### 9.3 Inbound email

1. **Save:** fetch the message and headers from Graph, redact credential lines, and insert into `emails`. A duplicate Graph id means stop.
2. **Filter junk:** our own mailbox, auto-replies, out of office, bounces, bulk or list headers and noreply senders become `filtered` and are logged.
3. **Thread match:** a conversation id, or In-Reply-To/References pointing at an email we sent, gives the case.
4. **Sender match:** a sender who is a person, recruiter or task owner with open cases gives the candidate case list. The lookup goes through the email blind index from 7.1.
5. **Classify:** mask the subject and body, then send them with the sender's open cases (id, type, stage) and the category list. The AI returns JSON.
6. **Decide:** confidence of 0.80 or more goes to the handler. Anything lower becomes `unmatched` and is logged, and still shows on the case timeline if a case is known. A thread match beats the AI's case id, and the AI's case id must be one of the sender's open cases.
7. **Act:** the category handler runs, see the list below.
8. **Finish:** mark the email `processed` and write the action log.

| Category | Handler |
|----------|---------|
| `doc_submission` | `onboarding.handle_documents` |
| `it_setup_reply` | `onboarding.handle_it_reply` |
| `availability_reply` | `induction.handle_availability` |
| `clearance_update` | `exits.handle_clearance` |
| `reminder_response` | `reminders.handle_reply` |
| `query` | `draft_reply`, then the approval queue |
| `complaint` | `complaints.capture` |
| `unrelated` | log only |

- Documents from an unknown sender: names in the subject, body and files are matched locally with rapidfuzz, 85 or more, against open joiners. A match is attached to that case with the `sender_not_recognised` flag.

### 9.4 Outbound send, every email goes through this

1. If the kill switch is on, the job stays pending. It is checked right before every send and cached for 30s at most.
2. Follow-ups re-check the task first. If it is done, blocked or paused, the follow-up is skipped and cancelled.
3. Outside the sending window or on a holiday, `run_at` moves to the next window start.
4. An automatic mail to an individual who already got 3 today moves to the next window.
5. The template renders with strict placeholders. A missing value fails the send, so a half-filled mail never goes out.
6. In dry-run, recipients are swapped for the test inbox and the subject gets the prefix `[DRY RUN to: original recipients]`, replies included.
7. The outbound `emails` row is inserted with its `dedupe_key`. A conflict means it was already sent, so stop.
8. Graph replies to the thread's last message, or creates a new draft, then attaches files, sends, and saves the message and conversation ids.
   - With SMTP, the mail gets its own Message-ID, and replies carry In-Reply-To, References, the `RE:` subject and a quote of the last message. The Graph ids come from the mailbox copy found by Message-ID. When the SMTP server keeps no copy, the first reply that references the mail gives its conversation id, and follow-ups still thread on the Message-ID.
9. The next follow-up is scheduled and the action log is written. Graph errors retry with backoff, then flag `failed_action` on the case.

### 9.5 Follow-up rules, for every use case

- Every request send adds a `scheduled_jobs` row for its follow-up: attempt n + 1, `run_at` = sent time + gap.
- A reply that completes the task cancels its pending jobs.
- Status is re-checked right before sending.
- The dedupe key is case + task + template + attempt.
- The sending window and the daily cap always apply.
- After the max follow-ups: one escalation mail, the task becomes `escalated`, and chasing stops.

### 9.6 Scheduler, beat, IST

- Every 2 min: mailbox delta poll
- Every 5 min: run due `scheduled_jobs` and reminder rules whose `next_run_at` has passed
- Every 10 min: stuck event sweeper
- Every 12h: renew the Graph subscription
- Daily 09:00: 30/60/90 milestone check, and joiners flip to `employee` on their joining day
- Monthly, per setting: feedback report
- Every 15 min: D365 status poll, off until access arrives

### 9.7 AI helpers, all through `llm_client`, masked input, JSON out, retry with backoff

| Helper | Input | Output |
|--------|-------|--------|
| `classify_email` | masked subject + body, sender role, open cases, categories | `{category, confidence, case_id, summary, details}` |
| `identify_document` | masked text, checklist document types | `{document_type, confidence, issues[]}` |
| `read_it_setup` | masked IT reply | `{email_created, d365_created, credentials_sent_to_joiner, confidence}` |
| `read_availability` | masked reply, proposed slot | `{accepts_proposed, alternatives[{start, end}], confidence}` |
| `read_clearance_status` | masked reply, team items | `{team, status, items[{item, status}], blocker, confidence}` |
| `read_reminder_reply` | masked reply | `{intent: done, on_leave, question or other, return_date, confidence}` |
| `draft_reply` | masked thread + question | `{subject, body, confidence}`, goes to approval |
| `build_induction_schedule` | track sessions, working days, start date | `{sessions[{title, owner_email, start, end}], notes}`, goes to approval |
| `analyse_feedback` | masked survey responses | `{themes[], working[], not_working[], actions[], summary}` |

- The classifier prompt explains its role, gives every category a definition and 2 example emails, asks for JSON only, forbids drafting a reply to a complaint, and asks for lower confidence when unsure.
- Prompts live in YAML and are loaded once.

### 9.8 Document check, per attachment

1. Save to MinIO, encrypted, with its sha256. A zip is unpacked, within file count and size limits, into child attachments. The same sha256 already on the case is marked `duplicate`.
2. If `document_reading_enabled` is off, stop here: the checklist item becomes `received` and HR verifies by hand.
3. Extract text: PDFs with PyMuPDF (OCR the page images if there's little text), DOCX with python-docx, images with Tesseract plus a confidence score.
4. Too few characters or low OCR confidence marks it `unreadable`, and the next reminder asks for a clearer copy.
5. Salary guard: CTC, gross, net pay or payslip keywords mean the text is dropped, the file deleted, a `restricted` row kept and HR flagged.
6. Person check, local only: name via Presidio PERSON + label regex, DOB regex, PAN regex. Name 85 or more with rapidfuzz, DOB equal and PAN hash equal gives `match`, `mismatch` or `not_found`.
7. Mask with Presidio plus custom recognizers for PAN, Aadhaar, Indian phone, DOB, address, email and names, then run the PII guard.
8. `identify_document` runs on the masked text. Confidence under 0.80 leaves it `received` for HR.
9. Checklist update:
   - right type + `match` → `verified`
   - `mismatch` → `name_mismatch` flag, never auto-rejected
   - not on the checklist → `wrong_type`
   - repeat of a type → newest is linked, older ones stay as history
10. Photo items (`check_mode` photo) skip OCR and wait for HR's one-click verify.
11. Extracted text is never saved, Aadhaar digits are never stored, and PAN is stored only as a salted hash.

## 10. Use cases

### UC-DOC, new-joiner documents

1. HR creates a joiner. This creates the person, an onboarding case, and a checklist from the template for that category + location, at stage `docs_requested`.
2. `doc_request` goes automatically to the recruiter, cc the candidate and the HR onboarding team.
3. Every document runs 9.8, and the checklist updates after each one.
4. Reminders every 48h, 3 times:
   - #1 goes to the recruiter
   - #2 and #3 go to the recruiter + candidate
   - the HR onboarding team is cc'd on all of them
   - each one lists the missing and unclear docs with reasons
5. Still missing after 3 reminders: `doc_dropout_alert` to recruitment + HR onboarding, flag `dropout_risk`, stop chasing.
6. All mandatory items verified: stage `ready_for_signoff`, reminders cancelled.
7. HR signs off with the Employee ID + remaining template fields, which starts UC-IT.

### UC-IT, IT setup and onboarding group

1. Sign-off sends `it_request` to the IT team, cc HR onboarding + recruiter, with the template table (no salary fields) and the passport photo.
2. The IT task tracks `{email_id, d365}`. It follows up every 48h, 3 times, then escalates to the HR onboarding owner.
3. When IT replies, regex pulls the `name@tcgdigital.com` address, skipping team and HR addresses, and `read_it_setup` confirms on the masked text.
4. Work email confirmed: save `work_email` and mark `email_id` done. D365 confirmed: mark `d365` done. Both done: close the task and cancel follow-ups. Partial: follow-ups ask only for what's left.
5. Credentials are never forwarded. If IT didn't send them to the joiner directly, an HR dashboard task "Send credentials to candidate" is created.
6. Once the work email is known, `onboarding_group_intimation` goes to the onboarding group once, with the template table, work email and photo, and no follow-up.
7. IT task done + group mail sent: the case closes and the `it.completed` event starts UC-IND.

### UC-EXIT, exit clearance

1. HR creates the exit (employee, last working day), or later the D365 termination date does. This makes an exit case with clearance tasks for IT, Finance, Admin and Manager, using items from the offboarding checklist.
2. `exit_intimation` goes automatically to the offboarding group + manager and points to their D365 tasks.
3. Follow-ups go only to teams still pending, inside the exit thread: Finance every 24h, others every 48h, 3 times, then escalate to HR.
4. Status comes from email replies (`read_clearance_status`), HR marking on the dashboard, and later the 15 min D365 poll.
5. Done or not applicable closes the task and cancels its follow-ups. Partial means follow up only on the remaining items.
6. Blocked, like a damaged laptop, sets the task to `blocked`, sends `exit_blocked_alert` to HR, and stops chasing that team.
7. All tasks closed: `exit_all_cleared` tells HR the relieving/experience letter can be issued, and the stage becomes `all_cleared`.
8. HR clicks Confirm release and the case closes. An exit case also stops 30/60/90 surveys and reminders for that person.

### UC-REM, recurring reminders

1. Each reminder type is a `reminder_rules` row, with no hard-coded reminder logic.
2. Seed rules:
   - appraisal: manager → reviewer → employee sign-off, performance team informed at each stage
   - leave approvals: manager
   - timesheets: employee
   - training: employee
3. Data comes from a CSV/XLSX that HR uploads per rule, and later from D365. Each row becomes a task, unless the same rule + owner + item is already open.
4. The rule tick sends the rule's template, follows up per the rule's gap and max, then escalates to the rule's contact.
5. On the next upload, a row that's gone means the task is done. A task marked done by reply whose row is still there gets reopened.
6. Replies:
   - done → task done, re-checked on the next data check
   - on leave → paused until the return date
   - question → `draft_reply`, then approval
7. When an appraisal stage moves, a new task goes to the next owner, plus an FYI mail to the performance team.

### UC-FB, 30-60-90 feedback

1. Daily at 09:00: find active employees, meaning no exit case, at L1 to L6 whose joining date was exactly 30, 60 or 90 days ago.
2. Send `survey_invite` with the campus or lateral Forms link, and create the survey row, plus a feedback case on the first survey.
3. No response after 3 days: `survey_reminder`, up to 2 times.
4. Read responses from the Form's Excel via Graph, which is R&D. The fallback is HR uploading the Forms export.
5. A score below the threshold sends `low_score_alert` to the HR owner and flags the row.
6. Monthly: mask the responses, run `analyse_feedback`, build a PDF, store it, and email it to HR.

### UC-IND, induction and welcome email

1. Starts on `it.completed` when the joining date is known, or when HR clicks "Plan induction".
2. Tracks:
   - campus: about 1 week
   - mid: shorter
   - senior, Director and above: standard sessions only, HR adds leadership sessions
3. `build_induction_schedule` drafts from the track template, skipping weekends and holidays, and the draft goes to the approval queue.
4. HR edits, adds sessions and approves. `induction_availability_request` then goes to each session owner + the manager.
5. No reply in 3 days: follow up, up to 2 times, then flag HR.
6. On a reply, `read_availability` reads the agreed time, then a free/busy check runs (getSchedule as the dedicated mailbox). Free means a calendar invite to the owner + joiner. Busy means HR is flagged.
7. The welcome email is scheduled for 09:30 IST on the joining day, to the joiner's personal email, cc the work email. It carries the final schedule, the manager's name, the appointment letter and the SoU PDF.
8. If there's no appointment letter by 09:00 the day before joining, `appointment_letter_missing` goes to HR. If it's still missing at send time, the welcome email is held and HR is flagged.

### UC-CMP, complaint capture

1. A `complaint` becomes a `complaints` row with the content, linked to the employee if the sender is known. The email row's content is wiped and hidden.
2. It is never replied to and never shown on timelines. Only complaints-access users can see it.
3. `complaint_alert` goes to the complaints owner with fixed neutral text and zero content.
4. HR uploads exit interviews and HR Connect transcripts into the restricted area for the later sentiment module.

## 11. Email templates, HR sends the wording, placeholders until then

- `doc_request`, `doc_reminder_recruiter`, `doc_reminder_candidate`, `doc_dropout_alert`
- `it_request`, `it_followup`, `it_escalation`, `onboarding_group_intimation`
- `exit_intimation`, `exit_followup`, `exit_escalation`, `exit_blocked_alert`, `exit_all_cleared`
- `reminder_<rule_key>`, `reminder_escalation`, `appraisal_performance_update`
- `survey_invite`, `survey_reminder`, `low_score_alert`, `feedback_report`
- `induction_availability_request`, `induction_followup`, `induction_no_reply_alert`, `welcome_email`, `appointment_letter_missing`
- `complaint_alert`
- Placeholders: `{{candidate_name}}`, `{{joining_date}}`, `{{missing_docs}}`, `{{unclear_docs}}`, `{{employee_code}}`, `{{last_working_day}}`, `{{pending_items}}`, `{{form_link}}`, `{{session_title}}`, `{{proposed_time}}`, `{{manager_name}}`, `{{schedule_table}}`, `{{onboarding_table}}`
- `it_request`, `onboarding_group_intimation` and `exit_intimation` copy the layout of today's real mails in `archive/`.

## 12. APIs

### 12.1 Conventions

- **Format:**
  - Base path is `/api`, apart from `/` and `/health`.
  - Bodies are JSON.
  - Timestamps are ISO 8601 with the IST offset. Dates are `YYYY-MM-DD`.
- **Auth:** send `Authorization: Bearer <access_token>`. Swagger's Authorize button uses the login form.
- **Access levels:**
  - `public`: no token
  - `viewer`: `hr_viewer` or `hr_admin`
  - `admin`: `hr_admin` only
  - `restricted`: any user with `complaints_access`
- **Rate limits:** login 10/min, uploads 20/min, other writes 30/min, reads 60/min, Graph webhooks 600/min.
- **Errors:**
  - Malformed UUID path params return 400 before anything else runs.
  - Every route can return 401, 422, 429 and 500. Each endpoint below lists only its extra error codes.
- **Lists:**
  - They accept `search` and the filters listed.
  - Sorting is `sort_by` plus `sort_order`: `latest`, `oldest`, `a_to_z` or `z_to_a`, default `latest`.
  - Paging is `limit`, 1 to 100 with default 50, and `offset`, default 0.
  - Search and name sort on encrypted columns run in the app after decrypt, see 7.1.
- **Response blocks below show only `data`.** The envelopes are shown once here:

```json
{"success": true, "message": "Joiner created", "data": {}}
```

```json
{"success": true, "message": "Found 42 joiners", "data": [], "total": 42, "limit": 50, "offset": 0}
```

```json
{"success": false, "error": {"status_code": 409, "status_message": "CONFLICT", "message": "This joiner already has an open onboarding case.", "code": "CONFLICT"}}
```

- **Exceptions to the envelope:**
  - Login returns `access_token` at the top level so Swagger Authorize works.
  - `DELETE` returns 204 with no body.
  - Graph webhooks reply the way Microsoft expects.

### 12.2 Shared objects

Responses point to these as `"<Name>"`.

```json
{
  "User": {
    "user_id": "uuid", "name": "TCG User", "email": "tcg@tcgdigital.com",
    "role": "hr_admin", "complaints_access": false, "is_active": true,
    "last_login_at": "2026-10-21T09:12:00+05:30"
  },
  "Person": {
    "person_id": "uuid", "full_name": "Rahul Sharma", "personal_email": "rahul.sharma@gmail.com",
    "work_email": "rahul.sharma@tcgdigital.com", "employee_code": "32700", "designation": "Senior Manager",
    "level": "L4", "location": "Kolkata", "hire_category": "lateral", "joining_date": "2026-11-16",
    "date_of_birth": "1990-02-20", "manager_name": "Amit Roy", "manager_email": "amit.roy@tcgdigital.com",
    "recruiter_email": "recruiter@tcgdigital.com", "role": "candidate", "status": "active"
  },
  "ChecklistItem": {
    "checklist_item_id": "uuid", "document_type": "pan_card", "is_mandatory": true, "check_mode": "text",
    "status": "verified", "person_check": "match", "attachment_id": "uuid", "notes": null,
    "updated_at": "2026-10-22T11:05:00+05:30"
  },
  "Attachment": {
    "attachment_id": "uuid", "kind": "email_document", "file_name": "pan.jpg", "mime_type": "image/jpeg",
    "size": 245000, "document_type_guess": "pan_card", "ai_confidence": 0.93, "ocr_quality": 81,
    "name_match_score": 96, "person_check": "match", "check_status": "processed", "issues": [],
    "is_latest": true, "received_at": "2026-10-22T11:02:00+05:30"
  },
  "Task": {
    "task_id": "uuid", "case_id": "uuid", "task_type": "clearance_it", "owner_role": "it",
    "owner_email": "it@tcgdigital.com", "status": "partial",
    "sub_items": {"credentials": "done", "laptop": "pending"},
    "progress_notes": "Laptop return pending from the user", "followups_sent": 1,
    "next_followup_at": "2026-11-27T10:00:00+05:30", "due_at": null, "completed_at": null
  },
  "InductionSession": {
    "induction_session_id": "uuid", "title": "IT orientation", "owner_email": "it@tcgdigital.com",
    "proposed_start": "2026-11-16T11:00:00+05:30", "proposed_end": "2026-11-16T12:00:00+05:30",
    "agreed_start": null, "agreed_end": null, "status": "asked", "graph_event_id": null
  },
  "TimelineEntry": {
    "at": "2026-10-22T11:02:00+05:30", "kind": "email", "direction": "inbound",
    "subject": "Documents for onboarding", "summary": "Sent PAN card and degree certificate",
    "category": "doc_submission", "actor": "candidate", "email_id": "uuid"
  },
  "ReminderRule": {
    "reminder_rule_id": "uuid", "name": "Timesheet", "rule_key": "timesheet", "data_source": "upload",
    "recipient_field": "employee_email", "required_columns": ["employee_name", "employee_email", "period"],
    "template_key": "reminder_timesheet", "stages": [], "schedule_cron": "0 10 * * MON",
    "followup_gap_hours": 48, "max_rounds": 3, "escalate_to_email": "hr@tcgdigital.com",
    "is_active": true, "next_run_at": "2026-10-26T10:00:00+05:30", "open_tasks": 12
  },
  "FileAttachment": {
    "file_name": "pending.xlsx", "file_url": "uploads/reminder_list/uuid.xlsx",
    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size": 20480
  }
}
```

### 12.3 Enum values

- `case_type`: onboarding, exit, induction, feedback
- `stage`:
  - onboarding: docs_requested, docs_in_progress, ready_for_signoff, it_requested, closed, dropout
  - exit: clearance_requested, clearances_in_progress, all_cleared, closed
  - induction: drafting, awaiting_approval, booking, booked, welcome_scheduled, welcome_sent, closed
  - feedback: active, closed
- `case status`: open, on_hold, closed, cancelled
- `flags`: dropout_risk, name_mismatch, sender_not_recognised, salary_document, failed_action, appointment_letter_missing, induction_no_reply, calendar_conflict, needs_hr
- `task_type`: it_setup, send_credentials, clearance_it, clearance_finance, clearance_admin, clearance_manager, induction_availability, reminder
- `task status`: open, partial, done, blocked, not_applicable, escalated, paused, cancelled
- `checklist status`: pending, received, verified, unreadable, wrong_type, name_mismatch
- `person_check`: match, mismatch, not_found
- `check_status`: pending, processed, unreadable, wrong_type, restricted, duplicate, skipped
- Approvals:
  - `approval_type`: reply, induction_schedule
  - `approval status`: pending, approved, rejected, sent
- `email category`: doc_submission, it_setup_reply, availability_reply, clearance_update, reminder_response, query, complaint, unrelated
- `hire_category`: campus, lateral
- `track`: campus, mid, senior
- `user role`: hr_admin, hr_viewer
- `document_type`, a placeholder until HR's checklist arrives: pan_card, aadhaar_card, passport_photo, class_10_certificate, class_12_certificate, degree_certificate, marksheets, relieving_letter, experience_letter, resume
- `upload purpose`: appointment_letter, reminder_list, survey_export, transcript, statement_of_understanding

### 12.4 Health

#### `GET /`
Returns the API name and version.
- **Access:** public · **Success:** 200

**Response**
```json
{"app_name": "Mail Reply Engine", "version": "2.0.0"}
```

#### `GET /health`
Health probe for monitoring, checks the DB, Redis, worker and Graph subscription.
- **Access:** public · **Success:** 200 · **Errors:** 503 DB or Redis unreachable

**Response**
```json
{"database": "connected", "redis": "connected", "worker": "online", "mailbox_subscription": "active", "kill_switch": false, "dry_run": true}
```

### 12.5 Auth

#### `POST /api/auth/login`
Logs an HR user in with email and password and returns a JWT.
- **Access:** public · **Success:** 200 · **Errors:** 401 wrong email or password, 403 account inactive
- The body is form data, not JSON. `username` carries the email.

**Request, form data**
```text
username=tcg@tcgdigital.com
password=********
```

**Response, full body**
```json
{"success": true, "message": "Login successful", "access_token": "eyJhbGciOi...", "token_type": "bearer", "expires_in": 86400, "user": "<User>"}
```

#### `POST /api/auth/logout`
Revokes the current token so it can't be used again.
- **Access:** viewer · **Success:** 200
- **Request:** no body

**Response**
```json
null
```

#### `GET /api/auth/me`
Returns the logged-in user.
- **Access:** viewer · **Success:** 200

**Response**
```json
"<User>"
```

#### `GET /api/users`
Lists HR dashboard users.
- **Access:** admin · **Success:** 200
- **Query:** search by name or email, role, is_active, sort_by `created_at`, `name` or `last_login_at`

**Response**
```json
["<User>"]
```

#### `POST /api/users`
Creates an HR dashboard user.
- **Access:** admin · **Success:** 201 · **Errors:** 409 email already used

**Request**
```json
{"name": "TCG User", "email": "tcg@tcgdigital.com", "password": "********", "role": "hr_viewer", "complaints_access": false}
```

**Response**
```json
"<User>"
```

#### `PATCH /api/users/{user_id}`
Changes a user's role, complaints access, active state or password.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 400 you can't remove your own admin role
- Every field is optional.

**Request**
```json
{"role": "hr_admin", "complaints_access": true, "is_active": true, "password": null}
```

**Response**
```json
"<User>"
```

### 12.6 Joiners, UC-DOC + UC-IT

#### `POST /api/joiners`
Creates a joiner, opens the onboarding case, builds the checklist from the template and sends the document request.
- **Access:** admin · **Success:** 201
- **Errors:**
  - 400: joining date in the past, or no checklist template for this category + location
  - 409: an open onboarding case already exists for this personal email

**Request**
```json
{
  "full_name": "Rahul Sharma",
  "personal_email": "rahul.sharma@gmail.com",
  "recruiter_email": "recruiter@tcgdigital.com",
  "hire_category": "lateral",
  "location": "Kolkata",
  "level": "L4",
  "joining_date": "2026-11-16",
  "date_of_birth": "1990-02-20",
  "manager_name": "Amit Roy",
  "manager_email": "amit.roy@tcgdigital.com"
}
```

**Response**
```json
{"person": "<Person>", "case_id": "uuid", "stage": "docs_requested", "checklist": ["<ChecklistItem>"]}
```

#### `GET /api/joiners`
Lists joiners with their onboarding progress for the Joiners screen.
- **Access:** viewer · **Success:** 200
- **Query:**
  - search by name, personal email or employee code
  - filters: stage, hire_category, location, level, flag, joining_from, joining_to
  - sort_by: `joining_date`, `full_name`, `updated_at` or `created_at`

**Response**
```json
[
  {
    "person_id": "uuid", "case_id": "uuid", "full_name": "Rahul Sharma", "joining_date": "2026-11-16",
    "hire_category": "lateral", "level": "L4", "location": "Kolkata", "stage": "docs_in_progress",
    "flags": ["name_mismatch"], "docs_verified": 5, "docs_total": 8,
    "next_followup_at": "2026-10-24T10:00:00+05:30", "updated_at": "2026-10-22T11:05:00+05:30"
  }
]
```

#### `PATCH /api/joiners/{person_id}`
Fixes joiner details before sign-off and re-runs the person check on documents already received.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 already signed off
- Any field from the create request can be sent.

**Request**
```json
{"full_name": "Rahul Kumar Sharma", "date_of_birth": "1990-02-21"}
```

**Response**
```json
{"person": "<Person>", "rechecked_documents": 3}
```

#### `POST /api/cases/{case_id}/sign-off`
HR's "ready to onboard" call. Saves the Employee ID and the remaining template fields, then sends the IT request.
- **Access:** admin · **Success:** 200
- **Errors:**
  - 404: case not found
  - 409: stage isn't `ready_for_signoff` and no `force_reason` was given
  - 409: employee_code already used

**Request**
```json
{
  "employee_code": "32700",
  "designation": "Senior Manager",
  "project_code": "Delivery 2.0",
  "gender": "Male",
  "blood_group": "B+",
  "date_of_marriage": null,
  "bu_head": "Neha Gupta",
  "employment_type": "Permanent",
  "contact_number": "9000000000",
  "sector_region": "India",
  "system_type": true,
  "proj_ops": false,
  "ess_d365": true,
  "skills": "Kafka, Elastic Search",
  "business_card": true,
  "force_reason": null
}
```

**Response**
```json
{"case_id": "uuid", "stage": "it_requested", "person": "<Person>", "it_task": "<Task>"}
```

#### `PATCH /api/cases/{case_id}/checklist/{checklist_item_id}`
HR verifies or overrides one checklist item, like a name mismatch or the passport photo.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 400 status not allowed
- **Allowed status:** verified, received, wrong_type, unreadable, pending.
- Once every mandatory item is verified, the case moves to `ready_for_signoff`.

**Request**
```json
{"status": "verified", "note": "Name differs only by an initial"}
```

**Response**
```json
{"checklist_item": "<ChecklistItem>", "case_stage": "ready_for_signoff"}
```

### 12.7 Cases, shared by every use case

#### `GET /api/cases/{case_id}`
Everything about one case for the Case details screen, for every case type.
- **Access:** viewer · **Success:** 200 · **Errors:** 404
- `checklist` is filled only for onboarding, and `sessions` only for induction.
- Complaints never show up here.

**Response**
```json
{
  "case": {"case_id": "uuid", "case_type": "onboarding", "stage": "docs_in_progress", "status": "open", "flags": [], "parent_case_id": null, "opened_at": "2026-10-20T10:00:00+05:30", "closed_at": null},
  "person": "<Person>",
  "checklist": ["<ChecklistItem>"],
  "attachments": ["<Attachment>"],
  "tasks": ["<Task>"],
  "sessions": ["<InductionSession>"],
  "approvals": [{"approval_id": "uuid", "approval_type": "reply", "status": "pending", "created_at": "2026-10-22T12:00:00+05:30"}],
  "timeline": ["<TimelineEntry>"],
  "next_followup_at": "2026-10-24T10:00:00+05:30"
}
```

#### `PATCH /api/cases/{case_id}`
Pauses, resumes, closes or cancels a case, and clears flags.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 case already closed
- `on_hold`, `closed` and `cancelled` cancel pending follow-ups. Going back to `open` schedules the next one.

**Request**
```json
{"status": "open", "clear_flags": ["dropout_risk"], "note": "Candidate confirmed joining"}
```

**Response**
```json
{"case_id": "uuid", "status": "open", "stage": "docs_in_progress", "flags": []}
```

#### `POST /api/cases/{case_id}/release-confirm`
HR's final call that the relieving letter can be issued. Closes the exit case.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 stage isn't `all_cleared`

**Request**
```json
{"note": "Letter issued on 2026-12-01"}
```

**Response**
```json
{"case_id": "uuid", "stage": "closed", "closed_at": "2026-12-01T15:00:00+05:30"}
```

#### `PATCH /api/tasks/{task_id}`
HR updates a task by hand, like a clearance done over Teams or credentials sent.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 task already closed
- Cancels the task's pending follow-ups, then checks whether the whole case is now complete.

**Request**
```json
{"status": "done", "sub_items": {"laptop": "done"}, "note": "Laptop received at reception"}
```

**Response**
```json
"<Task>"
```

#### `GET /api/attachments/{attachment_id}/download-url`
Gives a 5 minute link to view one stored file. Every call is logged.
- **Access:** viewer. Appointment letters need admin.
- **Success:** 200 · **Errors:** 404, 410 file deleted by the salary guard

**Response**
```json
{"url": "https://files.your-domain/mail-reply-engine/...", "expires_in": 300}
```

### 12.8 Exits, UC-EXIT

#### `POST /api/exits`
Creates an exit case with IT, Finance, Admin and Manager clearance tasks, and sends the group mail.
- **Access:** admin · **Success:** 201
- **Errors:**
  - 400: neither `person_id` nor full employee details
  - 404: `person_id` not found
  - 409: an open exit case already exists for this person
- Send `person_id` for someone already in the system. Otherwise send the employee details and leave `person_id` null.

**Request**
```json
{
  "person_id": null,
  "full_name": "Rahul Sharma",
  "employee_code": "32999",
  "work_email": "rahul.sharma@tcgdigital.com",
  "manager_name": "Amit Roy",
  "manager_email": "amit.roy@tcgdigital.com",
  "last_working_day": "2026-11-30"
}
```

**Response**
```json
{"case_id": "uuid", "person": "<Person>", "stage": "clearance_requested", "tasks": ["<Task>"]}
```

#### `GET /api/exits`
Lists exits with clearance status per team for the Exits screen.
- **Access:** viewer · **Success:** 200
- **Query:**
  - search by name or employee code
  - filters: stage, pending_team (`it`, `finance`, `admin` or `manager`), lwd_from, lwd_to
  - sort_by: `last_working_day`, `full_name` or `created_at`

**Response**
```json
[
  {
    "case_id": "uuid", "person_id": "uuid", "full_name": "Rahul Sharma", "employee_code": "32999",
    "last_working_day": "2026-11-30", "stage": "clearances_in_progress", "flags": [],
    "clearances": {"it": "partial", "finance": "open", "admin": "done", "manager": "done"},
    "updated_at": "2026-11-26T10:00:00+05:30"
  }
]
```

### 12.9 Approvals

#### `GET /api/approvals`
Lists the approval queue of AI-drafted replies and induction schedules.
- **Access:** viewer · **Success:** 200
- **Query:** status (default `pending`), approval_type, case_id, sort_by `created_at`

**Response**
```json
[{"approval_id": "uuid", "approval_type": "reply", "case_id": "uuid", "person_name": "Rahul Sharma", "summary": "Asks if the joining date can move", "status": "pending", "created_at": "2026-10-22T12:00:00+05:30"}]
```

#### `GET /api/approvals/{approval_id}`
Shows one draft plus the email that triggered it.
- **Access:** viewer · **Success:** 200 · **Errors:** 404

**Response, reply draft**
```json
{
  "approval_id": "uuid", "approval_type": "reply", "case_id": "uuid", "status": "pending",
  "source_email": {"email_id": "uuid", "from": "rahul.sharma@gmail.com", "subject": "Joining date", "received_at": "2026-10-22T11:50:00+05:30", "body": "Can I join on 23 Nov instead?"},
  "draft": {"subject": "Re: Joining date", "body": "Hi Rahul, ..."}
}
```

**Response, induction schedule draft**
```json
{
  "approval_id": "uuid", "approval_type": "induction_schedule", "case_id": "uuid", "status": "pending", "source_email": null,
  "draft": {"track": "mid", "sessions": [{"title": "HR policies", "owner_email": "hr@tcgdigital.com", "start": "2026-11-16T10:00:00+05:30", "end": "2026-11-16T11:00:00+05:30"}]}
}
```

#### `PATCH /api/approvals/{approval_id}`
Saves HR's edits to a draft without approving it.
- **Access:** admin · **Success:** 200
- **Errors:**
  - 404: approval not found
  - 409: no longer pending
  - 400: a session falls on a weekend, a holiday or outside working hours

**Request**
```json
{"draft": {"subject": "Re: Joining date", "body": "Hi Rahul, HR will confirm the new date by Friday."}}
```

**Response:** same shape as `GET /api/approvals/{approval_id}`.

#### `POST /api/approvals/{approval_id}/approve`
Approves a draft. A reply goes out in its thread, or a schedule is saved and the availability mails start.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 no longer pending
- The kill switch and dry-run still apply. Approved replies don't count toward the daily auto-email cap.
- Send a final edit in `draft`, or `null` to approve as is.

**Request**
```json
{"draft": null}
```

**Response**
```json
{"approval_id": "uuid", "status": "approved", "email_id": "uuid", "sessions_created": 0}
```

#### `POST /api/approvals/{approval_id}/reject`
Rejects a draft, and nothing is sent.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 no longer pending

**Request**
```json
{"reason": "I will call the candidate instead"}
```

**Response**
```json
{"approval_id": "uuid", "status": "rejected"}
```

### 12.10 Induction, UC-IND

#### `POST /api/cases/{case_id}/induction`
HR's "Plan induction" on an onboarding case. Opens an induction case and queues the AI draft, which lands in the approval queue.
- **Access:** admin · **Success:** 202
- **Errors:**
  - 404: case not found
  - 400: no joining date
  - 409: induction already planned
- `track` is optional and overrides the auto-picked track.

**Request**
```json
{"track": null}
```

**Response**
```json
{"induction_case_id": "uuid", "stage": "drafting", "track": "mid"}
```

#### `POST /api/cases/{case_id}/appointment-letter`
Attaches the appointment letter HR uploaded. It only gets attached to the welcome email and is never opened.
- **Access:** admin · **Success:** 201 · **Errors:** 404, 400 not a PDF
- `{case_id}` is the joiner's onboarding or induction case. A new upload replaces the old one.

**Request**
```json
{"file_name": "appointment.pdf", "file_url": "uploads/appointment_letter/uuid.pdf", "mime_type": "application/pdf", "size": 120000}
```

**Response**
```json
{"attachment": "<Attachment>"}
```

#### `POST /api/induction-sessions/{induction_session_id}/book`
HR books a flagged session by hand after a no-reply or a calendar conflict.
- **Access:** admin · **Success:** 200
- **Errors:**
  - 404: session not found
  - 409: owner is busy then and `force` is false
  - 502: Graph failed

**Request**
```json
{"start": "2026-11-16T11:00:00+05:30", "end": "2026-11-16T12:00:00+05:30", "force": false}
```

**Response**
```json
"<InductionSession>"
```

### 12.11 Reminders, UC-REM

#### `GET /api/reminder-rules`
Lists reminder rules with their open task counts.
- **Access:** viewer · **Success:** 200
- **Query:** search by name, is_active, data_source, sort_by `name` or `created_at`

**Response**
```json
["<ReminderRule>"]
```

#### `POST /api/reminder-rules`
Adds a new reminder rule.
- **Access:** admin · **Success:** 201 · **Errors:** 400 unknown template_key or bad cron, 409 rule_key already used

**Request**
```json
{
  "name": "Timesheet",
  "rule_key": "timesheet",
  "data_source": "upload",
  "recipient_field": "employee_email",
  "required_columns": ["employee_name", "employee_email", "period"],
  "template_key": "reminder_timesheet",
  "stages": [],
  "schedule_cron": "0 10 * * MON",
  "followup_gap_hours": 48,
  "max_rounds": 3,
  "escalate_to_email": "hr@tcgdigital.com",
  "is_active": true
}
```

**Response**
```json
"<ReminderRule>"
```

#### `PATCH /api/reminder-rules/{reminder_rule_id}`
Edits or pauses a rule.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 400 unknown template_key or bad cron
- Every field from the create request is optional.

**Request**
```json
{"is_active": false, "followup_gap_hours": 72}
```

**Response**
```json
"<ReminderRule>"
```

#### `POST /api/reminder-rules/{reminder_rule_id}/uploads`
Takes HR's pending-people list. Creates tasks for new rows, closes tasks whose rows are gone, and reopens tasks marked done that are still listed.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 400 not CSV or XLSX, or required columns missing

**Request**
```json
{"file": "<FileAttachment>"}
```

**Response**
```json
{"rows_total": 40, "rows_valid": 38, "rows_invalid": [{"row": 7, "reason": "employee_email is missing"}], "tasks_created": 30, "tasks_closed": 5, "tasks_reopened": 1}
```

#### `GET /api/reminder-rules/{reminder_rule_id}/tasks`
Lists the tasks for one rule.
- **Access:** viewer · **Success:** 200 · **Errors:** 404
- **Query:** search by owner name or email, status, sort_by `due_at` or `created_at`

**Response**
```json
["<Task>"]
```

### 12.12 Feedback, UC-FB

#### `GET /api/feedback/surveys`
Lists 30-60-90 surveys with their response status.
- **Access:** viewer · **Success:** 200
- **Query:**
  - search by name
  - filters: milestone, status (`sent`, `responded` or `no_response`), flagged, form_variant
  - sort_by: `sent_at`, `score` or `full_name`

**Response**
```json
[{"survey_response_id": "uuid", "person_id": "uuid", "full_name": "Rahul Sharma", "milestone": 30, "form_variant": "lateral", "sent_at": "2026-12-16T09:00:00+05:30", "reminders_sent": 1, "responded_at": null, "score": null, "flagged": false}]
```

#### `POST /api/feedback/responses/upload`
Fallback that reads survey responses from an uploaded Forms export.
- **Access:** admin · **Success:** 200 · **Errors:** 400 wrong file type or columns

**Request**
```json
{"form_variant": "lateral", "file": "<FileAttachment>"}
```

**Response**
```json
{"rows_total": 13, "rows_matched": 12, "rows_unmatched": 1, "low_score_alerts": 1}
```

#### `GET /api/feedback/reports`
Lists generated feedback reports.
- **Access:** viewer · **Success:** 200
- **Query:** status, sort_by `period_start`

**Response**
```json
[{"feedback_report_id": "uuid", "period_start": "2026-10-01", "period_end": "2026-10-31", "response_count": 18, "status": "sent", "sent_at": "2026-11-01T09:05:00+05:30"}]
```

#### `POST /api/feedback/reports`
Generates a report now for any period and emails it to HR.
- **Access:** admin · **Success:** 202
- **Errors:**
  - 400: end is before start
  - 409: a report for this period is already queued

**Request**
```json
{"period_start": "2026-10-01", "period_end": "2026-10-31"}
```

**Response**
```json
{"feedback_report_id": "uuid", "status": "queued"}
```

#### `GET /api/feedback/reports/{feedback_report_id}/download-url`
Gives a 5 minute link to the report PDF.
- **Access:** viewer · **Success:** 200 · **Errors:** 404, 409 report not ready

**Response**
```json
{"url": "https://files.your-domain/mail-reply-engine/...", "expires_in": 300}
```

### 12.13 Complaints, restricted

#### `GET /api/complaints`
Lists restricted complaints and uploaded transcripts.
- **Access:** restricted · **Success:** 200 · **Errors:** 403
- **Query:** search by sender or subject, source, date_from, date_to, sort_by `received_at`

**Response**
```json
[{"complaint_id": "uuid", "received_at": "2026-10-22T16:40:00+05:30", "source": "email", "sender_email": "employee@tcgdigital.com", "person_name": "Rahul Sharma", "subject": "Concern about my team"}]
```

#### `GET /api/complaints/{complaint_id}`
Shows one complaint in full. Every view is written to the action log.
- **Access:** restricted · **Success:** 200 · **Errors:** 403, 404

**Response**
```json
{
  "complaint_id": "uuid", "received_at": "2026-10-22T16:40:00+05:30", "source": "email",
  "sender_email": "employee@tcgdigital.com",
  "person": {"person_id": "uuid", "full_name": "Rahul Sharma", "employee_code": "32700"},
  "subject": "Concern about my team", "content": "...", "attachment": null
}
```

#### `POST /api/complaints/uploads`
Stores an exit interview or HR Connect transcript for the later sentiment module.
- **Access:** restricted · **Success:** 201
- **Errors:**
  - 400: bad file type
  - 404: `person_id` not found

**Request**
```json
{"source": "hr_connect", "person_id": "uuid", "file": "<FileAttachment>"}
```

**Response**
```json
{"complaint_id": "uuid", "source": "hr_connect", "received_at": "2026-10-23T10:00:00+05:30"}
```

### 12.14 Uploads

#### `POST /api/uploads/presign`
Gives the browser a presigned POST so it can upload a file straight to MinIO.
- **Access:** admin, or restricted for the `transcript` purpose
- **Success:** 200 · **Errors:** 400 type or size not allowed for this purpose
- **Allowed types, max `upload_max_mb`:**
  - `appointment_letter`: PDF
  - `statement_of_understanding`: PDF
  - `reminder_list`: CSV or XLSX
  - `survey_export`: XLSX
  - `transcript`: PDF, DOCX or TXT
- After the upload, send `file_url` inside a `FileAttachment` to the matching endpoint.

**Request**
```json
{"file_name": "pending.xlsx", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "size": 20480, "purpose": "reminder_list"}
```

**Response**
```json
{"upload_url": "https://files.your-domain/mail-reply-engine", "fields": {"key": "uploads/reminder_list/uuid.xlsx", "policy": "...", "x-amz-algorithm": "AWS4-HMAC-SHA256", "x-amz-credential": "...", "x-amz-date": "...", "x-amz-signature": "..."}, "file_url": "uploads/reminder_list/uuid.xlsx", "expires_in": 300}
```

### 12.15 Admin

#### `GET /api/admin/status`
Live switches plus mailbox and queue health for the Admin screen.
- **Access:** viewer · **Success:** 200

**Response**
```json
{
  "kill_switch": false, "dry_run": true, "test_inbox": "hr-test@tcgdigital.com",
  "document_reading_enabled": false, "d365_enabled": false,
  "mailbox": {"subscription_expires_at": "2026-10-24T09:00:00+05:30", "last_poll_at": "2026-10-22T12:02:00+05:30", "last_email_at": "2026-10-22T11:50:00+05:30"},
  "queue": {"queued": 2, "processing": 1, "failed": 0}
}
```

#### `POST /api/admin/kill-switch`
Stops or allows all sending. Takes effect within 1 minute.
- **Access:** admin · **Success:** 200

**Request**
```json
{"enabled": true, "reason": "Wrong template went out"}
```

**Response**
```json
{"kill_switch": true, "changed_by": "TCG User", "changed_at": "2026-10-22T12:05:00+05:30"}
```

#### `POST /api/admin/dry-run`
Turns test inbox mode on or off.
- **Access:** admin · **Success:** 200 · **Errors:** 400 `test_inbox` missing when enabling

**Request**
```json
{"enabled": false, "test_inbox": null}
```

**Response**
```json
{"dry_run": false, "test_inbox": "hr-test@tcgdigital.com", "changed_by": "TCG User", "changed_at": "2026-10-22T12:06:00+05:30"}
```

#### `GET /api/settings`
Lists every tunable from section 8. Not paginated, since the list is small.
- **Access:** viewer · **Success:** 200

**Response**
```json
[{"key": "followup_gap_hours", "value": 48, "description": "Hours between follow-ups", "updated_by": "TCG User", "updated_at": "2026-10-20T10:00:00+05:30"}]
```

#### `PATCH /api/settings`
Updates one or more tunables, each validated by its own type.
- **Access:** admin · **Success:** 200 · **Errors:** 400 unknown key or invalid value
- `kill_switch` and `dry_run` use their own endpoints.

**Request**
```json
{"followup_gap_hours": 72, "max_followups": 2}
```

**Response:** the updated rows, same shape as `GET /api/settings`.

#### `GET /api/templates`
Lists email templates.
- **Access:** viewer · **Success:** 200
- **Query:** search by key or subject, is_active

**Response**
```json
[{"template_key": "doc_request", "name": "Document request", "subject": "Documents needed for {{candidate_name}}", "placeholders": ["candidate_name", "joining_date", "document_list"], "is_active": true, "updated_at": "2026-10-20T10:00:00+05:30"}]
```

#### `GET /api/templates/{template_key}`
Returns one template with its body.
- **Access:** viewer · **Success:** 200 · **Errors:** 404

**Response**
```json
{"template_key": "doc_request", "name": "Document request", "subject": "Documents needed for {{candidate_name}}", "body_html": "<p>Hi, please share ...</p>", "placeholders": ["candidate_name", "joining_date", "document_list"], "is_active": true, "updated_at": "2026-10-20T10:00:00+05:30"}
```

#### `PATCH /api/templates/{template_key}`
Edits a template's wording.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 400 unknown placeholder

**Request**
```json
{"subject": "Documents needed for {{candidate_name}}", "body_html": "<p>Hi, please share ...</p>", "is_active": true}
```

**Response:** same shape as `GET /api/templates/{template_key}`.

#### `POST /api/templates/{template_key}/preview`
Renders a template with sample values or the values sent.
- **Access:** viewer · **Success:** 200 · **Errors:** 404, 400 missing placeholder values

**Request**
```json
{"values": {"candidate_name": "Rahul Sharma", "joining_date": "16 Nov 2026", "document_list": "PAN card, Degree certificate"}}
```

**Response**
```json
{"subject": "Documents needed for Rahul Sharma", "body_html": "<p>Hi, please share ...</p>"}
```

#### `GET /api/checklist-templates`
Lists document checklists per hire category + location.
- **Access:** viewer · **Success:** 200
- **Query:** hire_category, location

**Response**
```json
[{"hire_category": "lateral", "location": "Kolkata", "items": [{"document_type": "relieving_letter", "is_mandatory": true, "check_mode": "text", "sort_order": 1}], "updated_at": "2026-10-20T10:00:00+05:30"}]
```

#### `PUT /api/checklist-templates`
Replaces the checklist for one hire category + location. Only new joiners get the change.
- **Access:** admin · **Success:** 200 · **Errors:** 400 empty list or duplicate document types

**Request**
```json
{"hire_category": "lateral", "location": "Kolkata", "items": [{"document_type": "relieving_letter", "is_mandatory": true, "check_mode": "text"}, {"document_type": "passport_photo", "is_mandatory": true, "check_mode": "photo"}]}
```

**Response:** one item, same shape as the `GET /api/checklist-templates` list.

#### `GET /api/induction-templates/{track}`
Returns the session template for one induction track.
- **Access:** viewer · **Success:** 200

**Response**
```json
{"track": "mid", "sessions": [{"title": "IT orientation", "owner_email": "it@tcgdigital.com", "duration_mins": 60, "day_number": 1}], "updated_at": "2026-10-20T10:00:00+05:30"}
```

#### `PUT /api/induction-templates/{track}`
Replaces a track's sessions.
- **Access:** admin · **Success:** 200 · **Errors:** 400 empty list or day_number below 1

**Request**
```json
{"sessions": [{"title": "IT orientation", "owner_email": "it@tcgdigital.com", "duration_mins": 60, "day_number": 1}]}
```

**Response:** same shape as `GET /api/induction-templates/{track}`.

#### `GET /api/holidays`
Lists holidays, which are skipped for sending and induction days.
- **Access:** viewer · **Success:** 200
- **Query:** year, location

**Response**
```json
[{"holiday_id": "uuid", "holiday_date": "2026-12-25", "name": "Christmas", "location": null}]
```

#### `POST /api/holidays`
Adds a holiday. A `null` location means every location.
- **Access:** admin · **Success:** 201 · **Errors:** 409 same date + location already exists

**Request**
```json
{"holiday_date": "2026-12-25", "name": "Christmas", "location": null}
```

**Response**
```json
{"holiday_id": "uuid", "holiday_date": "2026-12-25", "name": "Christmas", "location": null}
```

#### `DELETE /api/holidays/{holiday_id}`
Removes a holiday.
- **Access:** admin · **Success:** 204, no body · **Errors:** 404

#### `POST /api/admin/statement-of-understanding`
Sets the fixed SoU PDF that is attached to every welcome email.
- **Access:** admin · **Success:** 200 · **Errors:** 400 not a PDF

**Request**
```json
{"file_name": "statement-of-understanding.pdf", "file_url": "uploads/statement_of_understanding/uuid.pdf", "mime_type": "application/pdf", "size": 80000}
```

**Response**
```json
{"attachment": "<Attachment>"}
```

#### `GET /api/action-log`
Searchable log of every action by the agent, the system and HR users.
- **Access:** viewer · **Success:** 200
- **Query:** case_id, actor_type, action, date_from, date_to, sort_order `latest` or `oldest`

**Response**
```json
[{"action_log_id": "uuid", "occurred_at": "2026-10-22T11:03:00+05:30", "actor_type": "agent", "actor_name": "agent", "action": "checklist_item_verified", "case_id": "uuid", "entity_type": "checklist_item", "entity_id": "uuid", "details": {"document_type": "pan_card"}}]
```

#### `GET /api/admin/failures`
Lists events and jobs that ran out of retries.
- **Access:** viewer · **Success:** 200
- **Query:** kind (`event` or `job`), event_type
- `last_error` is a short reason with no personal data.

**Response**
```json
[{"failure_id": "uuid", "kind": "event", "event_type": "email.received", "case_id": "uuid", "attempts": 5, "last_error": "Graph returned 503", "updated_at": "2026-10-22T12:00:00+05:30"}]
```

#### `POST /api/admin/failures/{failure_id}/retry`
Re-queues one failed event or job.
- **Access:** admin · **Success:** 200 · **Errors:** 404, 409 not in failed state

**Request**
```json
{"kind": "event"}
```

**Response**
```json
{"failure_id": "uuid", "kind": "event", "status": "queued"}
```

### 12.16 Graph webhooks

#### `POST /api/graph/notifications`
Receives Microsoft's new-mail notifications for the dedicated mailbox.
- **Access:** public, each item checked by `clientState` · **Success:** 200 for the handshake, 202 for notifications
- **Handshake:** when Microsoft calls with `?validationToken=...`, reply 200 `text/plain` with the token exactly as received.
- **Notifications:**
  - Drop items with a wrong `clientState`.
  - Enqueue one `email.received` event per item.
  - Reply 202 right away with no body.

**Request, sent by Microsoft**
```json
{"value": [{"subscriptionId": "uuid", "clientState": "secret", "changeType": "created", "resource": "Users/{mailbox-id}/Messages/{message-id}", "resourceData": {"id": "AAMkAG..."}}]}
```

#### `POST /api/graph/lifecycle`
Receives subscription lifecycle events from Microsoft.
- **Access:** public, checked by `clientState` · **Success:** 200 for the handshake, 202 for events
- Uses the same handshake as notifications.
- **Events:**
  - `reauthorizationRequired` renews the subscription.
  - `subscriptionRemoved` recreates it.
  - `missed` runs a delta poll now.

**Request, sent by Microsoft**
```json
{"value": [{"subscriptionId": "uuid", "clientState": "secret", "lifecycleEvent": "reauthorizationRequired"}]}
```

## 13. Dashboard screens

1. **Joiners:** list + Create joiner form
2. **Case details:** checklist, documents with download links, timeline, tasks, flags, sign-off, Plan induction, appointment letter upload
3. **Approval queue:** approve, edit, reject
4. **Exits:** list + Create exit form, clearance status per team, Confirm release
5. **Reminders:** rules + pending-list upload
6. **Restricted:** complaints, visible only with complaints access
7. **Admin:** status, kill switch, dry-run, settings, templates, checklists, induction templates, holidays, SoU, action log, failures, users
8. **Feedback** (small add): surveys + reports

## 14. Pending from HR / IT, placeholders until then

- Document checklists for campus, lateral and US
- Wording for the IT request, the onboarding group mail, reminders and every other template
- Onboarding group address and team addresses: Finance, Admin, HR owners, complaints owner, performance, training
- Induction agendas per track
- 30-60-90 questions, Forms links and the low-score threshold
- Offboarding checklist items per team
- Appraisal stage deadlines and the training list
- D365 API access
- Security approval to read document content
- Calendars.ReadWrite on the "HR Automation" app for induction booking, plus a test mailbox for dry-run
- A public HTTPS URL for the Graph webhook. The DS sandbox IP has no domain or certificate, so we run on polling only until one exists.
- How long candidate documents are kept after onboarding closes

## 15. Out of scope for this build

- Letter generation, including relieving and experience letters
- Employee data-change requests
- Appraisal master sheet
- One-off custom reminders
- CV vs relieving letter employer cross-check
- The sentiment analysis module, though its inputs are stored now
- Real D365 integration, only a stub and a switch until access arrives

## 16. Build order

1. **Core:** Graph listener, junk filter, events + Celery, DB, routing by thread + sender, templates, the send pipeline with dedupe, action log, kill switch, dry-run, MinIO.
   - Done when a test email is received, linked, logged, and a template reply goes out exactly once in the same thread.
2. **Scheduler + follow-ups:** scheduled jobs, follow-up rules, sending window, daily cap.
   - Done when follow-ups go on time, stop on reply, and never send twice.
3. **UC-DOC + UC-IT:** create joiner, document check, reminders, dropout, sign-off, IT request, IT reply, onboarding group mail.
   - Done when one test joiner goes from creation to the onboarding group email.
4. **AI classifier + approvals:** classifier, drafted replies, approval queue, complaint capture.
   - Done when test emails land in the right category and complaints never get a reply.
5. **UC-FB:** daily check, surveys, reminders, low-score alerts, monthly report.
   - Done when test joiners get surveys on day 30, 60 and 90 and the report is generated.
6. **UC-IND:** draft, approval, availability mails, calendar booking, welcome email.
   - Done when a test joiner gets calendar invites and the 09:30 welcome email with attachments.
7. **UC-EXIT + UC-REM:** clearance flow and reminder rules on test data, switching to D365 later.
   - Done when a test exit is chased to all-cleared with HR notified, and reminder rules run from DB settings.

Each step ships its frontend screens alongside it.

## 17. Whole build is done when

- Every use case runs end to end in dry-run on the test mailbox with test data.
- Every action shows up in the action log.
- No personal data appears in any AI request, confirmed through `llm_requests`.
- The kill switch stops all sending within 1 minute.
- A plain `pg_dump` shows no readable personal data from email.
