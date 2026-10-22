import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, FileSignature, FileUp, PackageCheck, Pencil, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { JoinerFormDialog } from '@/components/joiners/JoinerFormDialog';
import { BlockSkeleton, ErrorState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlState } from '@/hooks/useUrlState';
import { getErrorStatus } from '@/utils/apiError';
import { CASE_TYPE_LABELS, flagLabel } from '@/utils/labels';
import { formatDate, formatRelative, humanize } from '@/utils/utility';
import type { CaseDetailData, CaseFlag } from '@/types';
import { AppointmentLetterDialog } from './AppointmentLetterDialog';
import { CaseStatusMenu } from './CaseStatusDialog';
import { caseDetailQuery, casesApi } from './Casesapi';
import { ChecklistPanel } from './ChecklistPanel';
import { FilesPanel } from './FilesPanel';
import { PlanInductionDialog } from './PlanInductionDialog';
import { ReleaseDialog } from './ReleaseDialog';
import { SessionsPanel } from './SessionsPanel';
import { SignOffDialog } from './SignOffDialog';
import { TasksPanel } from './TasksPanel';
import { TimelinePanel } from './TimelinePanel';
import { useCaseMutation } from './useCaseMutation';

const BACK_LINKS: Record<string, { to: string; label: string }> = {
  onboarding: { to: '/joiners', label: 'Joiners' },
  induction: { to: '/joiners', label: 'Joiners' },
  exit: { to: '/exits', label: 'Exits' },
};

const SIGN_OFF_EARLY_STAGES = new Set(['docs_requested', 'docs_in_progress', 'dropout']);
const ACTIVE = new Set(['open', 'on_hold']);

export default function CaseDetail() {
  const { caseId = '' } = useParams();
  const detail = useQuery(caseDetailQuery(caseId));

  if (detail.isPending) return <BlockSkeleton />;
  if (detail.isError) {
    return getErrorStatus(detail.error) === 404 ? (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">This case does not exist</h1>
        <Button asChild variant="outline">
          <Link to="/">Back to overview</Link>
        </Button>
      </div>
    ) : (
      <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
    );
  }
  return <CaseView data={detail.data} />;
}

function CaseView({ data }: { data: CaseDetailData }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set } = useUrlState();
  const { case: caseData, person } = data;
  const back = BACK_LINKS[caseData.case_type] ?? { to: '/', label: 'Overview' };

  const tabs: { value: string; label: string; count?: number; content: ReactNode }[] = [];
  if (data.checklist.length) {
    tabs.push({
      value: 'checklist',
      label: 'Checklist',
      count: data.checklist.length,
      content: <ChecklistPanel caseId={caseData.case_id} items={data.checklist} attachments={data.attachments} />,
    });
  }
  if (data.sessions.length || caseData.case_type === 'induction') {
    tabs.push({
      value: 'sessions',
      label: 'Sessions',
      count: data.sessions.length,
      content: <SessionsPanel caseId={caseData.case_id} sessions={data.sessions} />,
    });
  }
  tabs.push(
    {
      value: 'tasks',
      label: 'Tasks',
      count: data.tasks.length,
      content: <TasksPanel caseId={caseData.case_id} tasks={data.tasks} />,
    },
    { value: 'files', label: 'Files', count: data.attachments.length, content: <FilesPanel attachments={data.attachments} /> },
    { value: 'timeline', label: 'Timeline', content: <TimelinePanel entries={data.timeline} /> },
  );
  const tab = tabs.some((item) => item.value === get('tab')) ? get('tab')! : tabs[0].value;

  return (
    <article>
      <Link
        to={back.to}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {back.label}
      </Link>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {CASE_TYPE_LABELS[caseData.case_type] ?? humanize(caseData.case_type)} case
            {caseData.track && ` · ${humanize(caseData.track)} track`}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-balance">{person.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge value={caseData.stage} />
            {caseData.status !== 'open' && <StatusBadge value={caseData.status} />}
            <CaseFlags caseId={caseData.case_id} flags={caseData.flags} canClear={isAdmin} />
          </div>
          {data.next_followup_at && ACTIVE.has(caseData.status) && (
            <p className="mt-2 text-sm text-muted-foreground">
              Next follow-up {formatRelative(data.next_followup_at)}
            </p>
          )}
        </div>
        {isAdmin && <CaseActions data={data} />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Tabs value={tab} onValueChange={(value) => set({ tab: value }, { keepPage: true })} className="min-w-0">
          <TabsList className="max-w-full overflow-x-auto">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                {item.count != null && <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((item) => (
            <TabsContent key={item.value} value={item.value} className="mt-3">
              {item.content}
            </TabsContent>
          ))}
        </Tabs>
        <CaseSidebar data={data} />
      </div>
    </article>
  );
}

