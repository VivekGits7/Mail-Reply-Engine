import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { Field } from '@/components/common/Field';
import { EmptyState } from '@/components/common/QueryState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateTimeField } from '@/components/common/DateField';
import { formatDateTime, fromLocalDateTimeInput, toLocalDateTimeInput } from '@/utils/utility';
import type { InductionSessionData } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

const BOOKABLE = new Set(['no_reply', 'conflict', 'alternative', 'proposed', 'asked']);

export function SessionsPanel({ caseId, sessions }: { caseId: string; sessions: InductionSessionData[] }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [booking, setBooking] = useState<InductionSessionData | null>(null);

  if (!sessions.length) {
    return (
      <EmptyState
        title="No sessions yet"
        description="Sessions appear once the induction plan is approved in the approval queue."
      />
    );
  }

  return (
    <>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Proposed</TableHead>
              <TableHead>Agreed</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.induction_session_id}>
                <TableCell className="max-w-64 whitespace-normal">
                  <span className="font-medium">{session.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {session.owner_email ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{formatDateTime(session.proposed_start)}</TableCell>
                <TableCell className="tabular-nums">{formatDateTime(session.agreed_start)}</TableCell>
                <TableCell>
                  <StatusBadge value={session.status} />
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {BOOKABLE.has(session.status) && (
                      <Button variant="outline" size="sm" onClick={() => setBooking(session)}>
                        <CalendarCheck aria-hidden="true" />
                        Book
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
      {booking && <BookDialog caseId={caseId} session={booking} onClose={() => setBooking(null)} />}
    </>
  );
}

function BookDialog({
  caseId,
  session,
  onClose,
}: {
  caseId: string;
  session: InductionSessionData;
  onClose: () => void;
}) {
  const [start, setStart] = useState(toLocalDateTimeInput(session.agreed_start ?? session.proposed_start));
  const [end, setEnd] = useState(toLocalDateTimeInput(session.agreed_end ?? session.proposed_end));
  const [force, setForce] = useState(session.status === 'conflict');
  const invalid = !start || !end || end <= start;
  const book = useCaseMutation(
    caseId,
    () =>
      casesApi.bookSession(session.induction_session_id, {
        start: fromLocalDateTimeInput(start),
        end: fromLocalDateTimeInput(end),
        force,
      }),
    { onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book {session.title}</DialogTitle>
          <DialogDescription>
            The invite goes to the session owner and the joiner, or to the test inbox in dry run.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="book-start" label="Starts">
            <DateTimeField id="book-start" label="Starts" value={start} onChange={setStart} />
          </Field>
          <Field
            id="book-end"
            label="Ends"
            error={start && end && end <= start ? 'End must be after the start' : undefined}
          >
            <DateTimeField id="book-end" label="Ends" value={end} min={start} onChange={setEnd} />
          </Field>
          <div className="flex items-start gap-2 sm:col-span-2">
            <Checkbox
              id="book-force"
              checked={force}
              onCheckedChange={(checked) => setForce(checked === true)}
            />
            <Label htmlFor="book-force" className="leading-snug font-normal">
              Book even if the owner looks busy
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={invalid || book.isPending} onClick={() => book.mutate(undefined)}>
            {book.isPending ? 'Booking…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
