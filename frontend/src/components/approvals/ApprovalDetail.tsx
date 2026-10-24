import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { caseKeys } from '@/components/cases/Casesapi';
import { Field } from '@/components/common/Field';
import { BlockSkeleton, ErrorState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import {
  formatDateTime,
  formatRelative,
  fromLocalDateTimeInput,
  humanize,
  toLocalDateTimeInput,
} from '@/utils/utility';
import type { ApprovalDetail as Approval, ApprovalDraft, DraftSession } from '@/types';
import { approvalDetailQuery, approvalKeys, approvalsApi } from './Approvalsapi';
import { Avatar } from '@/components/visual/Avatar';
import { DateTimeField } from '@/components/common/DateField';
import { SchedulePreview } from './SchedulePreview';

export default function ApprovalDetail() {
  const { approvalId = '' } = useParams();
  const approval = useQuery(approvalDetailQuery(approvalId));

  if (approval.isPending) return <BlockSkeleton />;
  if (approval.isError) return <ErrorState error={approval.error} onRetry={() => approval.refetch()} />;
  return <ApprovalView key={approval.data.approval_id} approval={approval.data} />;
}

interface EditableSession {
  title: string;
  owner_email: string;
  start: string;
  end: string;
}

function toEditable(session: DraftSession): EditableSession {
  return { ...session, start: toLocalDateTimeInput(session.start), end: toLocalDateTimeInput(session.end) };
}

function sessionProblem(sessions: EditableSession[]): string | null {
  for (const [index, session] of sessions.entries()) {
    if (session.title.trim().length < 2) return `Session ${index + 1} needs a title`;
    if (session.owner_email.trim().length < 3) return `Session ${index + 1} needs an owner`;
    if (!session.start || !session.end || session.end <= session.start)
      return `Session ${index + 1} must end after it starts`;
  }
  return null;
}

function ApprovalView({ approval }: { approval: Approval }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isReply = approval.approval_type === 'reply';
  const editable = isAdmin && approval.status === 'pending';
  const [to, setTo] = useState((approval.draft.to ?? []).join(', '));
  const [subject, setSubject] = useState(approval.draft.subject ?? '');
  const [body, setBody] = useState(approval.draft.body ?? '');
  const [sessions, setSessions] = useState<EditableSession[]>(
    (approval.draft.sessions ?? []).map(toEditable),
  );
  const problem = isReply ? (body.trim() ? null : 'The reply needs a body') : sessionProblem(sessions);

  function currentDraft(): ApprovalDraft {
    if (isReply) {
      return {
        subject: subject.trim() || null,
        body,
        to: to
          .split(',')
          .map((address) => address.trim())
          .filter(Boolean),
      };
    }
    return {
      track: approval.draft.track,
      sessions: sessions.map((session) => ({
        title: session.title.trim(),
        owner_email: session.owner_email.trim(),
        start: fromLocalDateTimeInput(session.start),
        end: fromLocalDateTimeInput(session.end),
      })),
    };
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    if (approval.case_id) queryClient.invalidateQueries({ queryKey: caseKeys.detail(approval.case_id) });
  }

  const onError = (error: unknown) => showToast.error(getErrorMessage(error));
  const save = useMutation({
    mutationFn: () => approvalsApi.saveDraft(approval.approval_id, currentDraft()),
    onSuccess: (res) => {
      refresh();
      showToast.success(res.message);
    },
    onError,
  });
  const approve = useMutation({
    mutationFn: () => approvalsApi.approve(approval.approval_id, currentDraft()),
    onSuccess: (res) => {
      refresh();
      showToast.success(res.message);
      navigate('/approvals');
    },
    onError,
  });

  return (
    <article>
      <Link
        to="/approvals"
        className="mb-4 inline-flex h-9 items-center gap-1.5 pill px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Approvals
      </Link>
      <header className="mb-6 flex flex-col gap-4 panel p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-start gap-4">
          {approval.person_name && <Avatar name={approval.person_name} size="xl" />}
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {isReply
                ? 'Reply draft'
                : `Induction plan${approval.draft.track ? ` · ${humanize(approval.draft.track)} track` : ''}`}
            </p>
            <h1 className="mt-0.5 text-[1.9rem] leading-tight font-normal tracking-[-0.035em]">
              {approval.case_id ? (
                <Link to={`/cases/${approval.case_id}`} className="hover:text-primary hover:underline">
                  {approval.person_name ?? 'Open case'}
                </Link>
              ) : (
                (approval.person_name ?? 'Unknown sender')
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge value={approval.status} />
              <span>Drafted {formatRelative(approval.created_at)}</span>
              {approval.draft.ai_confidence != null && (
                <span className="tabular-nums">
                  · AI {Math.round(approval.draft.ai_confidence * 100)}% sure
                </span>
              )}
            </div>
          </div>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <RejectDialog approvalId={approval.approval_id} onDone={refresh} />
            <Button
              variant="outline"
              disabled={save.isPending || Boolean(problem)}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save draft'}
            </Button>
            <Button disabled={approve.isPending || Boolean(problem)} onClick={() => approve.mutate()}>
              {approve.isPending ? 'Approving…' : isReply ? 'Approve and send' : 'Approve and ask owners'}
            </Button>
          </div>
        )}
      </header>

      {approval.status === 'rejected' && approval.reject_reason && (
        <p className="mb-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
          Rejected {formatRelative(approval.decided_at)}: {approval.reject_reason}
        </p>
      )}
      {approval.draft.notes && (
        <p className="mb-4 rounded-2xl border border-info/20 bg-info/6 px-4 py-3 text-sm">
          <span className="font-medium">Note from the agent: </span>
          {approval.draft.notes}
        </p>
      )}
      {editable && problem && (
        <p role="status" className="mb-4 text-sm text-destructive">
          {problem}
        </p>
      )}

      <div className={isReply ? 'grid gap-6 lg:grid-cols-2' : undefined}>
        {isReply && (
          <section className="panel p-5 sm:p-6">
            <h2 className="text-xl font-normal tracking-[-0.02em]">What came in</h2>
            {approval.source_email ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {approval.source_email.from ?? 'Unknown sender'} ·{' '}
                  {formatDateTime(approval.source_email.received_at)}
                </p>
                <p className="mt-1 text-sm font-medium">{approval.source_email.subject}</p>
                <pre className="mt-3 max-h-[28rem] overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {approval.source_email.body}
                </pre>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">The original email is no longer stored.</p>
            )}
          </section>
        )}

        {isReply ? (
          <section className="flex flex-col gap-4 panel p-5 sm:p-6">
            <h2 className="text-xl font-normal tracking-[-0.02em]">Reply</h2>
            <Field id="draft-to" label="To" hint="Separate addresses with commas">
              <Input
                id="draft-to"
                value={to}
                disabled={!editable}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Field id="draft-subject" label="Subject">
              <Input
                id="draft-subject"
                value={subject}
                maxLength={500}
                disabled={!editable}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>
            <Field id="draft-body" label="Message">
              <Textarea
                id="draft-body"
                rows={14}
                value={body}
                maxLength={20000}
                disabled={!editable}
                onChange={(event) => setBody(event.target.value)}
              />
            </Field>
          </section>
        ) : (
          <>
            <SchedulePreview sessions={sessions} />
            <SessionsEditor sessions={sessions} onChange={setSessions} editable={editable} />
          </>
        )}
      </div>
    </article>
  );
}

