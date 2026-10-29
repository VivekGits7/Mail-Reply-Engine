import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { useLocation } from 'react-router';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, EmptyState, ErrorState } from '@/components/common/QueryState';
import { FilePicker } from '@/components/upload/FilePicker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TimeField } from '@/components/common/DateField';
import { useFileUpload } from '@/hooks/useFileUpload';
import { getErrorMessage } from '@/utils/apiError';
import { CONTACT_HINTS, missingContacts } from '@/utils/setup';
import { showToast } from '@/utils/toast';
import { humanize } from '@/utils/utility';
import type { SettingItem } from '@/types';
import { adminApi, adminKeys, settingsQuery } from './Adminapi';

const CONTROL_KEYS = new Set(['kill_switch', 'dry_run', 'test_inbox']);
const WEEKDAY_KEYS = new Set(['sending_days', 'working_days']);
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CLOCK = /^\d{2}:\d{2}$/;
const ACRONYMS: Record<string, string> = { ai: 'AI', ocr: 'OCR', mb: 'MB', hr: 'HR', it: 'IT', d365: 'D365' };

function settingLabel(key: string): string {
  return humanize(key)
    .split(' ')
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word)
    .join(' ');
}

const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'Follow-ups',
    keys: [
      'followup_gap_hours',
      'finance_followup_gap_hours',
      'max_followups',
      'max_auto_emails_per_person_per_day',
    ],
  },
  {
    title: 'Sending window',
    keys: [
      'sending_days',
      'sending_start',
      'sending_end',
      'welcome_email_time',
      'appointment_letter_check_time',
    ],
  },
  {
    title: 'Induction',
    keys: [
      'working_days',
      'induction_day_start',
      'induction_day_end',
      'induction_followup_after_days',
      'induction_max_followups',
      'senior_track_designations',
    ],
  },
  {
    title: 'Documents and AI',
    keys: [
      'document_reading_enabled',
      'ai_confidence_threshold',
      'name_match_threshold',
      'ocr_min_chars',
      'ocr_min_confidence',
      'upload_max_mb',
    ],
  },
  {
    title: 'Feedback surveys',
    keys: [
      'survey_levels',
      'survey_form_links',
      'survey_reminder_after_days',
      'survey_max_reminders',
      'survey_low_score_threshold',
      'feedback_report_day_of_month',
      'survey_response_workbooks',
    ],
  },
  { title: 'Teams and integrations', keys: ['contacts', 'work_email_domain', 'd365_enabled'] },
];

const SECTION_HINTS: Record<string, string> = {
  'Follow-ups': 'How often the agent chases people who have not replied, and when it stops.',
  'Sending window': 'Emails due outside these days and hours wait for the next window. Times are IST.',
  Induction: 'When induction sessions can be planned and how the agent chases session owners.',
  'Documents and AI': 'How sure the agent must be before it acts on an email or accepts a document.',
  'Feedback surveys': 'Who gets the 30, 60 and 90 day surveys and when HR is alerted about a low score.',
  'Teams and integrations':
    'The mailboxes the agent sends requests and alerts to. An empty address means those emails are skipped.',
};

function ContactGaps({ settings }: { settings: SettingItem[] }) {
  const missing = missingContacts(settings);
  if (!missing.length) return null;
  return (
    <p
      role="status"
      className="mb-2 rounded-2xl border border-warning/25 bg-sun/15 px-4 py-3 text-sm text-warning"
    >
      {missing.length === 1 ? '1 team address is' : `${missing.length} team addresses are`} empty:{' '}
      {missing.map(settingLabel).join(', ')}. Emails to these teams are skipped and the case is flagged Needs
      HR.
    </p>
  );
}

function grouped(items: SettingItem[]) {
  const byKey = new Map(items.filter((item) => !CONTROL_KEYS.has(item.key)).map((item) => [item.key, item]));
  const sections = SECTIONS.map(({ title, keys }) => ({
    title,
    items: keys.flatMap((key) => {
      const item = byKey.get(key);
      byKey.delete(key);
      return item ? [item] : [];
    }),
  }));
  if (byKey.size) sections.push({ title: 'Other', items: [...byKey.values()] });
  return sections.filter((section) => section.items.length);
}

function sectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export default function Settings() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const settings = useQuery(settingsQuery());
  const { hash } = useLocation();
  const loaded = Boolean(settings.data);

  useEffect(() => {
    if (!loaded || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [loaded, hash]);

  return (
    <section>
      <PageHeader title="Settings" />
      {!isAdmin && (
        <p className="mb-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
          You can see every setting. Only HR admins can change them.
        </p>
      )}
      {isAdmin && <StatementUpload />}
      {settings.isPending ? (
        <BlockSkeleton />
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : !settings.data.length ? (
        <EmptyState
          title="No settings available"
          description="Settings appear once the backend has started."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped(settings.data).map((section) => (
            <section key={section.title} id={sectionId(section.title)} className="scroll-mt-20">
              <h2 className="mb-1 text-lg font-normal tracking-tight">{section.title}</h2>
              {SECTION_HINTS[section.title] && (
                <p className="mb-2 text-sm text-muted-foreground">{SECTION_HINTS[section.title]}</p>
              )}
              {section.title === 'Teams and integrations' && <ContactGaps settings={settings.data} />}
              <div className="divide-y overflow-hidden panel">
                {section.items.map((item) => (
                  <SettingRow key={`${item.key}:${item.updated_at ?? ''}`} item={item} editable={isAdmin} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function StatementUpload() {
  const [file, setFile] = useState<File | null>(null);
  const fileUpload = useFileUpload('statement_of_understanding');
  const upload = useMutation({
    mutationFn: async (picked: File) => adminApi.uploadStatement(await fileUpload.mutateAsync(picked)),
    onSuccess: () => {
      showToast.success('Statement of Understanding updated');
      setFile(null);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <div className="mb-6 panel p-5 sm:p-6">
      <div className="mb-3 flex items-start gap-2">
        <FileUp className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-normal tracking-[-0.02em]">Statement of Understanding</h2>
          <p className="text-sm text-muted-foreground">
            This PDF is attached to every new joiner welcome email.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <FilePicker
            purpose="statement_of_understanding"
            file={file}
            onChange={setFile}
            uploading={upload.isPending}
            label="Replacement PDF"
          />
        </div>
        <Button onClick={() => file && upload.mutate(file)} disabled={!file || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Update PDF'}
        </Button>
      </div>
    </div>
  );
}

type Kind = 'boolean' | 'number' | 'clock' | 'text' | 'weekdays' | 'list' | 'pairs' | 'json';

function kindOf(key: string, value: unknown): Kind {
  if (WEEKDAY_KEYS.has(key)) return 'weekdays';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return CLOCK.test(value) ? 'clock' : 'text';
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return 'list';
  const entries = value && typeof value === 'object' ? Object.values(value) : [];
  if (entries.length && entries.every((entry) => typeof entry === 'string')) return 'pairs';
  return 'json';
}

function SettingRow({ item, editable }: { item: SettingItem; editable: boolean }) {
  const kind = kindOf(item.key, item.value);
  const [draft, setDraft] = useState<unknown>(item.value);
  const [jsonText, setJsonText] = useState(JSON.stringify(item.value, null, 2));
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const id = `setting-${item.key}`;

  const save = useMutation({
    mutationFn: (next: unknown) => adminApi.updateSettings({ [item.key]: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      showToast.success(`${settingLabel(item.key)} saved`);
      setError('');
    },
    onError: (reason) => setError(getErrorMessage(reason)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (kind === 'number') {
      const number = Number(draft);
      if (String(draft).trim() === '' || Number.isNaN(number)) {
        setError('Enter a number.');
        return;
      }
      save.mutate(number);
      return;
    }
    if (kind !== 'json') {
      save.mutate(draft);
      return;
    }
    try {
      save.mutate(JSON.parse(jsonText) as unknown);
    } catch {
      setError('Enter valid JSON for this setting.');
    }
  }

  const changed =
    kind === 'json'
      ? jsonText !== JSON.stringify(item.value, null, 2)
      : kind === 'number'
        ? String(draft) !== String(item.value)
        : JSON.stringify(draft) !== JSON.stringify(item.value);

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 p-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_auto] lg:items-start"
    >
      <div>
        <Label htmlFor={kind === 'weekdays' || kind === 'pairs' ? undefined : id}>
          {settingLabel(item.key)}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
      </div>
      <div className="min-w-0">
        <SettingEditor
          id={id}
          kind={kind}
          value={draft}
          jsonText={jsonText}
          disabled={!editable}
          hints={item.key === 'contacts' ? CONTACT_HINTS : undefined}
          onChange={setDraft}
          onJsonChange={setJsonText}
          onToggle={(checked) => {
            setDraft(checked);
            save.mutate(checked);
          }}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      {editable && kind !== 'boolean' && (
        <Button type="submit" variant="outline" size="sm" disabled={save.isPending || !changed}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      )}
    </form>
  );
}

interface EditorProps {
  id: string;
  kind: Kind;
  value: unknown;
  jsonText: string;
  disabled: boolean;
  hints?: Record<string, string>;
  onChange: (value: unknown) => void;
  onJsonChange: (value: string) => void;
  onToggle: (checked: boolean) => void;
}

function SettingEditor({
  id,
  kind,
  value,
  jsonText,
  disabled,
  hints,
  onChange,
  onJsonChange,
  onToggle,
}: EditorProps) {
  switch (kind) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Switch id={id} checked={Boolean(value)} disabled={disabled} onCheckedChange={onToggle} />
          <span className="text-sm text-muted-foreground">{value ? 'On' : 'Off'}</span>
        </div>
      );
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          step="any"
          inputMode="decimal"
          className="max-w-40 tabular-nums"
          value={String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'clock':
      return (
        <TimeField
          id={id}
          className="sm:w-40"
          value={String(value).slice(0, 5)}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case 'text':
      return (
        <Input
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'weekdays': {
      const days = new Set(value as number[]);
      return (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Weekdays</legend>
          {WEEKDAYS.map((day, index) => (
            <div key={day} className="flex items-center gap-1.5">
              <Checkbox
                id={`${id}-${index}`}
                checked={days.has(index)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...days, index].sort((a, b) => a - b)
                      : [...days].filter((entry) => entry !== index),
                  )
                }
              />
              <Label htmlFor={`${id}-${index}`} className="font-normal">
                {day}
              </Label>
            </div>
          ))}
        </fieldset>
      );
    }
    case 'list':
      return (
        <div>
          <Input
            id={id}
            defaultValue={(value as string[]).join(', ')}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              )
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">Separate entries with commas</p>
        </div>
      );
    case 'pairs': {
      const pairs = value as Record<string, string>;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(pairs).map(([key, entry]) => (
            <div key={key} className="flex flex-col gap-1">
              <Label htmlFor={`${id}-${key}`} className="text-xs font-normal text-muted-foreground">
                {settingLabel(key)}
              </Label>
              <Input
                id={`${id}-${key}`}
                value={entry}
                spellCheck={false}
                autoCapitalize="none"
                placeholder={hints ? 'team@tcgdigital.com…' : undefined}
                aria-describedby={hints?.[key] ? `${id}-${key}-hint` : undefined}
                disabled={disabled}
                onChange={(event) => onChange({ ...pairs, [key]: event.target.value })}
              />
              {hints?.[key] && (
                <p id={`${id}-${key}-hint`} className="text-xs text-muted-foreground">
                  {hints[key]}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
    default:
      return (
        <Textarea
          id={id}
          rows={4}
          value={jsonText}
          disabled={disabled}
          className="font-mono text-sm"
          onChange={(event) => onJsonChange(event.target.value)}
        />
      );
  }
}