function CaseFlags({ caseId, flags, canClear }: { caseId: string; flags: string[]; canClear: boolean }) {
  const clear = useCaseMutation(caseId, (flag: string) =>
    casesApi.update(caseId, { clear_flags: [flag as CaseFlag] }),
  );
  return flags.map((flag) => (
    <span
      key={flag}
      className="inline-flex h-5 items-center gap-1 rounded-sm border border-destructive/25 bg-destructive/10 pr-0.5 pl-1.5 text-xs font-medium text-destructive"
    >
      {flagLabel(flag)}
      {canClear && (
        <button
          type="button"
          className="rounded-xs p-0.5 hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`Clear flag ${flagLabel(flag)}`}
          disabled={clear.isPending}
          onClick={() => clear.mutate(flag)}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  ));
}

function CaseActions({ data }: { data: CaseDetailData }) {
  const { case: caseData, person } = data;
  const active = ACTIVE.has(caseData.status);
  const isOnboarding = caseData.case_type === 'onboarding';
  const hasInduction = data.related_cases.some((related) => related.case_type === 'induction');
  const canSignOff = active && isOnboarding && (caseData.stage === 'ready_for_signoff' || SIGN_OFF_EARLY_STAGES.has(caseData.stage));

  return (
    <div className="flex flex-wrap gap-2">
      {canSignOff && (
        <SignOffDialog
          caseId={caseData.case_id}
          early={caseData.stage !== 'ready_for_signoff'}
          trigger={
            <Button variant={caseData.stage === 'ready_for_signoff' ? 'default' : 'outline'}>
              <FileSignature aria-hidden="true" />
              {caseData.stage === 'ready_for_signoff' ? 'Sign off' : 'Sign off early'}
            </Button>
          }
        />
      )}
      {caseData.case_type === 'exit' && caseData.stage === 'all_cleared' && active && (
        <ReleaseDialog
          caseId={caseData.case_id}
          trigger={
            <Button>
              <PackageCheck aria-hidden="true" />
              Confirm release
            </Button>
          }
        />
      )}
      {isOnboarding && !hasInduction && person.joining_date && (
        <PlanInductionDialog
          caseId={caseData.case_id}
          trigger={
            <Button variant="outline">
              <CalendarPlus aria-hidden="true" />
              Plan induction
            </Button>
          }
        />
      )}
      {(isOnboarding || caseData.case_type === 'induction') && (
        <AppointmentLetterDialog
          caseId={caseData.case_id}
          trigger={
            <Button variant="outline">
              <FileUp aria-hidden="true" />
              Appointment letter
            </Button>
          }
        />
      )}
      {isOnboarding && (
        <JoinerFormDialog
          person={person}
          caseId={caseData.case_id}
          trigger={
            <Button variant="outline">
              <Pencil aria-hidden="true" />
              Edit details
            </Button>
          }
        />
      )}
      <CaseStatusMenu caseData={caseData} />
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'text-right font-mono' : 'min-w-0 truncate text-right'} title={value}>
        {value}
      </dd>
    </div>
  );
}

function CaseSidebar({ data }: { data: CaseDetailData }) {
  const { person, case: caseData } = data;
  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Details</h2>
        <dl className="divide-y">
          <Detail label="Employee ID" value={person.employee_code} mono />
          <Detail label="Designation" value={person.designation} />
          <Detail label="Level" value={person.level} />
          <Detail label="Hire type" value={person.hire_category ? humanize(person.hire_category) : null} />
          <Detail label="Location" value={person.location} />
          <Detail label="Joining" value={person.joining_date ? formatDate(person.joining_date) : null} />
          <Detail label="Personal email" value={person.personal_email} />
          <Detail label="Work email" value={person.work_email} />
          <Detail label="Manager" value={person.manager_name} />
          <Detail label="Manager email" value={person.manager_email} />
          <Detail label="Recruiter" value={person.recruiter_email} />
          <Detail label="Opened" value={formatDate(caseData.opened_at)} />
          {caseData.closed_at && <Detail label="Closed" value={formatDate(caseData.closed_at)} />}
        </dl>
      </section>
      {data.approvals.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Approvals</h2>
          <ul className="flex flex-col gap-2">
            {data.approvals.map((approval) => (
              <li key={approval.approval_id} className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/approvals/${approval.approval_id}`} className="hover:text-primary hover:underline">
                  {approval.approval_type === 'reply' ? 'Reply draft' : 'Induction plan'}
                </Link>
                <StatusBadge value={approval.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.related_cases.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Related cases</h2>
          <ul className="flex flex-col gap-2">
            {data.related_cases.map((related) => (
              <li key={related.case_id} className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/cases/${related.case_id}`} className="hover:text-primary hover:underline">
                  {CASE_TYPE_LABELS[related.case_type] ?? humanize(related.case_type)}
                </Link>
                <StatusBadge value={related.stage} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
