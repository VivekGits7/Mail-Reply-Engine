import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { RequireAdmin, RequireAuth, RequireComplaintsAccess } from '@/components/auth/RequireAuth';
import { PAGES } from '@/components/pages';

const Layout = lazy(PAGES.layout);
const LoginPage = lazy(PAGES.login);
const Landing = lazy(PAGES.landing);
const Overview = lazy(PAGES.overview);
const Joiners = lazy(PAGES.joiners);
const Exits = lazy(PAGES.exits);
const CaseDetail = lazy(PAGES.caseDetail);
const Approvals = lazy(PAGES.approvals);
const ApprovalDetail = lazy(PAGES.approvalDetail);
const Reminders = lazy(PAGES.reminders);
const ReminderRule = lazy(PAGES.reminderRule);
const Feedback = lazy(PAGES.feedback);
const Complaints = lazy(PAGES.complaints);
const Controls = lazy(PAGES.controls);
const Settings = lazy(PAGES.settings);
const Templates = lazy(PAGES.templates);
const TemplateEditor = lazy(PAGES.templateEditor);
const Checklists = lazy(PAGES.checklists);
const InductionTemplates = lazy(PAGES.inductionTemplates);
const Holidays = lazy(PAGES.holidays);
const ActionLog = lazy(PAGES.actionLog);
const Failures = lazy(PAGES.failures);
const Users = lazy(PAGES.users);
const NoMatch = lazy(PAGES.noMatch);

function RouteFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center" aria-busy="true" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary motion-reduce:animate-none" />
    </div>
  );
}

export default function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="welcome" element={<Landing />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="joiners" element={<Joiners />} />
          <Route path="exits" element={<Exits />} />
          <Route path="cases/:caseId" element={<CaseDetail />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="reminders/:ruleId" element={<ReminderRule />} />
          <Route path="feedback" element={<Feedback />} />
          <Route
            path="complaints"
            element={
              <RequireComplaintsAccess>
                <Complaints />
              </RequireComplaintsAccess>
            }
          />
          <Route path="admin/controls" element={<Controls />} />
          <Route path="admin/settings" element={<Settings />} />
          <Route path="admin/templates" element={<Templates />} />
          <Route path="admin/templates/:templateKey" element={<TemplateEditor />} />
          <Route path="admin/checklists" element={<Checklists />} />
          <Route path="admin/induction" element={<InductionTemplates />} />
          <Route path="admin/holidays" element={<Holidays />} />
          <Route path="admin/activity" element={<ActionLog />} />
          <Route path="admin/failures" element={<Failures />} />
          <Route
            path="admin/users"
            element={
              <RequireAdmin>
                <Users />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
