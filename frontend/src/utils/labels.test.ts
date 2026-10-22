import { describe, expect, it } from 'vitest';
import { documentLabel, flagLabel, optionsFrom, statusLabel } from './labels';

describe('labels', () => {
  it('maps backend statuses to a label and a tone', () => {
    expect(statusLabel('ready_for_signoff')).toEqual({ label: 'Ready for sign-off', tone: 'warning' });
    expect(statusLabel('verified').tone).toBe('success');
    expect(statusLabel('brand_new_state')).toEqual({ label: 'Brand new state', tone: 'neutral' });
    expect(statusLabel(null).label).toBe('—');
  });

  it('shows documents and flags the way HR writes them', () => {
    expect(documentLabel('pan_card')).toBe('PAN card');
    expect(documentLabel('class_10_certificate')).toBe('Class 10 certificate');
    expect(documentLabel('offer_letter')).toBe('Offer letter');
    expect(flagLabel('sender_not_recognised')).toBe('Unknown sender');
  });

  it('builds select options with custom labels first', () => {
    expect(optionsFrom({ CAMPUS: 'campus', DONE: 'done' }, { campus: 'Campus' })).toEqual([
      { value: 'campus', label: 'Campus' },
      { value: 'done', label: 'Done' },
    ]);
  });
});
