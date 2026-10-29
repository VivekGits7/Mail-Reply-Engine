import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeMenu } from './ThemeMenu';

beforeAll(() => {
  // jsdom has no matchMedia and next-themes reads it to follow the system theme.
  window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe('ThemeMenu', () => {
  it('defaults to light, offers dark and system, and remembers the pick', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider storageKey="theme-test">
        <ThemeMenu />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Theme: Light' }));
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(await screen.findByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
    expect(localStorage.getItem('theme-test')).toBe('dark');
  });
});
