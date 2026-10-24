import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, ErrorState } from '@/components/common/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { TRACK_LABELS } from '@/utils/labels';
import { showToast } from '@/utils/toast';
import { InductionTrack, type InductionSessionTemplate, type InductionTrack as Track } from '@/types';
import { adminApi, adminKeys, inductionTemplateQuery } from './Adminapi';

export default function InductionTemplates() {
  const { get, set } = useUrlState();
  const track = Object.values(InductionTrack).includes(get('track') as Track)
    ? (get('track') as Track)
    : InductionTrack.CAMPUS;
  return (
    <section>
      <PageHeader
        title="Induction plans"
        description="The sessions the agent proposes for each joiner track. Every plan still goes to Approvals before anyone is invited. Changes apply to new plans only."
      />
      <Tabs
        value={track}
        onValueChange={(value) => set({ track: value === InductionTrack.CAMPUS ? undefined : value })}
      >
        <TabsList>
          {Object.values(InductionTrack).map((value) => (
            <TabsTrigger key={value} value={value}>
              {TRACK_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.values(InductionTrack).map((value) => (
          <TabsContent key={value} value={value} className="mt-5">
            <TrackEditor track={value} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TrackEditor({ track }: { track: Track }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const query = useQuery(inductionTemplateQuery(track));
  if (query.isPending) return <BlockSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <SessionEditor
      key={`${track}:${query.data.updated_at ?? ''}`}
      track={track}
      initial={query.data.sessions}
      editable={isAdmin}
    />
  );
}

function SessionEditor({
  track,
  initial,
  editable,
}: {
  track: Track;
  initial: InductionSessionTemplate[];
  editable: boolean;
}) {
  const [sessions, setSessions] = useState(initial);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: () => adminApi.putInductionTemplate(track, { sessions }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.induction(track) });
      showToast.success('Induction template saved');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  function change(index: number, patch: Partial<InductionSessionTemplate>) {
    setSessions((current) =>
      current.map((session, position) => (position === index ? { ...session, ...patch } : session)),
    );
  }
  return (
    <div className="space-y-3">
      {sessions.map((session, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_7rem_auto]"
        >
          <label className="text-xs text-muted-foreground">
            Session title
            <Input
              value={session.title}
              readOnly={!editable}
              onChange={(event) => change(index, { title: event.target.value })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Owner email or token
            <Input
              value={session.owner_email}
              readOnly={!editable}
              onChange={(event) => change(index, { owner_email: event.target.value })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Minutes
            <Input
              type="number"
              min={15}
              max={480}
              value={session.duration_mins}
              readOnly={!editable}
              onChange={(event) => change(index, { duration_mins: Number(event.target.value) })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Day
            <Input
              type="number"
              min={1}
              max={90}
              value={session.day_number}
              readOnly={!editable}
              onChange={(event) => change(index, { day_number: Number(event.target.value) })}
            />
          </label>
          {editable && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove session ${index + 1}`}
              onClick={() => setSessions((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {editable && (
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setSessions((current) => [
                ...current,
                { title: '', owner_email: '', duration_mins: 60, day_number: 1 },
              ])
            }
          >
            <Plus className="size-4" /> Add session
          </Button>
          <Button
            disabled={
              save.isPending ||
              sessions.some((session) => !session.title.trim() || !session.owner_email.trim())
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save track'}
          </Button>
        </div>
      )}
    </div>
  );
}
