export const PAGES = {
  layout: () => import('@/layouts/Layout'),
  login: () => import('@/components/auth/LoginPage'),
  landing: () => import('@/components/landing/Landing'),
  dashboard: () => import('@/components/dashboard/Dashboard'),
  overview: () => import('@/components/overview/Overview'),
  joiners: () => import('@/components/joiners/Joiners'),
  exits: () => import('@/components/exits/Exits'),
  caseDetail: () => import('@/components/cases/CaseDetail'),
  approvals: () => import('@/components/approvals/Approvals'),
  approvalDetail: () => import('@/components/approvals/ApprovalDetail'),
  reminders: () => import('@/components/reminders/Reminders'),
  reminderRule: () => import('@/components/reminders/ReminderRule'),
  feedback: () => import('@/components/feedback/Feedback'),
  complaints: () => import('@/components/complaints/Complaints'),
  controls: () => import('@/components/admin/Controls'),
  settings: () => import('@/components/admin/Settings'),
  templates: () => import('@/components/admin/Templates'),
  templateEditor: () => import('@/components/admin/TemplateEditor'),
  checklists: () => import('@/components/admin/Checklists'),
  inductionTemplates: () => import('@/components/admin/InductionTemplates'),
  holidays: () => import('@/components/admin/Holidays'),
  actionLog: () => import('@/components/admin/ActionLog'),
  failures: () => import('@/components/admin/Failures'),
  users: () => import('@/components/admin/Users'),
  noMatch: () => import('@/components/error/NoMatch'),
};

interface NetworkInfo {
  saveData?: boolean;
  effectiveType?: string;
}

// Skip warming every page on data saver or a slow link, where it would compete with the page in view.
function onSlowNetwork() {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  return Boolean(connection?.saveData || /(^|-)2g|3g/.test(connection?.effectiveType ?? ''));
}

export function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 4000 });
  else setTimeout(task, 1200);
}

export function preloadPages(names: (keyof typeof PAGES)[] = Object.keys(PAGES) as (keyof typeof PAGES)[]) {
  if (onSlowNetwork()) return;
  for (const name of names) void PAGES[name]().catch(() => undefined);
}
