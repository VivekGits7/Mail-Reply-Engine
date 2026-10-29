import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/utils/cn';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

export function ThemeToggleBar({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const active = theme === 'dark' ? 'dark' : 'light';

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('grid grid-cols-2 gap-1 rounded-full bg-muted p-1', className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={active === value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            active === value
              ? 'bg-card text-foreground shadow-[var(--pill-shadow)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
