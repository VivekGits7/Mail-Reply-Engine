import { CircleCheck } from 'lucide-react';
import type { SetupStep, SetupStepId } from '@/utils/setup';

interface SetupChecklistProps {
  steps: SetupStep[];
}

const TITLES: Record<SetupStepId, string> = {
  test_inbox: 'Set the test inbox',
  contacts: 'Add the team email addresses',
  first_joiner: 'Add your first joiner',
};

export function SetupChecklist({ steps }: SetupChecklistProps) {
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section aria-labelledby="setup-title" className="mb-6 panel p-5 sm:p-6">
      <h2 id="setup-title" className="text-xl font-normal tracking-[-0.02em]">
        Finish setup before the agent emails anyone
      </h2>
      <ol className="mt-5 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 panel-inset px-4 py-3.5">
            <CircleCheck className="size-7 shrink-0 text-success" aria-hidden="true" />
            <p className="min-w-0 text-sm font-medium text-muted-foreground">
              {TITLES[step.id]}
              <span className="sr-only">, done</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
