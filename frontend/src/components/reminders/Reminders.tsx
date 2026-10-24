import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BellRing, CalendarClock, Layers, ListTodo, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Breakdown, MiniStat } from '@/components/visual/Breakdown';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { Button } from '@/components/ui/button';
import { useUrlState } from '@/hooks/useUrlState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { describeCron } from '@/utils/cron';
import { DATA_SOURCE_LABELS } from '@/utils/labels';
import { formatDate } from '@/utils/utility';
import { DataSource, type RuleData, type RuleSortBy, type SortOrder } from '@/types';
import { ReminderRuleForm } from './ReminderRuleForm';
import { ruleListQuery } from './Remindersapi';

const CARD_TONES: VisualTone[] = ['azure', 'iris', 'mint', 'sun', 'ember'];

function RuleSummary({
  active,
  onActive,
}: {
  active?: string;
  onActive: (value: string | undefined) => void;
}) {
  const all = useQuery(ruleListQuery());
  const rules = all.data ?? [];
  const running = rules.filter((rule) => rule.is_active).length;
  const openTasks = rules.reduce((sum, rule) => sum + rule.open_tasks, 0);
  const nextRun = rules
    .filter((rule) => rule.is_active && rule.next_run_at)
    .map((rule) => rule.next_run_at!)
    .sort()[0];
  return (
    <Breakdown
      title="Rules by state"
      totalLabel="Reminder rules"
      loading={all.isPending}
      segments={[
        { key: 'true', label: 'Active', tone: 'mint', value: running },
        { key: 'false', label: 'Paused', tone: 'neutral', value: rules.length - running },
      ]}
      active={active}
      onSelect={onActive}
      aside={
        <>
          <MiniStat label="Open tasks" icon={ListTodo} tone="iris" value={openTasks} />
          <MiniStat
            label="Next run"
            icon={CalendarClock}
            tone="azure"
            value={nextRun ? formatDate(nextRun).replace(/ \d{4}$/, '') : '—'}
          />
        </>
      }
    />
  );
}

function RuleCard({ rule, tone }: { rule: RuleData; tone: VisualTone }) {
  return (
    <motion.li
      variants={riseIn}
      className="group relative flex flex-col panel p-5 transition-[transform,box-shadow] duration-200 ease-(--ease-fluid) focus-within:ring-3 focus-within:ring-ring/50 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-12 items-center justify-center rounded-2xl', TONE_STYLES[tone].soft)}>
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <StatusBadge value={rule.is_active ? 'active' : 'paused'} />
      </div>
      <Link
        to={`/reminders/${rule.reminder_rule_id}`}
        className="mt-5 text-lg leading-snug font-normal tracking-[-0.015em] after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:outline-none"
      >
        {rule.name}
      </Link>
      <span className="font-mono text-xs text-muted-foreground">{rule.rule_key}</span>
      <p className="mt-2 text-sm text-muted-foreground">{describeCron(rule.schedule_cron)}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex h-8 items-center gap-1.5 pill px-3">
          <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {rule.stages.length} {rule.stages.length === 1 ? 'stage' : 'stages'}
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 pill px-3">
          <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {formatDate(rule.next_run_at)}
        </span>
        <span className="inline-flex h-8 items-center pill px-3">{DATA_SOURCE_LABELS[rule.data_source]}</span>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <div>
          <p className="text-xs text-muted-foreground">Open tasks</p>
          <p className="text-3xl leading-tight font-light tracking-[-0.03em] tabular-nums">
            {rule.open_tasks}
          </p>
        </div>
        <span className="flex size-10 items-center justify-center pill rounded-full transition-transform duration-200 group-hover:rotate-45">
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </motion.li>
  );
}

export default function Reminders() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set } = useUrlState();
  const params = {
    search: get('search'),
    data_source: get('data_source') as DataSource | undefined,
    is_active: get('is_active') === undefined ? undefined : get('is_active') === 'true',
    sort_by: (get('sort_by') ?? 'name') as RuleSortBy,
    sort_order: (get('sort_order') ?? 'a_to_z') as SortOrder,
  };
  const rules = useQuery(ruleListQuery(params));
  return (
    <section>
      <PageHeader
        title="Reminders"
        description="Scheduled nudges for recurring HR work. Open a rule to see its recipients and import a new list."
        actions={
          isAdmin && (
            <ReminderRuleForm
              trigger={
                <Button>
                  <Plus className="size-4" /> Create rule
                </Button>
              }
            />
          )
        }
      />
      <RuleSummary active={get('is_active')} onActive={(is_active) => set({ is_active })} />
      <FilterBar>
        <SearchInput label="Search rules" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="Source"
          value={params.data_source}
          options={Object.values(DataSource).map((value) => ({ value, label: DATA_SOURCE_LABELS[value] }))}
          onChange={(data_source) => set({ data_source })}
        />
        <FilterSelect
          label="State"
          value={get('is_active')}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Paused' },
          ]}
          onChange={(is_active) => set({ is_active })}
        />
        <SortSelect
          options={[
            { label: 'Name A to Z', sort_by: 'name', sort_order: 'a_to_z' },
            { label: 'Newest first', sort_by: 'created_at', sort_order: 'latest' },
          ]}
          sortBy={params.sort_by}
          sortOrder={params.sort_order}
          onChange={(sort_by, sort_order) => set({ sort_by, sort_order })}
        />
      </FilterBar>
      {rules.isPending ? (
        <TableSkeleton />
      ) : rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : !rules.data.length ? (
        <EmptyState
          title="No rules match"
          description="Try a different filter or create a rule for a recurring task."
        />
      ) : (
        <>
          <motion.ul
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {rules.data.map((rule, index) => (
              <RuleCard
                key={rule.reminder_rule_id}
                rule={rule}
                tone={CARD_TONES[index % CARD_TONES.length]}
              />
            ))}
          </motion.ul>
        </>
      )}
    </section>
  );
}
