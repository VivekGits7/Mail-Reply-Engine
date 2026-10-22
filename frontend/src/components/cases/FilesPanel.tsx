import { EmptyState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { documentLabel } from '@/utils/labels';
import { formatBytes, formatDateTime, humanize } from '@/utils/utility';
import type { AttachmentData } from '@/types';
import { casesApi } from './Casesapi';
import { OpenFileButton } from './OpenFileButton';

function percent(value?: number | null) {
  return value == null ? null : `${Math.round(value * 100)}%`;
}

export function FilesPanel({ attachments }: { attachments: AttachmentData[] }) {
  if (!attachments.length) {
    return <EmptyState title="No files yet" description="Files sent by email or uploaded by HR show up here." />;
  }

  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Looks like</TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Received</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {attachments.map((file) => (
            <TableRow key={file.attachment_id} className={file.is_latest ? undefined : 'text-muted-foreground'}>
              <TableCell className="max-w-64">
                <span className="block truncate font-medium">{file.file_name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {humanize(file.kind)} · {formatBytes(file.size)}
                  {!file.is_latest && ' · replaced'}
                </span>
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal">
                {file.document_type_guess ? documentLabel(file.document_type_guess) : '—'}
                {file.ai_confidence != null && (
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {percent(file.ai_confidence)} sure
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  <StatusBadge value={file.check_status} />
                  {file.person_check && <StatusBadge value={file.person_check} />}
                </div>
                {file.issues.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {file.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">{formatDateTime(file.received_at)}</TableCell>
              <TableCell>
                <OpenFileButton getUrl={() => casesApi.attachmentUrl(file.attachment_id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
