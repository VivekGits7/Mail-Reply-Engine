import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { ApprovalListItem } from '@/types';
import Approvals from './Approvals';
import { approvalsApi } from './Approvalsapi';

const list = vi.spyOn(approvalsApi, 'list');
const approval: ApprovalListItem = {
  approval_id: 'f65b9040-e49a-4392-a189-519d903eb3d8',
  approval_type: 'reply',
  status: 'pending',
  person_name: 'Actual person',
  summary: 'Actual draft',
};

describe('Approvals with server data', () => {
  beforeEach(() => list.mockReset());

  it('shows the empty state when the backend has no approvals', async () => {
    list.mockResolvedValue({
      success: true,
      message: 'Found 0 approvals',
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    renderWithProviders(<Approvals />);
    expect(await screen.findByText('No approvals match these filters')).toBeInTheDocument();
    expect(screen.queryByText(/Sample/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows only returned records without padding the table', async () => {
    list.mockResolvedValue({
      success: true,
      message: 'Found 1 approval',
      data: [approval],
      total: 1,
      limit: 20,
      offset: 0,
    });
    renderWithProviders(<Approvals />);
    expect(await screen.findByText('Actual draft')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByText(/Sample/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View draft' })).toHaveAttribute(
      'href',
      `/approvals/${approval.approval_id}`,
    );
  });
});
