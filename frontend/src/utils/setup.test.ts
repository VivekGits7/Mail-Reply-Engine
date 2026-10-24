import { describe, expect, it } from 'vitest';
import { missingContacts, setupSteps } from './setup';

const settings = (contacts: Record<string, string>) => [
  { key: 'contacts', value: contacts, description: 'Team and owner mailboxes' },
];

describe('setup', () => {
  it('lists empty team contacts but ignores optional ones', () => {
    const items = settings({ it_team: 'it@tcgdigital.com', finance_team: '', training_team: '' });
    expect(missingContacts(items)).toEqual(['finance_team']);
  });

  it('marks each step done from real data', () => {
    const steps = setupSteps({
      testInbox: 'hr-test@tcgdigital.com',
      settings: settings({ it_team: 'it@tcgdigital.com', training_team: '' }),
      joinerCount: 0,
    });
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['test_inbox', true],
      ['contacts', true],
      ['first_joiner', false],
    ]);
  });

  it('does not count contacts as done when the setting is missing', () => {
    const steps = setupSteps({ testInbox: '', settings: [], joinerCount: 2 });
    expect(steps.find((step) => step.id === 'contacts')?.done).toBe(false);
    expect(steps.find((step) => step.id === 'test_inbox')?.done).toBe(false);
  });
});
