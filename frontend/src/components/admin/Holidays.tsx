import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { TableShell } from '@/components/common/TableShell';
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
import { DateField } from '@/components/common/DateField';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate } from '@/utils/utility';
import { adminApi, adminKeys, holidaysQuery } from './Adminapi';
import { HolidayCalendar } from './HolidayCalendar';

const CURRENT_YEAR = new Date().getFullYear();

export default function Holidays() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set } = useUrlState();
  const year = Number(get('year') ?? CURRENT_YEAR);
  const location = get('location');
  const list = useQuery(holidaysQuery({ year, location }));
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: adminApi.deleteHoliday,
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.holidays({ year, location }) });
      showToast.success('Holiday removed');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <section>
      <PageHeader
        title="Holidays"
        description="Days when the agent sends nothing and plans no induction sessions. Emails due on a holiday wait for the next working day."
        actions={isAdmin && <AddHoliday />}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Year
          <Input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => set({ year: event.target.value })}
            className="w-28"
          />
        </label>
        <SearchInput label="Location" value={location} onSearch={(next) => set({ location: next })} />
      </div>
      {list.data && !location && <HolidayCalendar year={year} holidays={list.data} />}
      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.length ? (
        <EmptyState
          title="No holidays in this view"
          description={
            location
              ? 'No holidays for this location in this year. Clear the location to see company wide holidays.'
              : `No holidays are set for ${year}, so the agent sends on every weekday in the sending window. Add the company holidays for the year.`
          }
          action={isAdmin && !location ? <AddHoliday /> : undefined}
        />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Location</TableHead>
                {isAdmin && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((holiday) => (
                <TableRow key={holiday.holiday_id}>
                  <TableCell>{formatDate(holiday.holiday_date)}</TableCell>
                  <TableCell className="font-medium">{holiday.name}</TableCell>
                  <TableCell>{holiday.location ?? 'Company wide'}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <ConfirmDialog
                        title="Remove holiday?"
                        description={`${holiday.name} will no longer block sending on ${formatDate(holiday.holiday_date)}.`}
                        confirmLabel="Remove holiday"
                        destructive
                        onConfirm={() => remove.mutate(holiday.holiday_id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${holiday.name}`}
                            disabled={remove.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </section>
  );
}

function AddHoliday() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const cache = useQueryClient();
  const create = useMutation({
    mutationFn: adminApi.createHoliday,
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['admin', 'holidays'] });
      showToast.success('Holiday added');
      setDate('');
      setOpen(false);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;
    const form = new FormData(event.currentTarget);
    create.mutate({
      holiday_date: date,
      name: String(form.get('name')).trim(),
      location: String(form.get('location')).trim() || null,
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add holiday
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add holiday</DialogTitle>
          <DialogDescription>Leave location blank for a company wide holiday.</DialogDescription>
        </DialogHeader>
        <form id="holiday-form" className="space-y-4" onSubmit={submit}>
          <div className="text-sm">
            <label htmlFor="holiday-date">Date</label>
            <DateField id="holiday-date" value={date} onChange={setDate} className="mt-1" />
          </div>
          <label className="block text-sm">
            Name
            <Input name="name" required minLength={2} className="mt-1" />
          </label>
          <label className="block text-sm">
            Location, optional
            <Input name="location" className="mt-1" />
          </label>
        </form>
        <DialogFooter>
          <Button form="holiday-form" type="submit" disabled={create.isPending || !date}>
            {create.isPending ? 'Adding…' : 'Add holiday'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
