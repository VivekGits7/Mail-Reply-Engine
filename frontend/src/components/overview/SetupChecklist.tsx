import type { ReactNode } from 'react';
import { CircleCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { JoinerFormDialog } from '@/components/joiners/JoinerFormDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { SetupStep } from '@/utils/setup';

interface SetupChecklistProps {
  steps: SetupStep[];
  testInbox: string;
  dryRun: boolean;
  missingContacts: number;
  totalContacts: number;
  isAdmin: boolean;
}

export function SetupChecklist({
  steps,
  testInbox,
  dryRun,
  missingContacts,
  totalContacts,
  isAdmin,
}: SetupChecklistProps) {
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;
  const current = steps.find((step) => !step.done)?.id;
  const isDone = Object.fromEntries(steps.map((step) => [step.id, step.done])) as Record<SetupStep['id'], boolean>;
  const ready = isDone.test_inbox && isDone.contacts;

  const content: Record<SetupStep['id'], { title: string; detail: string; action: ReactNode }> = {
    test_inbox: {
      title: 'Set the test inbox',
      detail: isDone.test_inbox
        ? `Test emails go to ${testInbox}.`
        : dryRun
          ? 'Dry run is on, so every email goes to a test inbox instead of real people. Until one is set, every email is on hold.'
          : 'Dry run is off. Set a test inbox so you can switch back to test mode before trying new templates.',
      action: (
        <StepLink to="/admin/controls" primary={current === 'test_inbox'}>
          {isAdmin ? 'Set test inbox' : 'View controls'}
        </StepLink>
      ),
    },
    contacts: {
      title: 'Add the team email addresses',
      detail: isDone.contacts
        ? 'Every team address is set.'
        : `The agent sends requests to IT, Finance, Admin and the onboarding group. ${missingContacts} of ${totalContacts} addresses are empty, and emails to an empty one are skipped.`,
      action: (
        <StepLink to="/admin/settings#teams-and-integrations" primary={current === 'contacts'}>
          {isAdmin ? 'Add addresses' : 'View addresses'}
        </StepLink>
      ),
    },
    first_joiner: {
      title: 'Add your first joiner',
      detail: ready
        ? 'Enter the candidate, recruiter and manager. The agent emails the document checklist and follows up until everything arrives.'
        : 'Finish the steps above first, so the document request reaches the test inbox and the right teams.',
      action: isAdmin ? (
        <JoinerFormDialog
          trigger={
            <Button size="sm" variant={current === 'first_joiner' ? 'default' : 'outline'}>
              <UserPlus aria-hidden="true" />
              Add joiner
            </Button>
          }
        />
      ) : (
        <StepLink to="/joiners" primary={false}>
          View joiners
        </StepLink>
      ),
    },
  };

  return (
    <section aria-labelledby="setup-title" className="mb-6 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 id="setup-title" className="font-semibold">
          Finish setup before the agent emails anyone
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {isAdmin
          ? 'This list goes away once every step is done.'
          : 'An HR admin needs to finish these steps. You can open each one to see where things stand.'}
      </p>
      <ol className="mt-4 divide-y border-t">
        {steps.map((step, index) => {
          const { title, detail, action } = content[step.id];
          return (
            <li key={step.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <StepMarker done={step.done} number={index + 1} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground')}>
                    {title}
                    {step.done && <span className="sr-only">, done</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-pretty break-words text-muted-foreground">{detail}</p>
                </div>
              </div>
              {!step.done && <div className="shrink-0 pl-9 sm:pl-0">{action}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepMarker({ done, number }: { done: boolean; number: number }) {
  if (done) return <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden="true" />;
  return (
    <span
      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground tabular-nums"
      aria-hidden="true"
    >
      {number}
    </span>
  );
}

function StepLink({ to, primary, children }: { to: string; primary: boolean; children: ReactNode }) {
  return (
    <Button asChild size="sm" variant={primary ? 'default' : 'outline'}>
      <Link to={to}>{children}</Link>
    </Button>
  );
}
