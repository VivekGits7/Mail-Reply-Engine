import { describe, expect, it } from 'vitest';
import { describeCron } from './cron';

describe('describeCron', () => {
  it('reads weekly, weekday and daily schedules', () => {
    expect(describeCron('0 10 * * MON')).toBe('Every Monday at 10:00 IST');
    expect(describeCron('30 9 * * MON-FRI')).toBe('Every weekday at 09:30 IST');
    expect(describeCron('0 9 * * 1,3')).toBe('Every Monday and Wednesday at 09:00 IST');
    expect(describeCron('0 18 * * *')).toBe('Every day at 18:00 IST');
  });

  it('reads monthly schedules', () => {
    expect(describeCron('0 10 1 * *')).toBe('On the 1st of every month at 10:00 IST');
    expect(describeCron('0 10 22 * *')).toBe('On the 22nd of every month at 10:00 IST');
  });

  it('falls back to the raw value for anything unusual', () => {
    expect(describeCron('*/15 * * * *')).toBe('Custom schedule */15 * * * *');
    expect(describeCron('bad')).toBe('Custom schedule bad');
    expect(describeCron(null)).toBe('No schedule');
  });
});
