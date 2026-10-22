import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { CaseStatus, type CaseData } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

interface Action {
  status: CaseStatus;
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
}

const PAUSE: Action = {
  status: CaseStatus.ON_HOLD,
  label: 'Put on hold',
  title: 'Put this case on hold?',
  description: 'Pending follow-ups are cancelled. Nothing goes out until you resume it.',
};
const RESUME: Action = {
  status: CaseStatus.OPEN,
  label: 'Resume',
  title: 'Resume this case?',
  description: 'The agent picks up where it stopped and schedules the next follow-up.',
};
const CLOSE: Action = {
  status: CaseStatus.CLOSED,
  label: 'Close case',
  title: 'Close this case?',
  description: 'All follow-ups stop. You can reopen it later.',
};
const CANCEL: Action = {
  status: CaseStatus.CANCELLED,
  label: 'Cancel case',
  title: 'Cancel this case?',
  description: 'Use this when the joiner or exit is called off. All follow-ups stop.',
  destructive: true,
};
const REOPEN: Action = { ...RESUME, label: 'Reopen', title: 'Reopen this case?' };

function actionsFor(status: string): Action[] {
  if (status === CaseStatus.OPEN) return [PAUSE, CLOSE, CANCEL];
  if (status === CaseStatus.ON_HOLD) return [RESUME, CLOSE, CANCEL];
  return [REOPEN];
}

export function CaseStatusMenu({ caseData }: { caseData: CaseData }) {
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const update = useCaseMutation(caseData.case_id, (picked: Action) =>
    casesApi.update(caseData.case_id, { status: picked.status, note: note.trim() || null }),
    { onSuccess: () => setAction(null) },
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Case status
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actionsFor(caseData.status).map((item) => (
            <DropdownMenuItem
              key={item.label}
              variant={item.destructive ? 'destructive' : 'default'}
              onSelect={() => {
                setNote('');
                setAction(item);
              }}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.title}</DialogTitle>
            <DialogDescription>{action?.description}</DialogDescription>
          </DialogHeader>
          <Field id="case-status-note" label="Note" optional hint="Saved to the activity log as a yes or no, not the text">
            <Textarea id="case-status-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Keep as is
            </Button>
            <Button
              variant={action?.destructive ? 'destructive' : 'default'}
              disabled={update.isPending}
              onClick={() => action && update.mutate(action)}
            >
              {action?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
