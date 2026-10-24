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
import { TASK_TYPE_LABELS, statusLabel } from '@/utils/labels';
import { formatRelative, humanize } from '@/utils/utility';
import { TaskStatus, type TaskData } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

const SUB_ITEM_STATES = ['pending', 'partial', 'done', 'blocked', 'not_applicable'];

export function TasksPanel({ caseId, tasks }: { caseId: string; tasks: TaskData[] }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [editing, setEditing] = useState<TaskData | null>(null);

  if (!tasks.length)
    return (
      <EmptyState title="No tasks yet" description="Tasks appear when the agent asks a team for something." />
    );

  return (
    <>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Follow-ups</TableHead>
              <TableHead>Next follow-up</TableHead>
              {isAdmin && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.task_id}>
                <TableCell className="max-w-64 whitespace-normal">
                  <span className="font-medium">
                    {TASK_TYPE_LABELS[task.task_type] ?? humanize(task.task_type)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {task.owner_email ?? humanize(task.owner_role)}
                  </span>
                  {task.progress_notes && (
                    <span className="mt-1 block text-xs text-muted-foreground">{task.progress_notes}</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge value={task.status} />
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal">
                  {Object.keys(task.sub_items).length ? (
                    <ul className="flex flex-wrap gap-1">
                      {Object.entries(task.sub_items).map(([item, state]) => (
                        <li key={item}>
                          <StatusBadge
                            value={state}
                            label={`${humanize(item)}: ${statusLabel(state).label}`}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{task.followups_sent}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {task.completed_at
                    ? `Done ${formatRelative(task.completed_at)}`
                    : formatRelative(task.next_followup_at)}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Update ${TASK_TYPE_LABELS[task.task_type] ?? task.task_type}`}
                      onClick={() => setEditing(task)}
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
      {editing && <TaskDialog caseId={caseId} task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TaskDialog({ caseId, task, onClose }: { caseId: string; task: TaskData; onClose: () => void }) {
  const [status, setStatus] = useState(task.status);
  const [items, setItems] = useState<Record<string, string>>(task.sub_items);
  const [note, setNote] = useState('');
  const changedItems = Object.fromEntries(
    Object.entries(items).filter(([key, value]) => task.sub_items[key] !== value),
  );
  const save = useCaseMutation(
    caseId,
    () =>
      casesApi.updateTask(task.task_id, {
        status: status !== task.status ? (status as TaskStatus) : null,
        sub_items: changedItems,
        note: note.trim() || null,
      }),
    { onSuccess: onClose },
  );
  const nothingChanged = status === task.status && !Object.keys(changedItems).length && !note.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TASK_TYPE_LABELS[task.task_type] ?? humanize(task.task_type)}</DialogTitle>
          <DialogDescription>
            Update it when the team confirmed outside email, like over Teams. Closing it stops the follow-ups.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field id="task-status" label="Status">
            <SelectField
              id="task-status"
              className="w-full sm:w-full"
              value={status}
              onValueChange={setStatus}
              options={Object.values(TaskStatus).map((value) => ({ value, label: statusLabel(value).label }))}
            />
          </Field>
          {Object.keys(items).length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Items</legend>
              {Object.entries(items).map(([item, state]) => (
                <div key={item} className="flex items-center justify-between gap-3">
                  <label htmlFor={`item-${item}`} className="text-sm">
                    {humanize(item)}
                  </label>
                  <SelectField
                    id={`item-${item}`}
                    value={state}
                    onValueChange={(next) => setItems((prev) => ({ ...prev, [item]: next }))}
                    options={SUB_ITEM_STATES.map((value) => ({ value, label: statusLabel(value).label }))}
                  />
                </div>
              ))}
            </fieldset>
          )}
          <Field id="task-note" label="Progress note" optional>
            <Textarea
              id="task-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending || nothingChanged} onClick={() => save.mutate(undefined)}>
            {save.isPending ? 'Saving…' : 'Save task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
