# HR Desk — Administrator UI Behaviour Guide

## Purpose

HR Desk is a controlled mailbox assistant for routine HR operations. It watches the **dedicated HR mailbox**, records work against a joiner or exit case, sends approved template emails, and keeps following up according to the configured rules. It does not access the main HR inbox.

This guide explains what a new HR administrator should expect from the UI and the order in which to use it. An **HR admin** can create, edit, approve, pause, retry, and configure work. Other HR users can usually view the same information but see a clear “view only” message where changes are restricted. Complaints are available only to specially authorised users.

## The daily HR workflow

1. Open **Overview** first. It shows the work needing attention: AI-written drafts, joiners ready for sign-off, exits ready for release, and failed work.
2. Open **Approvals** and review every pending item. The system never sends an AI-written reply or induction schedule until HR approves it.
3. Review **Joiners** and **Exits**. Open a person’s case to resolve document, task, or clearance exceptions.
4. Check **Failures** when the overview shows any failed work. Fix the cause first, then retry.
5. Use **Controls** to check whether sending is live, in test mode, or stopped. Use **Activity log** when you need an audit trail.

The left navigation scrolls to each area on one long dashboard. The quick links and row links open a detailed case or approval page when deeper action is needed. Every data area should show a loading state while it fetches, a helpful error with retry if it cannot load, and an empty state when no matching work exists.

## Desk: the work HR handles

| Area | What appears | What the administrator does |
| :--- | :--- | :--- |
| **Overview** | Today’s priority counts, setup checklist, recent approval requests, and active onboarding progress. | Use it as the daily starting point; select a tile or person to continue the related work. |
| **Approvals** | Reply drafts and induction-plan drafts, with status, person, summary, and creation time. | Filter by status/type, open the item, read and edit where necessary, then approve or reject it. Approval releases the intended next step; rejection keeps HR in control. |
| **Joiners** | Onboarding cases with joining date, stage, document progress, flags, and next follow-up. | Add a joiner, filter the list, or open a case. Adding a joiner creates the document checklist and starts the document-request email workflow. |
| **Exits** | Exit cases with last working day, clearance stage, pending teams, flags, and next follow-up. | Start an exit, filter the list, or open the case. The system creates and chases IT, Finance, Admin, and Manager clearance tasks. |

### Overview

- Use **Overview** to see the most important work for today.
- Check **Drafts to review** for AI-written emails waiting for HR approval.
- Check **Ready for sign-off** for joiners whose documents are complete.
- Check **Ready for release** for exits where all teams have cleared the employee.
- Check **Failed work** if an email or scheduled task did not complete.
- Click any card to open the related section.

### Approvals

- Use **Approvals** to review work that needs HR permission.
- Open a draft to read the full AI-written reply or induction plan.
- Edit it if needed.
- Click **Approve** only when it is correct.
- Click **Reject** when the draft should not be used.
- AI-written emails and induction plans do not go out without approval.

### Joiners

- Use **Joiners** to manage new employees before they join.
- Click **Add joiner** to start a new onboarding case.
- Add the joiner’s name, email, joining date, manager, location, and hire type.
- Use filters to find a joiner by name, joining date, stage, or flag.
- Open a joiner to see documents, emails, tasks, files, and case history.
- Use **Sign off and email IT** when the joiner is ready for IT setup.
- Use **Plan induction** to create an induction-plan draft for approval.

### Exits

- Use **Exits** to manage employees who are leaving.
- Click **Start exit** to create an exit case.
- Add the employee and last working day.
- Check which team is still pending: IT, Finance, Admin, or Manager.
- Open the exit case to update a task when a team confirms clearance outside email.
- Click **Confirm release and close** only after every team has cleared the exit.

## Programs: regular HR work

### Reminders

- Use **Reminders** to manage repeated reminder emails.
- Create rules for work such as leave approvals, appraisals, and timesheets.
- Check how many people are still pending for each rule.
- Pause a rule when reminders should stop.
- Activate it again when reminders should continue.

### Feedback

- Use **Feedback** to manage 30-day, 60-day, and 90-day employee surveys.
- Check whether a survey was sent, completed, or flagged.
- Import the Microsoft Forms Excel export when responses are available.
- Create a report for a selected date range.
- Download a report when its status is ready.

### Complaints

- Use **Complaints** only for confidential employee complaints.
- Only authorised HR users can access this module.
- Read complaint details and attached files when required.
- Upload an exit-interview or HR Connect transcript if needed.
- Never send an automatic reply to a complaint.
- Complaints do not appear in normal employee case timelines.

## Monitoring: check system work

### Activity log

- Use **Activity log** to see what the system and HR users did.
- Search by action, date, person, or case.
- Open the linked case when you need more details.
- Use this screen for audit checks.

### Failures

- Use **Failures** when an email, document check, or scheduled job has failed.
- Read the reason shown on the failure row.
- Fix the problem first; IT may be needed for Microsoft 365 or email-server issues.
- Click **Retry** after the problem is fixed.
- Do not retry repeatedly before fixing the cause.

## Admin: controls and setup

### Controls

- Use **Controls** to safely manage outgoing email.
- Use the **Kill switch** to stop all outgoing emails immediately.
- Use **Test mode** to send emails only to the test inbox.
- Use **Live mode** only when real recipients should receive emails.
- Check mailbox activity, queue work, failed count, D365 status, and document-reading status here.

### Settings

- Use **Settings** to change system rules.
- Set follow-up timing, sending hours, daily limits, and confidence levels.
- Update email recipients and other HR operating values.
- Check changes carefully because they affect future automated work.

### Email templates

- Use **Email templates** to create and edit regular email messages.
- Add the email subject and body.
- Use placeholders such as `{{full_name}}` for employee details.
- Preview the email before using it.
- Template emails may be sent automatically based on the configured rules.

### Checklists

- Use **Checklists** to define documents needed from new joiners.
- Create different checklists for campus/lateral hires and locations.
- Add, remove, or mark a document as required.
- The system uses this checklist when a new joiner is created.

### Induction plans

- Use **Induction plans** to create reusable induction schedules.
- Add, edit, re-order, or remove sessions.
- Approved plans are used when booking a joiner’s induction sessions.

### Holidays

- Use **Holidays** to add company or location-specific holidays.
- The system skips these dates while planning scheduled work.
- Remove a holiday only if it should no longer affect scheduling.

### Users

- Use **Users** to manage access to HR Desk.
- Add a user, change their role, reset their password, or deactivate access.
- Give complaint access only to authorised HR staff.

## Important rules

- Template emails can be sent automatically.
- AI-written emails always wait for HR approval.
- Induction plans always wait for HR approval.
- Use test mode before using live mode for a new template or setting.
- Use the kill switch immediately if something is wrong.
- Do not add salary or compensation information to the system.
- Personal data is masked before AI processing.
- Complaints are confidential and never receive an automatic reply.
