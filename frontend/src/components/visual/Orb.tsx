import { cn } from '@/utils/cn';

export function Orb({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative size-28', className)}>
      <div className="absolute inset-2 rounded-full bg-primary/40 blur-2xl" />
      <div
        className="absolute inset-0 animate-orb-float rounded-full shadow-[inset_-10px_-14px_30px_rgb(0_0_0/0.12),0_20px_40px_-20px_var(--primary)]"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 32% 28%, oklch(1 0 0 / 0.95) 0 8%, transparent 26%)',
            'radial-gradient(circle at 70% 78%, color-mix(in oklch, var(--primary), white 55%) 0, transparent 45%)',
            'radial-gradient(circle at 45% 45%, color-mix(in oklch, var(--primary), white 35%), var(--primary) 72%, color-mix(in oklch, var(--primary), black 25%))',
          ].join(','),
        }}
      />
    </div>
  );
}
