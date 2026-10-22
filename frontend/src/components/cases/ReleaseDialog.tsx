import { useState, type ReactNode } from 'react';
import { Field } from '@/components/common/Field';
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
import { Textarea } from '@/components/ui/textarea';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

export function ReleaseDialog({ caseId, trigger }: { caseId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const release = useCaseMutation(caseId, () => casesApi.releaseConfirm(caseId, { note: note.trim() || null }), {
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm release</DialogTitle>
          <DialogDescription>Every team has cleared. Confirming closes the exit and stops all follow-ups.</DialogDescription>
        </DialogHeader>
        <Field id="release-note" label="Note" optional>
          <Textarea id="release-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={release.isPending} onClick={() => release.mutate(undefined)}>
            {release.isPending ? 'Closing…' : 'Confirm release and close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
