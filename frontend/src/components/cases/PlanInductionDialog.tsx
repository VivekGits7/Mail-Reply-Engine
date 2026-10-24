import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/common/SelectField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InductionTrack } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

export function PlanInductionDialog({ caseId, trigger }: { caseId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState<InductionTrack | ''>('');
  const navigate = useNavigate();
  const plan = useCaseMutation(caseId, () => casesApi.planInduction(caseId, { track: track || null }), {
    onSuccess: (res) => {
      setOpen(false);
      navigate(`/cases/${res.data.induction_case_id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan induction</DialogTitle>
          <DialogDescription>
            The agent drafts a schedule that skips weekends and holidays. It waits in the approval queue for
            you.
          </DialogDescription>
        </DialogHeader>
        <Field
          id="induction-track"
          label="Track"
          hint="Leave on automatic to pick it from the level and hire type"
        >
          <SelectField
            id="induction-track"
            className="w-full sm:w-full"
            value={track}
            onValueChange={(next) => setTrack(next as InductionTrack | '')}
            options={[
              { value: '', label: 'Automatic' },
              { value: InductionTrack.CAMPUS, label: 'Campus' },
              { value: InductionTrack.MID, label: 'Mid level' },
              { value: InductionTrack.SENIOR, label: 'Senior' },
            ]}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={plan.isPending} onClick={() => plan.mutate(undefined)}>
            {plan.isPending ? 'Starting…' : 'Draft the plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
