from typing import Dict, List, NamedTuple


class TemplateDefault(NamedTuple):
    name: str
    subject: str
    body_html: str
    placeholders: List[str]


GLOBAL_PLACEHOLDERS = ["company_name", "dashboard_link"]

SIGN_OFF = "<p>Warm regards,<br>HR Team, {{ company_name }}</p>"

TEMPLATE_DEFAULTS: Dict[str, TemplateDefault] = {
    "doc_request": TemplateDefault(
        "Document request",
        "Documents needed for {{ candidate_name }}, joining {{ joining_date }}",
        "<p>Hello,</p><p>Please share the documents below for {{ candidate_name }}, who joins on {{ joining_date }}.</p>"
        "{{ document_list }}<p>You can reply to this email with the files attached. Zip files are fine.</p>"
        + SIGN_OFF,
        ["candidate_name", "joining_date", "document_list"],
    ),
    "doc_reminder_recruiter": TemplateDefault(
        "Document reminder to recruiter",
        "Reminder {{ attempt }}: documents still needed for {{ candidate_name }}",
        "<p>Hello,</p><p>We are still waiting for these documents for {{ candidate_name }}:</p>{{ missing_docs }}"
        "{{ unclear_docs }}" + SIGN_OFF,
        ["candidate_name", "joining_date", "missing_docs", "unclear_docs", "attempt"],
    ),
    "doc_reminder_candidate": TemplateDefault(
        "Document reminder to recruiter and candidate",
        "Reminder {{ attempt }}: documents still needed for {{ candidate_name }}",
        "<p>Hello,</p><p>To complete onboarding before {{ joining_date }}, we still need:</p>{{ missing_docs }}"
        "{{ unclear_docs }}<p>Please reply to this email with the files.</p>"
        + SIGN_OFF,
        ["candidate_name", "joining_date", "missing_docs", "unclear_docs", "attempt"],
    ),
    "doc_dropout_alert": TemplateDefault(
        "Likely dropout alert",
        "Likely dropout: {{ candidate_name }}, joining {{ joining_date }}",
        "<p>Hello,</p><p>Documents for {{ candidate_name }} are still missing after every reminder. "
        "This may be a dropout, so the agent has stopped chasing.</p>{{ missing_docs }}"
        '<p><a href="{{ dashboard_link }}">Open the case</a></p>' + SIGN_OFF,
        ["candidate_name", "joining_date", "missing_docs"],
    ),
    "it_request": TemplateDefault(
        "IT email ID and D365 request",
        "Email ID Creation",
        "<p>Hi team,</p><p>Please create the email ID and D365 access for the new joiner below.</p>{{ onboarding_table }}"
        + SIGN_OFF,
        ["candidate_name", "joining_date", "onboarding_table"],
    ),
    "it_followup": TemplateDefault(
        "IT follow-up",
        "Reminder {{ attempt }}: Email ID Creation for {{ candidate_name }}",
        "<p>Hi team,</p><p>Gentle reminder, these items are still pending for {{ candidate_name }}:</p>{{ pending_items }}"
        + SIGN_OFF,
        ["candidate_name", "pending_items", "attempt"],
    ),
    "it_escalation": TemplateDefault(
        "IT escalation to HR",
        "IT setup still pending for {{ candidate_name }}",
        "<p>Hello,</p><p>IT has not completed these items for {{ candidate_name }} after every follow-up:</p>{{ pending_items }}"
        '<p><a href="{{ dashboard_link }}">Open the case</a></p>' + SIGN_OFF,
        ["candidate_name", "pending_items"],
    ),
    "onboarding_group_intimation": TemplateDefault(
        "Onboarding group intimation",
        "Onboarding: {{ joining_date }}",
        "<p>Hello all,</p><p>Please find the details of the new joiner below.</p>{{ onboarding_table }}"
        + SIGN_OFF,
        ["candidate_name", "joining_date", "onboarding_table"],
    ),
    "exit_intimation": TemplateDefault(
        "Exit intimation",
        "Offboarding : {{ employee_name }} {{ last_working_day }}",
        "<p>Dear All,</p><p>The separation tasks have been assigned to the respective stakeholders in ESS. "
        "Please find the details of the exiting employee below:</p>"
        "<p>Employee Name: <b>{{ employee_name }}</b><br>Employee ID: <b>{{ employee_code }}</b><br>"
        "Date of Exit: <b>{{ last_working_day }}</b></p>"
        "<p>Please complete the assigned tasks in ESS (D365) on or before the last working day. "
        "Mark Yes and Completed as Completed, No or Pending as In Progress, and Not Applicable as Cancelled.</p>"
        + SIGN_OFF,
        ["employee_name", "employee_code", "last_working_day"],
    ),
    "exit_followup": TemplateDefault(
        "Exit clearance follow-up",
        "Reminder {{ attempt }}: {{ team_name }} clearance for {{ employee_name }}",
        "<p>Hi team,</p><p>{{ team_name }} clearance for {{ employee_name }} ({{ employee_code }}) is still pending. "
        "Last working day is {{ last_working_day }}.</p>{{ pending_items }}<p>Please update the task in ESS (D365) or reply here.</p>"
        + SIGN_OFF,
        [
            "employee_name",
            "employee_code",
            "last_working_day",
            "team_name",
            "pending_items",
            "attempt",
        ],
    ),
    "exit_escalation": TemplateDefault(
        "Exit clearance escalation",
        "{{ team_name }} clearance still pending for {{ employee_name }}",
        "<p>Hello,</p><p>{{ team_name }} has not cleared {{ employee_name }} ({{ employee_code }}) after every follow-up.</p>"
        '{{ pending_items }}<p><a href="{{ dashboard_link }}">Open the exit case</a></p>'
        + SIGN_OFF,
        ["employee_name", "employee_code", "team_name", "pending_items"],
    ),
    "exit_blocked_alert": TemplateDefault(
        "Exit clearance blocked",
        "{{ team_name }} clearance blocked for {{ employee_name }}",
        "<p>Hello,</p><p>{{ team_name }} reports that clearance for {{ employee_name }} ({{ employee_code }}) is blocked.</p>"
        '<p>Reason: {{ blocker }}</p><p><a href="{{ dashboard_link }}">Open the exit case</a></p>'
        + SIGN_OFF,
        ["employee_name", "employee_code", "team_name", "blocker"],
    ),
    "exit_all_cleared": TemplateDefault(
        "All exit clearances done",
        "All clearances complete: {{ employee_name }}",
        "<p>Hello,</p><p>All clearances are complete for {{ employee_name }} ({{ employee_code }}), last working day "
        "{{ last_working_day }}. The relieving and experience letter can now be issued.</p>"
        + SIGN_OFF,
        ["employee_name", "employee_code", "last_working_day"],
    ),
    "reminder_generic": TemplateDefault(
        "Generic reminder",
        "Reminder: {{ item }}",
        "<p>Hi {{ recipient_name }},</p><p>This is a reminder about: {{ item }}.</p><p>Due date: {{ due_date }}</p>"
        + SIGN_OFF,
        ["recipient_name", "item", "due_date", "attempt"],
    ),
    "reminder_timesheet": TemplateDefault(
        "Timesheet reminder",
        "Reminder: please fill your timesheet",
        "<p>Hi {{ recipient_name }},</p><p>Your timesheet for {{ item }} is not filled yet. Please complete it by {{ due_date }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "item", "due_date", "attempt"],
    ),
    "reminder_leave_approval": TemplateDefault(
        "Leave approval reminder",
        "Reminder: leave requests waiting for your approval",
        "<p>Hi {{ recipient_name }},</p><p>A leave request from {{ employee_name }} is waiting for your approval: {{ item }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "employee_name", "item", "due_date", "attempt"],
    ),
    "reminder_training": TemplateDefault(
        "Training reminder",
        "Reminder: training due",
        "<p>Hi {{ recipient_name }},</p><p>Please complete the training {{ item }} by {{ due_date }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "item", "due_date", "attempt"],
    ),
    "appraisal_manager": TemplateDefault(
        "Appraisal manager reminder",
        "Appraisal feedback due for {{ employee_name }}",
        "<p>Hi {{ recipient_name }},</p><p>{{ employee_name }} has submitted the appraisal form. Please share your feedback by {{ due_date }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "employee_name", "item", "due_date", "attempt"],
    ),
    "appraisal_reviewer": TemplateDefault(
        "Appraisal reviewer reminder",
        "Appraisal review due for {{ employee_name }}",
        "<p>Hi {{ recipient_name }},</p><p>The appraisal of {{ employee_name }} is ready for your review. Please complete it by {{ due_date }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "employee_name", "item", "due_date", "attempt"],
    ),
    "appraisal_employee": TemplateDefault(
        "Appraisal sign-off reminder",
        "Please sign off your appraisal",
        "<p>Hi {{ recipient_name }},</p><p>Your appraisal is ready for your final sign-off. Please complete it by {{ due_date }}.</p>"
        + SIGN_OFF,
        ["recipient_name", "employee_name", "item", "due_date", "attempt"],
    ),
    "appraisal_performance_update": TemplateDefault(
        "Appraisal stage update",
        "Appraisal update: {{ employee_name }} at {{ stage }}",
        "<p>Hello,</p><p>The appraisal of {{ employee_name }} has moved to {{ stage }}.</p>"
        + SIGN_OFF,
        ["employee_name", "stage"],
    ),
    "reminder_escalation": TemplateDefault(
        "Reminder escalation",
        "Still pending: {{ rule_name }} for {{ recipient_name }}",
        "<p>Hello,</p><p>{{ recipient_name }} has not completed {{ item }} after every reminder.</p>"
        '<p><a href="{{ dashboard_link }}">Open reminders</a></p>' + SIGN_OFF,
        ["rule_name", "recipient_name", "item"],
    ),
    "survey_invite": TemplateDefault(
        "Feedback survey invite",
        "How are your first {{ milestone }} days going?",
        "<p>Hi {{ employee_name }},</p><p>You have completed {{ milestone }} days with us. We would love your feedback.</p>"
        '<p><a href="{{ form_link }}">Take the short survey</a></p>' + SIGN_OFF,
        ["employee_name", "milestone", "form_link"],
    ),
    "survey_reminder": TemplateDefault(
        "Feedback survey reminder",
        "Reminder: your {{ milestone }} day feedback",
        "<p>Hi {{ employee_name }},</p><p>A quick reminder to share your {{ milestone }} day feedback.</p>"
        '<p><a href="{{ form_link }}">Take the short survey</a></p>' + SIGN_OFF,
        ["employee_name", "milestone", "form_link", "attempt"],
    ),
    "low_score_alert": TemplateDefault(
        "Low survey score alert",
        "Low {{ milestone }} day feedback score: {{ employee_name }}",
        "<p>Hello,</p><p>{{ employee_name }} gave a score of {{ score }} in the {{ milestone }} day survey.</p>"
        '<p><a href="{{ dashboard_link }}">Open feedback</a></p>' + SIGN_OFF,
        ["employee_name", "milestone", "score"],
    ),
    "feedback_report": TemplateDefault(
        "Monthly feedback report",
        "30-60-90 feedback report: {{ period_label }}",
        "<p>Hello,</p><p>The feedback report for {{ period_label }} is attached. It covers {{ response_count }} responses.</p>"
        + SIGN_OFF,
        ["period_label", "response_count"],
    ),
    "induction_availability_request": TemplateDefault(
        "Induction availability request",
        "Induction session for {{ joiner_name }}: {{ session_title }}",
        "<p>Hello,</p><p>We would like to schedule <b>{{ session_title }}</b> for new joiner {{ joiner_name }} on "
        "<b>{{ proposed_time }}</b> for {{ duration }} minutes.</p><p>Please reply to confirm, or suggest another time.</p>"
        + SIGN_OFF,
        ["session_title", "proposed_time", "duration", "joiner_name"],
    ),
    "induction_followup": TemplateDefault(
        "Induction availability follow-up",
        "Reminder {{ attempt }}: induction session {{ session_title }}",
        "<p>Hello,</p><p>Could you confirm if <b>{{ proposed_time }}</b> works for {{ session_title }} with {{ joiner_name }}?</p>"
        + SIGN_OFF,
        ["session_title", "proposed_time", "joiner_name", "attempt"],
    ),
    "induction_no_reply_alert": TemplateDefault(
        "Induction no reply alert",
        "No reply for induction session {{ session_title }}",
        "<p>Hello,</p><p>The owner of {{ session_title }} for {{ joiner_name }} has not replied after every follow-up.</p>"
        '<p><a href="{{ dashboard_link }}">Book it by hand</a></p>' + SIGN_OFF,
        ["session_title", "joiner_name"],
    ),
    "induction_calendar_invite": TemplateDefault(
        "Induction calendar invite",
        "Induction: {{ session_title }}",
        "<p>Induction session {{ session_title }} for new joiner {{ joiner_name }}.</p>",
        ["session_title", "joiner_name"],
    ),
    "welcome_email": TemplateDefault(
        "Welcome email",
        "Welcome to {{ company_name }}, {{ joiner_name }}",
        "<p>Hi {{ joiner_name }},</p><p>Welcome to {{ company_name }}! Your manager is {{ manager_name }}.</p>"
        "<p>Here is your induction schedule:</p>{{ schedule_table }}"
        "<p>Your appointment letter and the Statement of Understanding are attached.</p>"
        + SIGN_OFF,
        ["joiner_name", "joining_date", "manager_name", "schedule_table"],
    ),
    "appointment_letter_missing": TemplateDefault(
        "Appointment letter missing",
        "Appointment letter missing for {{ joiner_name }}, joining {{ joining_date }}",
        "<p>Hello,</p><p>The appointment letter for {{ joiner_name }} is not uploaded yet and the welcome email goes out "
        'on {{ joining_date }}.</p><p><a href="{{ dashboard_link }}">Upload it here</a></p>'
        + SIGN_OFF,
        ["joiner_name", "joining_date"],
    ),
    "complaint_alert": TemplateDefault(
        "Restricted queue alert",
        "New item in the restricted queue",
        '<p>Hello,</p><p>There is a new item in the restricted queue.</p><p><a href="{{ dashboard_link }}">Open the restricted area</a></p>'
        + SIGN_OFF,
        [],
    ),
}
