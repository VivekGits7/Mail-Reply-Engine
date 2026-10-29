import { useState } from 'react';
import { cn } from '@/utils/cn';
import { getInitials } from '@/utils/utility';

// Primary blue and success green only — red is reserved for errors, so an
// avatar never accidentally reads as "something's wrong with this person".
const HUES = [263, 152];

function hueFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return HUES[Math.abs(hash) % HUES.length];
}

const SIZES = {
  xs: 'size-6 text-[0.6rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-16 text-lg',
} as const;

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const hue = hueFor(name);
  // Photo links expire, so a failed load drops back to initials until a fresh link arrives.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setFailedSrc(src)}
        className={cn(
          'inline-block shrink-0 rounded-full object-cover ring-2 ring-card select-none',
          SIZES[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-white ring-2 ring-card select-none',
        SIZES[size],
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(circle at 30% 25%, oklch(0.82 0.12 ${hue}), oklch(0.58 0.17 ${hue}) 70%)`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}

interface AvatarStackProps {
  names: string[];
  total?: number;
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}

export function AvatarStack({ names, total, max = 3, size = 'md', className }: AvatarStackProps) {
  const shown = names.slice(0, max);
  const extra = (total ?? names.length) - shown.length;
  if (!shown.length) return null;
  return (
    <div className={cn('flex items-center -space-x-2.5', className)}>
      {shown.map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} size={size} />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center pill font-medium text-muted-foreground tabular-nums ring-2 ring-card',
            SIZES[size],
          )}
        >
          {extra > 99 ? '99+' : `${extra}+`}
        </span>
      )}
    </div>
  );
}
