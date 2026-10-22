import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { JoinerFormDialog } from './JoinerFormDialog';

const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('./Joinersapi', () => ({ joinerKeys: { all: ['joiners'] }, joinersApi: { create, update } }));
vi.mock('@/utils/toast', () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

const PERSON = {
  person_id: 'p1',
  full_name: 'Rahul Sharma',
  personal_email: 'rahul.sharma@gmail.com',
  recruiter_email: 'recruiter@tcgdigital.com',
  hire_category: 'lateral',
  location: 'Kolkata',
  level: 'L4',
  joining_date: '2026-11-21',
  date_of_birth: '1990-02-20',
  manager_name: 'Amit Roy',
  manager_email: 'amit.roy@tcgdigital.com',
  role: 'candidate',
  status: 'active',
};

describe('JoinerFormDialog', () => {
  beforeEach(() => {
    create.mockReset();
    update.mockReset();
  });

  it('validates the level and sends a clean create payload', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ data: { case_id: 'c1' } });
    renderWithProviders(<JoinerFormDialog trigger={<button type="button">Add joiner</button>} />);
    await user.click(screen.getByRole('button', { name: 'Add joiner' }));
    await user.type(screen.getByLabelText('Level'), 'senior');
    await user.click(screen.getByRole('button', { name: 'Add joiner and send request' }));
    expect(await screen.findByText('Level must look like L4')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Level'));
    await user.type(screen.getByLabelText('Level'), 'l4');
    await user.type(screen.getByLabelText('Full name'), '  Rahul Sharma ');
    await user.type(screen.getByLabelText('Personal email'), 'rahul.sharma@gmail.com');
    await user.type(screen.getByLabelText('Base location'), 'Kolkata');
    await user.type(screen.getByLabelText('Joining date'), '2026-11-21');
    await user.type(screen.getByLabelText('Date of birth'), '1990-02-20');
    await user.type(screen.getByLabelText('Recruiter email'), 'recruiter@tcgdigital.com');
    await user.type(screen.getByLabelText('Reporting manager'), 'Amit Roy');
    await user.type(screen.getByLabelText('Manager email'), 'amit.roy@tcgdigital.com');
    await user.click(screen.getByRole('button', { name: 'Add joiner and send request' }));
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toEqual({
      full_name: 'Rahul Sharma',
      personal_email: 'rahul.sharma@gmail.com',
      recruiter_email: 'recruiter@tcgdigital.com',
      hire_category: 'lateral',
      location: 'Kolkata',
      level: 'L4',
      joining_date: '2026-11-21',
      date_of_birth: '1990-02-20',
      manager_name: 'Amit Roy',
      manager_email: 'amit.roy@tcgdigital.com',
    });
  });

  it('sends only the changed fields when editing', async () => {
    const user = userEvent.setup();
    update.mockResolvedValue({ data: { rechecked_documents: 2 } });
    renderWithProviders(
      <JoinerFormDialog person={PERSON} caseId="c1" trigger={<button type="button">Edit details</button>} />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit details' }));
    expect(screen.queryByLabelText('Hire type')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Base location'));
    await user.type(screen.getByLabelText('Base location'), 'Pune');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('p1', { location: 'Pune' }));
  });
});
