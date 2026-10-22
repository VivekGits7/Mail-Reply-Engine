import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Plus } from 'lucide-react';
import { OpenFileButton } from '@/components/cases/OpenFileButton';
import { Link } from 'react-router';
import { DateRange } from '@/components/common/DateRange';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate } from '@/utils/utility';
import { HireCategory, ReportStatus, SurveyStatus, type SortOrder, type SurveySortBy, type SurveyStatus as SurveyStatusType } from '@/types';
import { feedbackApi, feedbackKeys, reportListQuery, surveyListQuery } from './Feedbackapi';

export default function Feedback() {
  const { get, set, page } = useUrlState();
  const isAdmin = useAppSelector(selectIsAdmin);
  const tab = get('tab') === 'reports' ? 'reports' : 'surveys';
  const params = {
    ...page,
    search: get('search'),
    status: get('status') as SurveyStatusType | undefined,
    milestone: get('milestone') ? Number(get('milestone')) : undefined,
    flagged: get('flagged') === 'true' ? true : undefined,
    form_variant: get('form_variant') as HireCategory | undefined,
    sort_by: (get('sort_by') ?? 'sent_at') as SurveySortBy,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const reportParams = { status: get('report_status') as ReportStatus | undefined, sort_order: (get('report_order') ?? 'latest') as SortOrder };
  const surveys = useQuery({ ...surveyListQuery(params), enabled: tab === 'surveys' });
  const reports = useQuery({ ...reportListQuery(reportParams), enabled: tab === 'reports' });
  return (
    <section>
      <PageHeader
        title="Feedback"
        description="Track joiner surveys and review the reports sent to HR."
        actions={
          isAdmin && (
            <>
              <UploadResponses />
              <CreateReport />
            </>
          )
        }
      />
      <Tabs value={tab} onValueChange={(value) => set({ tab: value === 'surveys' ? undefined : value })}>
        <TabsList>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="surveys" className="mt-5">
          <FilterBar>
            <SearchInput label="Search people" value={params.search} onSearch={(search) => set({ search })} />
            <FilterSelect
              label="Status"
              value={params.status}
              options={Object.values(SurveyStatus).map((value) => ({
                value,
                label: value.replace('_', ' '),
              }))}
              onChange={(status) => set({ status })}
            />
            <FilterSelect
              label="Milestone"
              value={get('milestone')}
              options={[30, 60, 90].map((value) => ({ value: String(value), label: `Day ${value}` }))}
              onChange={(milestone) => set({ milestone })}
            />
            <FilterSelect
              label="Form"
              value={params.form_variant}
              options={Object.values(HireCategory).map((value) => ({ value, label: value }))}
              onChange={(form_variant) => set({ form_variant })}
            />
            <FilterSelect
              label="Flag"
              value={get('flagged')}
              options={[{ value: 'true', label: 'Needs attention' }]}
              onChange={(flagged) => set({ flagged })}
            />
            <SortSelect options={[{ label: 'Recently sent', sort_by: 'sent_at', sort_order: 'latest' }, { label: 'Lowest score', sort_by: 'score', sort_order: 'a_to_z' }, { label: 'Name A to Z', sort_by: 'full_name', sort_order: 'a_to_z' }]} sortBy={params.sort_by} sortOrder={params.sort_order} onChange={(sort_by, sort_order) => set({ sort_by, sort_order })} />
          </FilterBar>
          {surveys.isPending ? (
            <TableSkeleton />
          ) : surveys.isError ? (
            <ErrorState error={surveys.error} onRetry={() => surveys.refetch()} />
          ) : !surveys.data.data.length ? (
            <EmptyState
              title="No surveys match"
              description="Try another filter or wait for the next survey milestone."
            />
          ) : (
            <>
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.data.data.map((item) => (
                      <TableRow key={item.survey_response_id}>
                        <TableCell>
                          <Link
                            to={`/joiners?search=${encodeURIComponent(item.full_name)}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {item.full_name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{item.form_variant}</span>
                        </TableCell>
                        <TableCell>Day {item.milestone}</TableCell>
                        <TableCell>
                          <StatusBadge value={item.flagged ? 'flagged' : item.status} />
                        </TableCell>
                        <TableCell className="tabular-nums">{item.score ?? '—'}</TableCell>
                        <TableCell>{formatDate(item.sent_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
              <Pagination
                total={surveys.data.total}
                limit={page.limit}
                offset={page.offset}
                onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="reports" className="mt-5">
          <FilterBar>
            <FilterSelect label="Status" value={reportParams.status} options={Object.values(ReportStatus).map((value) => ({ value, label: value }))} onChange={(report_status) => set({ report_status })} />
            <FilterSelect label="Order" value={reportParams.sort_order} options={[{ value: 'latest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }]} onChange={(report_order) => set({ report_order })} />
          </FilterBar>
          {reports.isPending ? (
            <TableSkeleton />
          ) : reports.isError ? (
            <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
          ) : !reports.data.length ? (
            <EmptyState
              title="No reports yet"
              description="Create a report for a date range once survey responses arrive."
            />
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Responses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>File</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.data.map((report) => (
                    <TableRow key={report.feedback_report_id}>
                      <TableCell>
                        {formatDate(report.period_start)} to {formatDate(report.period_end)}
                      </TableCell>
                      <TableCell>{report.response_count}</TableCell>
                      <TableCell>
                        <StatusBadge value={report.status} />
                      </TableCell>
                      <TableCell>{formatDate(report.sent_at)}</TableCell>
                      <TableCell>
                        {(report.status === 'ready' || report.status === 'sent') && (
                          <ReportDownload reportId={report.feedback_report_id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function UploadResponses() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [variant, setVariant] = useState<HireCategory>(HireCategory.LATERAL);
  const cache = useQueryClient();
  const fileUpload = useFileUpload('survey_export');
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose an XLSX export');
      return feedbackApi.uploadResponses(variant, await fileUpload.mutateAsync(file));
    },
    onSuccess: (result) => {
      cache.invalidateQueries({ queryKey: feedbackKeys.all });
      showToast.success(
        `${result.data.rows_matched} responses matched, ${result.data.rows_unmatched} unmatched`,
      );
      setOpen(false);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="size-4" /> Import responses
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Forms responses</DialogTitle>
          <DialogDescription>Choose the form variant that produced this Excel export.</DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          Form variant
          <NativeSelect
            value={variant}
            onChange={(event) => setVariant(event.target.value as HireCategory)}
            className="w-full"
          >
            {Object.values(HireCategory).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <FilePicker purpose="survey_export" file={file} onChange={setFile} uploading={upload.isPending} />
        <DialogFooter>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? 'Importing…' : 'Import responses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateReport() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ start: '', end: '' });
  const cache = useQueryClient();
  const create = useMutation({
    mutationFn: () => feedbackApi.createReport({ period_start: range.start, period_end: range.end }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: feedbackKeys.all });
      showToast.success('Report queued');
      setOpen(false);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Create report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create feedback report</DialogTitle>
          <DialogDescription>The report covers responses received in this date range.</DialogDescription>
        </DialogHeader>
        <DateRange
          label="Report period"
          from={range.start}
          to={range.end}
          onChange={(start, end) => setRange({ start: start ?? '', end: end ?? '' })}
        />
        <DialogFooter>
          <Button
            disabled={!range.start || !range.end || range.end < range.start || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDownload({ reportId }: { reportId: string }) {
  return <OpenFileButton getUrl={() => feedbackApi.reportUrl(reportId)} label="Download" />;
}