interface SessionsEditorProps {
  sessions: EditableSession[];
  onChange: (sessions: EditableSession[]) => void;
  editable: boolean;
}

function SessionsEditor({ sessions, onChange, editable }: SessionsEditorProps) {
  function update(index: number, patch: Partial<EditableSession>) {
    onChange(sessions.map((session, i) => (i === index ? { ...session, ...patch } : session)));
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-normal tracking-[-0.02em]">Sessions</h2>
        {editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...sessions, { title: '', owner_email: '', start: '', end: '' }])}
          >
            <Plus aria-hidden="true" />
            Add session
          </Button>
        )}
      </div>
      <ol className="flex flex-col divide-y">
        {sessions.map((session, index) => (
          <li key={index} className="grid gap-3 py-3 sm:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto] sm:items-end">
            <Field id={`s-title-${index}`} label="Title">
              <Input
                id={`s-title-${index}`}
                value={session.title}
                disabled={!editable}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </Field>
            <Field id={`s-owner-${index}`} label="Owner">
              <Input
                id={`s-owner-${index}`}
                value={session.owner_email}
                disabled={!editable}
                onChange={(event) => update(index, { owner_email: event.target.value })}
              />
            </Field>
            <Field id={`s-start-${index}`} label="Starts">
              <DateTimeField
                id={`s-start-${index}`}
                label="Starts"
                value={session.start}
                disabled={!editable}
                onChange={(next) => update(index, { start: next })}
              />
            </Field>
            <Field id={`s-end-${index}`} label="Ends">
              <DateTimeField
                id={`s-end-${index}`}
                label="Ends"
                value={session.end}
                min={session.start}
                disabled={!editable}
                onChange={(next) => update(index, { end: next })}
              />
            </Field>
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove session ${index + 1}`}
                onClick={() => onChange(sessions.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RejectDialog({ approvalId, onDone }: { approvalId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();
  const reject = useMutation({
    mutationFn: () => approvalsApi.reject(approvalId, reason.trim()),
    onSuccess: (res) => {
      onDone();
      setOpen(false);
      showToast.success(res.message);
      navigate('/approvals');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Reject</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this draft?</DialogTitle>
          <DialogDescription>
            Nothing is sent. The case stays flagged so someone handles it by hand.
          </DialogDescription>
        </DialogHeader>
        <Field id="reject-reason" label="Reason" hint="At least 3 characters">
          <Textarea
            id="reject-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder="I will call the candidate instead"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || reject.isPending}
            onClick={() => reject.mutate()}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
