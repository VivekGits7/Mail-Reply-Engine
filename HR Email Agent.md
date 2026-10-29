**HR Email Agent: Developer Brief**

## **1\. What we are building and why**

* TCG's HR team does a lot of manual email work: checking new-joiner documents, chasing IT for email IDs, chasing teams for exit clearances, reminding people about appraisals and timesheets, sending feedback surveys, and setting up inductions.  
* D365 (the HR system) sends almost no notifications, so HR does all this chasing by hand.  
* We are building **one email automation system** that works from a dedicated mailbox.  
* It reads every incoming email, works out what the email is about, takes the right action, sends the right reply, and keeps following up on its own until the work is done.  
* HR stays in control through a simple dashboard.

## **2\. What is in scope**

We are building 7 use cases:

* **UC-DOC:** check new-joiner documents before joining  
* **UC-IT:** ask IT to set up the joiner's email and D365 access, then inform the onboarding group  
* **UC-EXIT:** chase IT, Finance, Admin and Manager for exit clearances  
* **UC-REM:** send recurring reminders (appraisals, timesheets, leave approvals, training)  
* **UC-FB:** send 30-60-90 day feedback surveys and produce a summary report  
* **UC-IND:** plan the induction schedule, book calendars, send the welcome email  
* **UC-CMP:** capture complaint emails safely for later analysis

Not in scope right now: letter generation, employee data-change requests, appraisal master sheet, one-off custom reminders.

## **3\. Rules you must always follow**

* Only read and send from the dedicated mailbox. Never touch the main HR inbox.  
* **Emails based on a fixed template are sent automatically.**  
* **Any email the AI writes itself (not from a template) must wait for HR approval before sending.**  
* Never reply to a complaint. Just store it, with restricted access.  
* If an email doesn't match any use case, log it quietly and do nothing.  
* Never send personal data (name, PAN, Aadhaar, phone, address, date of birth) to the AI model. Mask it first.  
* No salary or compensation data anywhere in this system.  
* **The AI only makes decisions and returns them as structured data. Your code performs every action.** No free-running AI agent in this version.  
* Log every action: what happened, when, who or what did it, and for which case.  
* HR makes the final call on three things: "ready to onboard", "release letter can be issued", and approving the induction schedule.  
* Build a **kill switch** (stops all sending) and a **dry-run mode** (sends every email to a test inbox instead of real people) from day one.

## **4\. How the system is built**

Think of it as 7 parts working together:

1. **Mail listener:** gets notified the moment a new email arrives in the dedicated mailbox, through the Microsoft Graph webhook. As a backup, it also checks the mailbox every 1-2 minutes in case a notification is missed. The webhook subscription expires within about 3 days, so renew it automatically.  
2. **Event queue:** everything that can start work (a new email, a scheduled time, an HR button click) is turned into an "event" and put in a queue. This makes sure nothing gets lost and nothing gets processed twice. If something fails, it retries.  
3. **Router:** picks up each event and decides which use case should handle it.  
4. **Use case handlers:** one handler per use case. Each holds the steps for that use case, and tracks which stage each case is at.  
5. **AI helpers:** small, separate functions that call the AI model for one job each: mask personal data, classify an email, identify a document type, read availability from a reply, draft a reply, analyse survey results. They always return structured data (JSON), never actions.  
6. **Scheduler:** runs on its own every few minutes and sends anything that is due, like follow-ups, survey emails and daily checks.  
7. **Database \+ dashboard:** the database stores everything about every case and is the single source of truth. The dashboard is where HR creates cases, approves things, and sees status.

## **5\. Tech stack**

Use these unless you have a strong reason not to:

