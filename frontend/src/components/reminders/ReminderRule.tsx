import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileUp, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { BlockSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { FilePicker } from '@/components/upload/FilePicker';
import { useFileUpload } from '@/hooks/useFileUpload';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { DATA_SOURCE_LABELS } from '@/utils/labels';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate, formatRelative } from '@/utils/utility';
import { TaskStatus, type RuleTaskSortBy, type SortOrder, type UploadListData } from '@/types';
import { ReminderRuleForm } from './ReminderRuleForm';
import { reminderKeys, remindersApi, ruleListQuery, ruleTasksQuery } from './Remindersapi';

export default function ReminderRule() {
  const { ruleId = '' } = useParams();
  const { get, set, page } = useUrlState();
  const isAdmin = useAppSelector(selectIsAdmin);
  const rules = useQuery(ruleListQuery({}));
  const rule = rules.data?.find((item) => item.reminder_rule_id === ruleId);
  const params = {
    ...page,
    search: get('search'),
    status: get('status') as TaskStatus | undefined,
    sort_by: (get('sort_by') ?? 'created_at') as RuleTaskSortBy,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const tasks = useQuery({ ...ruleTasksQuery(ruleId, params), enabled: Boolean(rule) });
  if (rules.isPending) return <BlockSkeleton />;
  if (rules.isError) return <ErrorState error={rules.error} onRetry={() => rules.refetch()} />;
  if (!rule)
    return (
      <EmptyState
        title="Rule not found"
        action={
          <Button asChild variant="outline">
            <Link to="/reminders">Back to reminders</Link>
          </Button>
        }
      />
    );
  return (
    <section>
      <Link
        to="/reminders"
        className="mb-4 inline-flex h-9 items-center gap-1.5 pill px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Reminders
      </Link>
      <PageHeader
        title={rule.name}
        description={`Source ${DATA_SOURCE_LABELS[rule.data_source]} · Runs ${rule.schedule_cron} IST · ${rule.open_tasks} open tasks`}
        actions={
          isAdmin && (
            <>
              <ReminderRuleForm
                rule={rule}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" /> Edit
                  </Button>
                }
              />
              {rule.data_source === 'upload' && <ImportList ruleId={ruleId} />}
            </>
          )
        }
      />
      <div className="mb-6 grid gap-3 panel p-5 text-sm sm:grid-cols-3 sm:p-6">
        <div>
          <span className="text-muted-foreground">Recipient column</span>
          <p className="mt-1 font-mono">{rule.recipient_field}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Next run</span>
          <p className="mt-1">{formatDate(rule.next_run_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Required columns</span>
          <p className="mt-1">{rule.required_columns.join(', ')}</p>
        </div>
      </div>
      <h2 className="mb-3 text-xl font-normal tracking-[-0.02em]">Recipients</h2>
      <FilterBar>
        <SearchInput label="Search recipients" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="Status"
          value={params.status}
          options={Object.values(TaskStatus).map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
          onChange={(status) => set({ status })}
        />
        <SortSelect
          options={[
            { label: 'Recently created', sort_by: 'created_at', sort_order: 'latest' },
            { label: 'Due soonest', sort_by: 'due_at', sort_order: 'a_to_z' },
          ]}
          sortBy={params.sort_by}
          sortOrder={params.sort_order}
          onChange={(sort_by, sort_order) => set({ sort_by, sort_order })}
        />
      </FilterBar>
      {tasks.isPending ? (
        <TableSkeleton />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : !tasks.data.data.length ? (
        <EmptyState
          title="No recipients match"
          description="Import a list or change the filters to see tasks."
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-ups</TableHead>
                  <TableHead>Next follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.data.data.map((task) => (
                  <TableRow key={task.task_id}>
                    <TableCell>{task.owner_email ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge value={task.status} />
                    </TableCell>
                    <TableCell>{task.followups_sent}</TableCell>
                    <TableCell>{formatRelative(task.next_followup_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={tasks.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}

function ImportList({ ruleId }: { ruleId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadListData | null>(null);
  const cache = useQueryClient();
  const fileUpload = useFileUpload('reminder_list');
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a CSV or XLSX file');
      return (await remindersApi.uploadList(ruleId, await fileUpload.mutateAsync(file))).data;
    },
    onSuccess: (data) => {
      setResult(data);
      cache.invalidateQueries({ queryKey: reminderKeys.all });
      showToast.success('List imported');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFile(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <FileUp className="size-4" /> Import list
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import reminder list</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file with the required columns for this rule.
          </DialogDescription>
        </DialogHeader>
        <FilePicker purpose="reminder_list" file={file} onChange={setFile} uploading={upload.isPending} />
        {result && (
          <div className="panel-inset p-4 text-sm">
            <p>
              {result.rows_valid} of {result.rows_total} rows accepted · {result.tasks_created} tasks created
            </p>
            {result.rows_invalid.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-auto text-destructive">
                {result.rows_invalid.map((row) => (
                  <li key={row.row}>
                    Row {row.row}: {row.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
            {upload.isPending ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
