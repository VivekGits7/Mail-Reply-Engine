import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, EmptyState, ErrorState } from '@/components/common/QueryState';
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { CheckMode, HireCategory, type ChecklistGroup, type ChecklistItemIn } from '@/types';
import { adminApi, adminKeys, checklistsQuery } from './Adminapi';

export default function Checklists() {
  const { get, set } = useUrlState();
  const isAdmin = useAppSelector(selectIsAdmin);
  const category = get('hire_category');
  const location = get('location');
  const list = useQuery(checklistsQuery({ hire_category: category as HireCategory | undefined, location }));
  return (
    <section>
      <PageHeader
        title="Document checklists"
        description="The required documents for each hire type and location. Changes apply to new joiners."
        actions={isAdmin && <NewChecklist />}
      />
      <FilterBar>
        <FilterSelect
          label="Hire type"
          value={category}
          options={Object.values(HireCategory).map((value) => ({ value, label: value }))}
          onChange={(hire_category) => set({ hire_category })}
        />
        <label className="text-sm">
          Location
          <Input
            value={location ?? ''}
            onChange={(event) => set({ location: event.target.value || undefined })}
            placeholder="Any location…"
          />
        </label>
      </FilterBar>
      {list.isPending ? (
        <BlockSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.length ? (
        <EmptyState title="No checklists configured" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {list.data.map((group) => (
            <ChecklistEditor
              key={`${group.hire_category}:${group.location}:${group.updated_at ?? ''}`}
              group={group}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewChecklist() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<HireCategory>(HireCategory.LATERAL);
  const [location, setLocation] = useState('');
  const cache = useQueryClient();
  const groups = useQuery({ ...checklistsQuery(), enabled: open });
  const base = groups.data?.find((group) => group.hire_category === category && group.location === '*');
  const exists = groups.data?.some(
    (group) =>
      group.hire_category === category &&
      group.location.toLowerCase() === location.trim().toLowerCase(),
  );
  const save = useMutation({
    mutationFn: () =>
      adminApi.putChecklist({
        hire_category: category,
        location: location.trim(),
        items:
          base?.items.map(({ document_type, is_mandatory, check_mode }) => ({
            document_type,
            is_mandatory,
            check_mode,
          })) ?? [],
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.checklists });
      showToast.success('Location checklist created');
      setOpen(false);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add location
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add location checklist</DialogTitle>
          <DialogDescription>
            Copy the default checklist for a hire type, then edit the new location.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          Hire type
          <NativeSelect
            className="w-full"
            value={category}
            onChange={(event) => setCategory(event.target.value as HireCategory)}
          >
            {Object.values(HireCategory).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          Location
          <Input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Office location…"
          />
        </label>
        {exists && (
          <p role="alert" className="text-sm text-destructive">
            This location already has a checklist. Edit it from the list.
          </p>
        )}
        {groups.isError && <ErrorState error={groups.error} onRetry={() => groups.refetch()} />}
        <DialogFooter>
          <Button disabled={!base || !location.trim() || Boolean(exists) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Creating…' : 'Create checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistEditor({ group }: { group: ChecklistGroup }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [items, setItems] = useState<ChecklistItemIn[]>(
    group.items.map(({ document_type, is_mandatory, check_mode }) => ({
      document_type,
      is_mandatory,
      check_mode,
    })),
  );
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      adminApi.putChecklist({ hire_category: group.hire_category, location: group.location, items }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.checklists });
      showToast.success('Checklist saved');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  function change(index: number, patch: Partial<ChecklistItemIn>) {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <section className="min-w-0 rounded-lg border p-4">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold capitalize">
          {group.hire_category} · {group.location === '*' ? 'Any location' : group.location}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} documents</span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] sm:items-center"
          >
            <label className="text-xs text-muted-foreground">
              Document
              <Input
                value={item.document_type}
                onChange={(event) => change(index, { document_type: event.target.value })}
                readOnly={!isAdmin}
                aria-label={`Document ${index + 1}`}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Check
              <NativeSelect
                className="w-full"
                value={item.check_mode ?? CheckMode.TEXT}
                disabled={!isAdmin}
                onChange={(event) => change(index, { check_mode: event.target.value as CheckMode })}
              >
                <NativeSelectOption value={CheckMode.TEXT}>Text</NativeSelectOption>
                <NativeSelectOption value={CheckMode.PHOTO}>Photo</NativeSelectOption>
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.is_mandatory ?? true}
                disabled={!isAdmin}
                onChange={(event) => change(index, { is_mandatory: event.target.checked })}
              />{' '}
              Required
            </label>
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.document_type}`}
                onClick={() => setItems((current) => current.filter((_, position) => position !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="mt-3 flex justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((current) => [
                ...current,
                { document_type: '', is_mandatory: true, check_mode: CheckMode.TEXT },
              ])
            }
          >
            <Plus className="size-4" /> Add document
          </Button>
          <Button
            size="sm"
            disabled={save.isPending || !items.length || items.some((item) => !item.document_type.trim())}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save checklist'}
          </Button>
        </div>
      )}
    </section>
  );
}