* Backend: Python 3.11+ with FastAPI  
* Database: PostgreSQL  
* Queue and scheduler: Redis \+ Celery (worker \+ beat)  
* Email and calendar: Microsoft Graph API (app registration with client ID \+ secret). IT will restrict the app so it can only access the dedicated mailbox.  
* Reading documents: PyMuPDF for PDFs, python-docx for Word files, Tesseract or EasyOCR for scanned images and photos  
* Masking personal data: Microsoft Presidio, with custom rules added for PAN, Aadhaar, Indian phone numbers, date of birth and address  
* Name matching: rapidfuzz  
* AI model: any hosted model, but call it through **one single module** (`llm_client`) so we can swap the model later without touching the rest of the code  
* Dashboard: React  
* Deployment: Docker / docker-compose, hosted inside MQ

Reuse the code already built in the earlier POCs (reading the mailbox, downloading attachments, avoiding duplicate reminders) wherever it fits.

## **6\. The three ways work gets started**

**1\. A new email arrives**

* The mail listener picks it up and it goes through the email steps in Section 7\.  
* Used by: UC-DOC, UC-IT, UC-EXIT, UC-REM, UC-IND, UC-CMP.

**2\. The scheduler runs**

* Every 5 minutes: send anything that's due (follow-ups, reminders).  
* Every day at 9:00 AM IST: check who has hit 30, 60 or 90 days since joining.  
* Every 15 minutes (once we get D365 access): check D365 for status changes.  
* Used by: all follow-ups, UC-FB, UC-REM, UC-EXIT.

**3\. Something happens (an event)**

* HR does something on the dashboard: creates a joiner, signs off "ready to onboard", approves an induction schedule, creates an exit case, uploads an appointment letter.  
* Later, also a status change detected in D365.  
* Used by: the start of UC-DOC, UC-IT, UC-IND, UC-EXIT.

## **7\. What happens when an email arrives (step by step)**

