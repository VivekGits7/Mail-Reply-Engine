import type { SettingItem } from '@/types';

export const CONTACT_HINTS: Record<string, string> = {
  it_team: 'Gets the email ID and D365 request for joiners, and IT exit clearance',
  onboarding_group: 'Told when a joiner is ready to start',
  offboarding_group: 'Told when an exit starts',
  hr_onboarding_team: 'Kept in CC on document requests and reminders',
  hr_onboarding_owner: 'Gets IT follow-ups that need escalating',
  recruitment_team: 'Told when a joiner looks like a dropout',
  finance_team: 'Chased for Finance exit clearance',
  admin_team: 'Chased for Admin exit clearance',
  hr_owner: 'Gets alerts, escalations and low survey scores',
  complaints_owner: 'Told when a new complaint arrives, without its content',
  performance_team: 'Kept informed on appraisal reminders',
  training_team: 'Owns training reminders, optional for now',
};

const OPTIONAL_CONTACTS = new Set(['training_team']);

export function contactsOf(settings: SettingItem[]): Record<string, string> {
  const value = settings.find((item) => item.key === 'contacts')?.value;
  return value && typeof value === 'object' ? (value as Record<string, string>) : {};
}

export function missingContacts(settings: SettingItem[]): string[] {
  return Object.entries(contactsOf(settings))
    .filter(([key, email]) => !OPTIONAL_CONTACTS.has(key) && !String(email ?? '').trim())
    .map(([key]) => key);
}

export function requiredContactCount(settings: SettingItem[]): number {
  return Object.keys(contactsOf(settings)).filter((key) => !OPTIONAL_CONTACTS.has(key)).length;
}

export type SetupStepId = 'test_inbox' | 'contacts' | 'first_joiner';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
}

export function setupSteps({
  testInbox,
  settings,
  joinerCount,
}: {
  testInbox: string;
  settings: SettingItem[];
  joinerCount: number;
}): SetupStep[] {
  return [
    { id: 'test_inbox', done: Boolean(testInbox.trim()) },
    { id: 'contacts', done: requiredContactCount(settings) > 0 && missingContacts(settings).length === 0 },
    { id: 'first_joiner', done: joinerCount > 0 },
  ];
}
