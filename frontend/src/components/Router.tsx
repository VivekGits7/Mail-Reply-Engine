import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { RequireAdmin, RequireAuth, RequireComplaintsAccess } from '@/components/auth/RequireAuth';
import Layout from '@/layouts/Layout';

const LoginPage = lazy(() => import('@/components/auth/LoginPage'));
const Overview = lazy(() => import('@/components/overview/Overview'));
const Joiners = lazy(() => import('@/components/joiners/Joiners'));
const Exits = lazy(() => import('@/components/exits/Exits'));
const CaseDetail = lazy(() => import('@/components/cases/CaseDetail'));
const Approvals = lazy(() => import('@/components/approvals/Approvals'));
const ApprovalDetail = lazy(() => import('@/components/approvals/ApprovalDetail'));
const Reminders = lazy(() => import('@/components/reminders/Reminders'));
const ReminderRule = lazy(() => import('@/components/reminders/ReminderRule'));
const Feedback = lazy(() => import('@/components/feedback/Feedback'));
const Complaints = lazy(() => import('@/components/complaints/Complaints'));
const Controls = lazy(() => import('@/components/admin/Controls'));
const Settings = lazy(() => import('@/components/admin/Settings'));
const Templates = lazy(() => import('@/components/admin/Templates'));
const TemplateEditor = lazy(() => import('@/components/admin/TemplateEditor'));
const Checklists = lazy(() => import('@/components/admin/Checklists'));
const InductionTemplates = lazy(() => import('@/components/admin/InductionTemplates'));
const Holidays = lazy(() => import('@/components/admin/Holidays'));
const ActionLog = lazy(() => import('@/components/admin/ActionLog'));
const Failures = lazy(() => import('@/components/admin/Failures'));
const Users = lazy(() => import('@/components/admin/Users'));
const NoMatch = lazy(() => import('@/components/error/NoMatch'));

function RouteFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center" aria-busy="true" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
    </div>
  );
}

export default function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
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