1. **Save it.** Store the email details in the database. If we've already seen this email (same message ID), stop here.  
2. **Filter out junk.** Ignore emails sent by our own mailbox, auto-replies, out-of-office messages, bounce-backs and bulk or newsletter mail. Log them as "filtered".  
3. **Is it a reply to something we sent?** If it belongs to an email thread we started, link it to that case.  
4. **Do we know the sender?** If the sender is a person with an open case, link it to that case.  
5. **Ask the AI what kind of email it is.** Mask the subject and body first, then send it to the AI along with the sender's open cases and the list of categories below. Do this even if step 3 already found the case: the thread tells us *which case*, the AI tells us *what kind of email*.  
6. **Decide.** If the AI is at least 80% confident, pass it to the right use case handler. Otherwise, log it quietly and do nothing. (If the sender has a case, show the email on that case's timeline so HR can see it.)  
7. **Act.** The handler does its job (see Section 10).  
8. **Finish.** Mark the email as processed and write it to the action log.

**The email categories:**

* **DOC_SUBMISSION:** a candidate or recruiter is sending documents. Goes to the document check (UC-DOC).  
* **IT_SETUP_REPLY:** IT confirms the email ID or D365 access is ready. Closes the IT task (UC-IT).  
* **AVAILABILITY_REPLY:** a manager or session owner replies with their available times. Book the meeting (UC-IND).  
* **CLEARANCE_UPDATE:** someone from IT, Finance, Admin or the manager says an exit clearance is done, pending or blocked. Update the clearance (UC-EXIT).  
* **REMINDER_RESPONSE:** someone replies to a reminder ("done", "on leave"). Update the task (UC-REM).  
* **QUERY:** someone asks a question that needs a written answer. The AI drafts a reply and it goes to HR for approval.  
* **COMPLAINT:** an employee grievance or complaint. Store it in the restricted area and never reply (UC-CMP).  
* **UNRELATED:** anything else. Log quietly, do nothing.

**What the AI must return for each email:**

* category (one of the above)  
* confidence (a number from 0 to 1\)  
* case ID, if it can tell  
* a one-line summary  
* any useful details it spotted (for example, which documents are mentioned)

## **8\. How to set up the AI**

**Instructions for the email classifier:**

* Explain its role.  
* List every category with a clear definition and 2 example emails each.  
* Tell it to reply in JSON only.  
* Tell it never to draft a reply to a complaint.  
* Tell it to give a lower confidence score whenever it is unsure.

**AI helper functions to build** (each returns JSON):

* classify an email  
* identify a document type  
* read availability from a reply  
* read clearance status from a reply  
* draft a reply (always goes to HR approval)  
* build an induction schedule (always goes to HR approval)  
* analyse feedback survey results

**Email templates:**

* Store all templates in the database with placeholders like `{{candidate_name}}`, `{{missing_docs}}`, `{{joining_date}}`.  
* HR will send the actual wording. Use simple placeholder text until then.

**Default settings** (HR must be able to change all of these from the dashboard):

* AI confidence needed to act: 80%  
* Gap between follow-ups: 48 hours  
* Gap between follow-ups for Finance (exits): 24 hours  
* Maximum follow-ups: 3, then escalate once and stop  
* Induction availability follow-up: after 3 days, maximum 2  
* Survey reminder: 3 days after sending, maximum 2  
* Maximum automatic emails to one person per day: 3  
* Sending hours: Monday to Friday, 9:00 AM to 7:00 PM IST (anything outside this waits until the next window)  
* Welcome email time: 9:30 AM IST on the joining day  
* Name match score needed: 85 out of 100  
* 30-60-90 surveys go to: levels L1 to L6 only

## **9\. Database tables**

* **people:** name, personal email, work email, role (candidate, employee, stakeholder, manager), category (campus or lateral), level, location, employee ID, manager, joining date, status  
* **cases:** type (onboarding, exit, induction, feedback), person, current stage, status, flags, who created it, dates  
* **checklist_items:** case, document type, mandatory or not, status (pending, received, verified, unreadable, wrong type, name mismatch), linked attachment, notes  
* **tasks:** case, owner's email, owner's role, task type, status, partial-progress notes, dates  
* **emails:** Graph message ID (must be unique), thread ID, incoming or outgoing, from, to, subject, time received, linked case, category, confidence, processed or not  
* **attachments:** email, file name, storage location (encrypted), document type guess, OCR quality score, name match score  
* **scheduled_jobs:** what to send, case, task, when to run, attempt number, max attempts, status, duplicate-check key (must be unique)  
* **approvals:** case, type (reply or induction schedule), the draft, status, who approved or rejected it, when  
* **reminder_rules:** name, where the data comes from, who to send to, template, schedule, follow-up gap, max rounds, who to escalate to  
* **survey_responses:** person, milestone (30, 60 or 90), link to the response, score, flagged or not  
* **complaints** (restricted access): when received, sender, linked employee, content  
* **templates, settings, holidays**  
* **action_log:** time, who or what did it (agent or a user), what was done, case, details. **Never store document content or personal data in this log.**

## **10\. How each use case works**

### **UC-DOC: New-joiner document check**

**Starts when:** HR creates a new joiner on the dashboard, entering name, personal email, recruiter's email, campus or lateral, location, level, joining date and manager.

**Steps:**

1. Create an onboarding case. Build the document checklist from the template for that category and location.  
2. Automatically send the document request email: to the recruiter, with the candidate and onboarding team in CC.  
3. Documents come back, often across several emails and sometimes as zip files. Each one goes through the document check described in Section 11.  
4. Update the checklist after every document.  
5. **Follow-ups:** while anything is missing, send a reminder every 48 hours, up to 3 times.  
   * Reminder 1 goes to the recruiter.  
   * Reminders 2 and 3 go to the recruiter and the candidate.  
   * The onboarding team is in CC on all of them.  
   * Each reminder lists exactly which documents are missing or unclear.  
   * If nothing has changed since the last reminder, don't send the same email again.  
6. If documents are still missing after 3 reminders, email recruitment and onboarding saying this is a likely dropout, flag the case on the dashboard, and stop chasing.  
7. Once every mandatory document is verified and belongs to the right person, mark the case "Ready for sign-off" on the dashboard.  
8. HR checks it, signs off and enters the Employee ID. This starts UC-IT.

**Special situations:**

* If a document's name doesn't match the candidate, never reject it automatically. Flag it for HR.  
* If the same document is sent twice, keep the latest one and keep the history.  
* If documents come from an unknown sender but clearly name a candidate, attach them to that candidate's case with a "sender not recognised" flag.

### **UC-IT: IT setup and onboarding group intimation**

**Starts when:** HR signs off "ready to onboard" and enters the Employee ID.

**Steps:**

1. Automatically send the IT request (using HR's template) with the joiner's details. Personal details only, no salary.  
2. Open an IT task. Follow up every 48 hours, up to 3 times, then escalate to the onboarding HR person.  
3. When IT replies:  
   * Pull the work email ID out of the reply using simple pattern matching in your code. No AI needed for this.  
   * Use the AI (on masked text) only to confirm that IT is saying the email ID and D365 access have been created.  
4. Save the work email to the joiner's record and close the IT task.  
   * If IT has done only part of it (email done, D365 pending), keep the task open and follow up only on what's left.  
5. **The agent does not send login credentials to the candidate,** because they contain a password. Instead, create a task on the dashboard for HR: "Send credentials to candidate".  
6. Automatically send the onboarding group email (template, to the group address) letting everyone know the person is joining. Send it once; no follow-up or tracking needed.

### **UC-EXIT: Exit clearance**

**Starts when:** HR creates an exit case on the dashboard (employee name, last working day). Once we have D365 access, it will also start automatically from the termination date in D365.

**Steps:**

1. Create a clearance task each for IT, Finance, Admin and the Manager (based on HR's offboarding checklist).  
2. Automatically email each of them, telling them what they need to clear and pointing them to their task in D365.  
3. Follow up until each one is done: every 24 hours for Finance (they are usually the slowest), every 48 hours for everyone else. After 3 reminders, escalate to HR.  
4. **How we know a clearance is done:**  
   * Once we have D365 access: check the D365 checklist every 15 minutes.  
   * Until then: from their email reply, or from HR marking it done on the dashboard.  
5. If someone replies saying it's blocked (for example, the laptop is damaged), mark that task as blocked, inform HR, and stop chasing that person.  
6. When everything is cleared, automatically email HR: "All clearances are complete. The relieving/experience letter can now be issued." (Generating the letter itself is not part of this build.)

### **UC-REM: Recurring reminders**

**How it works:**

* Every reminder type is set up as a **rule** in the database. No reminder logic is hard-coded.  
* Each rule says: where to get the data from, how to find who hasn't done the task, who to email, which template to use, how often, how many follow-ups, and who to escalate to.  
* This part is all fixed rules. The only AI use is reading replies.

**First rules to set up (HR's priorities):**

* **Appraisals:** when an employee submits the appraisal form, remind the manager (feedback due in about 3-4 days), then the reviewer, then the employee for final sign-off. Let the performance team know at each stage. Exact deadlines will come from the performance team.  
* **Leave approvals** waiting with a manager  
* **Timesheets** not filled in  
* **Training** reminders (the list will come from the training team)

**Where the data comes from:**

* Once we have D365 access: D365.  
* Until then: HR uploads an Excel or CSV list of pending people on the dashboard, or you use test data.

**When someone replies to a reminder:**

* "Done": mark the task done (and double-check it against the data source on the next check).  
* A question: the AI drafts a reply and it goes to HR for approval.

### **UC-FB: 30-60-90 day feedback**

**Starts when:** the scheduler runs every day at 9:00 AM IST.

**Steps:**

1. For every active employee at levels L1 to L6, check whether today is exactly 30, 60 or 90 days after their joining date. "Active" means there is no exit case for them.  
2. If yes, automatically send the feedback survey email with the right Microsoft Forms link (campus and lateral hires get different forms).  
3. If they haven't responded after 3 days, send a reminder, up to 2 times.  
4. Read the responses from the Excel file linked to the form, through Graph. (Microsoft Forms has no official API for responses, so confirm this approach in R\&D.)  
5. If someone's score is below HR's threshold, email the HR owner an alert.  
6. Once a month (adjustable): combine all responses, mask them, and ask the AI to write a leadership-style report covering themes, what's working, what's not, and suggested actions. Email it to HR as a PDF.

### **UC-IND: Induction and welcome email**

**Starts when:** UC-IT is complete and the joining date is known, or HR clicks "Plan induction" on the dashboard.

**Steps:**

1. The AI builds a draft induction schedule from the template for that employee category, skipping weekends and holidays:  
   * Campus hires: about one week  
   * Mid-level hires: shorter  
   * Senior hires (director and above): standard sessions only; HR adds leadership sessions manually  
2. The draft goes to HR for approval. HR can edit it and add sessions.  
3. Once approved, automatically email each session owner and the manager asking if the proposed time works.  
4. When they reply, the AI reads the time they agreed to (or their suggested alternative). Check their calendar is free, then send the calendar invite to them and the joiner.  
5. If someone doesn't reply in 3 days, follow up, up to 2 times, then flag it to HR.  
6. **Welcome email:** schedule it to go out at 9:30 AM IST on the joining day. It includes:  
   * the final induction schedule  
   * the manager's name  
   * the appointment letter PDF, which HR uploads on the dashboard. The agent only attaches it and never reads it, because it contains salary.  
   * the Statement of Understanding PDF (a fixed file)  
7. If HR hasn't uploaded the appointment letter by the day before joining, remind HR.

### **UC-CMP: Complaint capture**

**Steps:**

1. When an email is classified as a complaint, store it in the restricted complaints table. Link it to the employee if we know who sent it.  
2. Never reply to it, and never show it on normal case timelines.  
3. Send the designated HR person a neutral alert: "There is a new item in the restricted queue." **Do not include any of the complaint content in this alert.**  
4. A separate sentiment-analysis module (built later) will read these complaints, along with exit interviews and HR Connect transcripts that HR uploads on the dashboard.

## **11\. How the document check works (important)**

**The key idea:** checking *whether a document belongs to the right person* and checking *what type of document it is* are two separate jobs, done in two different places.

* The **person check** needs the name, date of birth and PAN, which is personal data. So it is done **only in our own code, on our own server.** The AI never sees it.  
* The **document type check** (is this a PAN card, a degree certificate, a relieving letter?) doesn't need personal details. So we **mask the personal data first** and then let the AI look at the rest.

**Steps for every attachment:**

1. **Save it** safely in encrypted storage on our server. If it's a zip file, unzip it first. Link it to the candidate's case.  
2. **Pull out the text:**  
   * Normal PDFs: PyMuPDF  
   * Word files: python-docx  
   * Scanned documents and photos (most IDs arrive like this): OCR with Tesseract or EasyOCR  
3. **Check it's readable.** If very little text comes out, or the OCR quality score is low, mark it **unreadable**. The next reminder will ask the candidate for a clearer copy.  
4. **Check it belongs to the right person (in our code only, no AI):**  
   * Pick out the name, date of birth and PAN number using pattern matching and a local name extractor.  
   * Compare them with the joiner's details in our database, using fuzzy matching so small differences ("Rahul K. Sharma" vs "Rahul Kumar Sharma") still match. A score of 85 or more counts as a match.  
   * The result is one of three: **match**, **mismatch**, or **not found**.  
5. **Mask the personal data:** run Presidio to hide names, PAN, Aadhaar, phone numbers, emails, addresses and dates of birth.  
6. **Ask the AI what document this is,** sending only the masked text:  
   * The AI compares it against the checklist and says which document type it is, how confident it is, and any obvious problems.  
   * If it is less than 80% confident, leave it as "received" for HR to look at.  
7. **Update the checklist:**  
   * Mark it **verified** only if the document type is correct **and** the person check came back as a match.  
   * If the person check came back as a mismatch, flag it as **name mismatch** for HR. Never reject it automatically.  
8. **Never store full Aadhaar numbers** anywhere: not in the database, not in the logs.  
9. Later (not in this build): cross-check previous employers on the CV against the relieving letters.

**Before using real candidate documents:** HR has put "the system reads document content" on hold until security approves it. Build and test everything with **test documents only** until we confirm approval.

## **12\. Follow-up rules (apply to every use case)**

* Every time we send a request, add a row to scheduled\_jobs saying when to follow up and which attempt this is.  
* If a reply completes the task, cancel any follow-ups still waiting.  
* **Always re-check the current status right before sending a follow-up.** The task may already be done.  
* Use the duplicate-check key (case \+ task \+ template \+ attempt number) so the same email is never sent twice.  
* Respect the daily limit per person and the sending hours.  
* After the maximum number of follow-ups, escalate once and then stop.

## **13\. Safety checks**

* Never reply to automated emails (this prevents endless email loops between systems).  
* Retry any failed call to Graph, the AI model or D365, waiting a little longer each time. If it keeps failing, log it and show it on the dashboard.  
* Reply inside the same email thread (use the Graph reply function) so conversations stay together.  
* Never write document content or personal data into logs.  
* The kill switch must stop all sending within 1 minute.  
* Dry-run mode sends every email to a test inbox only.  
* Three access levels on the dashboard: HR admin, HR viewer, and a separate restricted role for complaints.

## **14\. Dashboard screens needed**

1. **Joiners:** list of joiners and a "Create joiner" form  
2. **Case details:** document checklist, documents received, timeline of emails and actions, tasks, flags, and the sign-off button  
3. **Approval queue:** AI-drafted emails and induction schedules, with approve, edit and reject buttons  
4. **Exits:** list of exits, a "Create exit" form, and the clearance status for each team  
5. **Reminders:** list of reminder rules and an upload button for pending-people lists  
6. **Restricted area:** complaints (visible only to the restricted role)  
7. **Admin:** templates, settings, holiday list, kill switch, dry-run switch, and the action log

## **15\. Things still coming from HR (use placeholders until they arrive)**

* Document checklist (campus, lateral, US)  
* IT request email template  
* Onboarding group email address and template  
* Reminder email templates  
* Induction agendas for each employee category  
* 30-60-90 survey questions and the low-score threshold  
* Offboarding checklist  
* Appraisal stage deadlines  
* Training reminder list  
* D365 API access  
* Security approval for reading document content

## **16\. Build order**

**Step 1: Core setup**

* Build: mail listener, junk filter, event queue, database, router (thread and sender matching), templates, sending with duplicate protection, action log, kill switch, dry-run mode.  
* Done when: a test email is received, linked to the right case and logged, and a template reply is sent exactly once, in the same thread.

**Step 2: Scheduler and follow-ups**

* Build: scheduled jobs, the follow-up rules, sending hours, daily limits.  
* Done when: follow-ups go out on time, stop when a reply arrives, and are never sent twice.

**Step 3: UC-DOC and UC-IT**

* Build: create joiner, the full document check (Section 11), reminders, dropout flag, sign-off, IT request, reading IT's reply, onboarding group email.  
* Done when: one test joiner goes all the way from creation to the onboarding group email.

**Step 4: AI classifier and approvals**

* Build: email classifier, AI-drafted replies, approval queue, complaint capture.  
* Done when: a set of test emails all land in the right category, and complaints never get a reply.

**Step 5: UC-FB**

* Build: daily check, survey emails, reminders, low-score alerts, monthly report.  
* Done when: test joiners receive surveys on day 30, 60 and 90, and the report is generated.

**Step 6: UC-IND**

* Build: schedule draft, HR approval, availability emails, calendar booking, welcome email.  
* Done when: a test joiner gets calendar invites and the 9:30 AM welcome email with attachments.

**Step 7: UC-EXIT and UC-REM**

* Build: clearance flow and reminder rules using test data first; switch to D365 once access arrives.  
* Done when: a test exit is chased until everything is cleared and HR is notified, and reminder rules run from the database settings.

## **17\. When the whole build counts as done**

* Every use case runs from start to finish in dry-run mode on the test mailbox, using test data.  
* Every action shows up in the action log.  
* No personal data appears in any request sent to the AI model (check the request logs to confirm).  
* The kill switch stops all sending within 1 minute.

---

