import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('hides itself when everything fits on one page', () => {
    const { container } = render(<Pagination total={10} limit={25} offset={0} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the range and moves between pages', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination total={60} limit={25} offset={25} onChange={onChange} />);
    expect(screen.getByText('26–50 of 60')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenCalledWith(50);
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disables next on the last page', () => {
    render(<Pagination total={60} limit={25} offset={50} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
