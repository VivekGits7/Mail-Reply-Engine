import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { Field } from '@/components/common/Field';
import { EmptyState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SelectField } from '@/components/common/SelectField';
import { documentLabel, statusLabel } from '@/utils/labels';
import { formatRelative } from '@/utils/utility';
import { ChecklistStatus, type AttachmentData, type ChecklistItemData } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

const OVERRIDE_STATUSES = [
  ChecklistStatus.VERIFIED,
  ChecklistStatus.RECEIVED,
  ChecklistStatus.WRONG_TYPE,
  ChecklistStatus.UNREADABLE,
  ChecklistStatus.PENDING,
] as const;

type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];

interface ChecklistPanelProps {
  caseId: string;
  items: ChecklistItemData[];
  attachments: AttachmentData[];
}

export function ChecklistPanel({ caseId, items, attachments }: ChecklistPanelProps) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [editing, setEditing] = useState<ChecklistItemData | null>(null);
  const files = new Map(attachments.map((file) => [file.attachment_id, file]));

  if (!items.length) {
    return (
      <EmptyState
        title="No checklist on this case"
        description="Checklists come from the template for the hire type and location."
      />
    );
  }

  return (
    <>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Linked file</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Updated</TableHead>
              {isAdmin && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.checklist_item_id}>
                <TableCell>
                  <span className="font-medium">{documentLabel(item.document_type)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.is_mandatory ? 'Required' : 'Optional'} ·{' '}
                    {item.check_mode === 'photo' ? 'Photo check' : 'Text check'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge value={item.status} />
                    {item.person_check && item.person_check !== 'match' && (
                      <StatusBadge value={item.person_check} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {item.attachment_id ? (files.get(item.attachment_id)?.file_name ?? 'Attached') : '—'}
                </TableCell>
                <TableCell className="max-w-64 text-sm whitespace-normal text-muted-foreground">
                  {item.notes || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatRelative(item.updated_at)}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Change status of ${documentLabel(item.document_type)}`}
                      onClick={() => setEditing(item)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
      {editing && (
        <OverrideDialog
          caseId={caseId}
          item={editing}
          attachments={attachments}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

interface OverrideDialogProps {
  caseId: string;
  item: ChecklistItemData;
  attachments: AttachmentData[];
  onClose: () => void;
}

function OverrideDialog({ caseId, item, attachments, onClose }: OverrideDialogProps) {
  const initial = OVERRIDE_STATUSES.find((status) => status === item.status) ?? ChecklistStatus.VERIFIED;
  const [status, setStatus] = useState<OverrideStatus>(initial);
  const [note, setNote] = useState(item.notes ?? '');
  const [attachmentId, setAttachmentId] = useState(item.attachment_id ?? '');
  const save = useCaseMutation(
    caseId,
    () =>
      casesApi.overrideChecklist(caseId, item.checklist_item_id, {
        status,
        note: note.trim() || null,
        attachment_id: attachmentId || null,
      }),
    { onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{documentLabel(item.document_type)}</DialogTitle>
          <DialogDescription>
            Set the status by hand when you checked the document yourself.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field id="override-status" label="Status">
            <SelectField
              id="override-status"
              className="w-full sm:w-full"
              value={status}
              onValueChange={(next) => setStatus(next as OverrideStatus)}
              options={OVERRIDE_STATUSES.map((value) => ({ value, label: statusLabel(value).label }))}
            />
          </Field>
          {attachments.length > 0 && (
            <Field id="override-file" label="Linked file" optional>
              <SelectField
                id="override-file"
                className="w-full sm:w-full"
                value={attachmentId}
                onValueChange={setAttachmentId}
                options={[
                  { value: '', label: 'No file' },
                  ...attachments.map((file) => ({ value: file.attachment_id, label: file.file_name })),
                ]}
              />
            </Field>
          )}
          <Field id="override-note" label="Note" optional>
            <Textarea
              id="override-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Name differs only by an initial"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? 'Saving…' : 'Save status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
