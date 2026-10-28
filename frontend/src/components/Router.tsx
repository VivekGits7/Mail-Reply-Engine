import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { PAGES } from '@/components/pages';

const Layout = lazy(PAGES.layout);
const LoginPage = lazy(PAGES.login);
const Landing = lazy(PAGES.landing);
const Dashboard = lazy(PAGES.dashboard);
const CaseDetail = lazy(PAGES.caseDetail);
const ApprovalDetail = lazy(PAGES.approvalDetail);
const ReminderRule = lazy(PAGES.reminderRule);
const TemplateEditor = lazy(PAGES.templateEditor);
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
          <Route index element={<Dashboard />} />
          <Route path="cases/:caseId" element={<CaseDetail />} />
          <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
          <Route path="reminders/:ruleId" element={<ReminderRule />} />
          <Route path="admin/templates/:templateKey" element={<TemplateEditor />} />
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
