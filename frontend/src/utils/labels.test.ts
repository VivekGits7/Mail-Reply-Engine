import { describe, expect, it } from 'vitest';
import {
  EMAIL_CATEGORY_LABELS,
  documentLabel,
  flagLabel,
  labelFrom,
  optionsFrom,
  stageHint,
  statusLabel,
} from './labels';

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

  it('explains what happens at each stage and labels raw values', () => {
    expect(stageHint('ready_for_signoff')).toContain('sign off');
    expect(stageHint('unknown_stage')).toBeUndefined();
    expect(labelFrom(EMAIL_CATEGORY_LABELS, 'doc_submission')).toBe('Documents sent');
    expect(labelFrom(EMAIL_CATEGORY_LABELS, 'new_category')).toBe('New category');
    expect(labelFrom(EMAIL_CATEGORY_LABELS, null)).toBe('—');
    expect(statusLabel('welcome_scheduled').label).toBe('Welcome scheduled');
    expect(statusLabel('skipped').label).toBe('Not read');
  });

  it('builds select options with custom labels first', () => {
    expect(optionsFrom({ CAMPUS: 'campus', DONE: 'done' }, { campus: 'Campus' })).toEqual([
      { value: 'campus', label: 'Campus' },
      { value: 'done', label: 'Done' },
    ]);
  });
});
