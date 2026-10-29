import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BellRing, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { HelpPopover } from '@/components/common/HelpPopover';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { Button } from '@/components/ui/button';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { cn } from '@/utils/cn';
import { riseIn, staggerParent } from '@/utils/animations';
import { DATA_SOURCE_LABELS } from '@/utils/labels';
import { DataSource, type RuleData, type RuleSortBy, type SortOrder } from '@/types';
import { ReminderRuleForm } from './ReminderRuleForm';
import { ruleListQuery } from './Remindersapi';

const CARD_TONES: VisualTone[] = ['azure', 'iris', 'mint', 'sun', 'ember'];

const RULE_DESCRIPTIONS: Record<string, string> = {
  leave_approval: 'Chases managers for pending leave approvals.',
  appraisal_feedback: 'Chases managers, reviewers and employees to finish appraisals.',
  timesheet_pending: "Chases employees who haven't logged their daily work hours.",
};

const REMINDERS_HELP = [
  {
    label: 'Rule',
    detail:
      "One recurring reminder — like \"remind managers about pending appraisals.\" It says who to email, how often, and when to stop.",
  },
  {
    label: 'Active / Paused',
    detail: "Active rules run on schedule automatically. Paused rules are switched off and won't send anything.",
  },
  {
    label: 'Open tasks',
    detail: "How many people still haven't done what this reminder is chasing them about.",
  },
  {
    label: 'Next run',
    detail: 'When the system will next check and send reminders for this rule.',
  },
];

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
      {RULE_DESCRIPTIONS[rule.rule_key] && (
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{RULE_DESCRIPTIONS[rule.rule_key]}</p>
      )}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <div>
          <p className="text-xs text-muted-foreground">Pending</p>
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
  const hasFilters = Boolean(
    params.search || params.data_source || get('is_active') || get('sort_by') || get('sort_order'),
  );
  const clearFilters = () =>
    set({ search: undefined, data_source: undefined, is_active: undefined, sort_by: undefined, sort_order: undefined });
  return (
    <section>
      <PageHeader
        title="Reminders"
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <ReminderRuleForm
                trigger={
                  <Button>
                    <Plus className="size-4" /> Create rule
                  </Button>
                }
              />
            )}
            <HelpPopover title="What these mean" items={REMINDERS_HELP} />
          </div>
        }
      />
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        )}
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
