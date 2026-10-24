import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { OpenFileButton } from '@/components/cases/OpenFileButton';
import { DateRange } from '@/components/common/DateRange';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
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
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SelectField } from '@/components/common/SelectField';
import { useUrlState } from '@/hooks/useUrlState';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate, humanize } from '@/utils/utility';
import {
  ComplaintSource,
  UploadSource,
  type ComplaintSource as ComplaintSourceType,
  type ComplaintListItem,
  type SortOrder,
  type UploadSource as UploadSourceType,
} from '@/types';
import { complaintDetailQuery, complaintKeys, complaintListQuery, complaintsApi } from './Complaintsapi';

export default function Complaints() {
  const { get, set, page } = useUrlState();
  const params = {
    ...page,
    search: get('search'),
    source: get('source') as ComplaintSourceType | undefined,
    date_from: get('date_from'),
    date_to: get('date_to'),
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const list = useQuery(complaintListQuery(params));
  const selected = get('complaint');
  return (
    <section>
      <PageHeader
        title="Complaints"
        description="Restricted reports for authorised HR staff. These records never appear in case timelines."
        actions={<UploadTranscript />}
      />
      <FilterBar>
        <SearchInput label="Search complaints" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="Source"
          value={params.source}
          options={Object.values(ComplaintSource).map((value) => ({ value, label: humanize(value) }))}
          onChange={(source) => set({ source })}
        />
        <DateRange
          label="Received"
          from={params.date_from}
          to={params.date_to}
          onChange={(date_from, date_to) => set({ date_from, date_to })}
        />
        <SortSelect
          options={[
            { label: 'Newest first', sort_order: 'latest' },
            { label: 'Oldest first', sort_order: 'oldest' },
          ]}
          sortOrder={params.sort_order}
          onChange={(_sortBy, sort_order) => set({ sort_order })}
        />
      </FilterBar>
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <EmptyState title="No complaints match" description="Try a different search or date range." />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Subject or person</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Sender</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.data.map((item: ComplaintListItem) => (
                  <TableRow key={item.complaint_id}>
                    <TableCell>{formatDate(item.received_at)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium hover:text-primary hover:underline"
                        onClick={() => set({ complaint: item.complaint_id }, { keepPage: true })}
                      >
                        {item.subject || item.person_name || 'Restricted report'}
                      </button>
                    </TableCell>
                    <TableCell>{humanize(item.source)}</TableCell>
                    <TableCell>{item.sender_email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={list.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
      <ComplaintDetailDialog
        id={selected}
        onClose={() => set({ complaint: undefined }, { keepPage: true })}
      />
    </section>
  );
}

function ComplaintDetailDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const detail = useQuery({ ...complaintDetailQuery(id ?? ''), enabled: Boolean(id) });
  return (
    <Dialog
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restricted complaint</DialogTitle>
          <DialogDescription>Only authorised HR staff can view this record.</DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <TableSkeleton rows={3} />
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Received" value={formatDate(detail.data.received_at)} />
              <Detail label="Source" value={humanize(detail.data.source)} />
              <Detail label="Person" value={detail.data.person?.full_name} />
              <Detail label="Sender" value={detail.data.sender_email} />
            </div>
            <div>
              <h3 className="font-medium">{detail.data.subject ?? 'Report content'}</h3>
              <p className="mt-2 break-words whitespace-pre-wrap text-muted-foreground">
                {detail.data.content || 'No text supplied.'}
              </p>
            </div>
            {detail.data.attachment && (
              <AttachmentButton
                id={detail.data.attachment.attachment_id}
                name={detail.data.attachment.file_name}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

function AttachmentButton({ id, name }: { id: string; name: string }) {
  return <OpenFileButton getUrl={() => complaintsApi.attachmentUrl(id)} label={name} />;
}

function UploadTranscript() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<UploadSourceType>(UploadSource.EXIT_INTERVIEW);
  const [personId, setPersonId] = useState('');
  const cache = useQueryClient();
  const fileUpload = useFileUpload('transcript');
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a transcript');
      return complaintsApi.uploadTranscript({
        source,
        person_id: personId.trim() || null,
        file: await fileUpload.mutateAsync(file),
      });
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: complaintKeys.all });
      showToast.success('Transcript saved');
      setOpen(false);
      setFile(null);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileUp className="size-4" /> Add transcript
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a restricted transcript</DialogTitle>
          <DialogDescription>
            Upload an exit interview or HR Connect transcript. It stays outside case timelines.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          Source
          <SelectField
            value={source}
            onValueChange={(next) => setSource(next as UploadSourceType)}
            options={Object.values(UploadSource).map((value) => ({ value, label: humanize(value) }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          Person ID, optional
          <Input
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            placeholder="Person UUID…"
          />
        </label>
        <FilePicker purpose="transcript" file={file} onChange={setFile} uploading={upload.isPending} />
        <DialogFooter>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? 'Uploading…' : 'Save transcript'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
