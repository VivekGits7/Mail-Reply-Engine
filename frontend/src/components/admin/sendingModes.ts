import { FlaskConical, MailWarning, OctagonPause, Send, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/utils/labels';
import type { SendingMode } from '@/utils/systemState';

export const SENDING_MODE_ICONS: Record<SendingMode, LucideIcon> = {
  stopped: OctagonPause,
  held: MailWarning,
  test: FlaskConical,
  live: Send,
};

export const SENDING_MODE_LABELS: Record<SendingMode, string> = {
  stopped: 'Stopped',
  held: 'On hold',
  test: 'Dry run',
  live: 'Live',
};

export const TONE_SQUARE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-azure/12 text-azure',
  success: 'bg-mint/15 text-success',
  warning: 'bg-sun/30 text-sun-foreground dark:text-sun',
  danger: 'bg-ember/12 text-ember',
};
