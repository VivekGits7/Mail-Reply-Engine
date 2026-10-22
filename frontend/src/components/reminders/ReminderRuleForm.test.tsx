import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ReminderRuleForm } from './ReminderRuleForm';

const createRule = vi.hoisted(() => vi.fn());
vi.mock('./Remindersapi', () => ({
  reminderKeys: { all: ['reminders'] },
  remindersApi: { createRule, updateRule: vi.fn() },
}));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

describe('ReminderRuleForm', () => {
  beforeEach(() => createRule.mockReset());

  it('shows field errors and creates a valid reminder rule', async () => {
    const user = userEvent.setup();
    createRule.mockResolvedValue({ data: {} });
    renderWithProviders(<ReminderRuleForm trigger={<button type="button">Create rule</button>} />);
    await user.click(screen.getByRole('button', { name: 'Create rule' }));
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(await screen.findByText('Enter a rule name')).toBeInTheDocument();
    expect(createRule).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Rule name' }), 'Timesheet');
    await user.type(screen.getByRole('textbox', { name: 'Rule key' }), 'timesheet');
    await user.type(screen.getByRole('textbox', { name: 'Recipient column' }), 'employee_email');
    await user.type(screen.getByRole('textbox', { name: 'Required columns' }), 'employee_email, item');
    await user.type(screen.getByRole('textbox', { name: 'Template key' }), 'reminder_timesheet');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        rule_key: 'timesheet',
        required_columns: ['employee_email', 'item'],
        followup_gap_hours: 48,
      }),
    );
  });
});
