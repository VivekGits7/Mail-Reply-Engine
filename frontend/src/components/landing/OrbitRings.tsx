import {
  BellRing,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Laptop,
  Mail,
  MessageCircleHeart,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { cn } from '@/utils/cn';
import { EASE_FLUID } from '@/utils/animations';

const SIZE = 1400;
const CENTER = SIZE / 2;
const RINGS = [250, 390, 530, 670];

const BUBBLES: { icon: LucideIcon; tone: VisualTone; ring: number; angle: number; label: string }[] = [
  { icon: Mail, tone: 'azure', ring: 1, angle: 208, label: 'HR mailbox' },
  { icon: CalendarDays, tone: 'iris', ring: 1, angle: 332, label: 'Calendar' },
  { icon: FileText, tone: 'ember', ring: 2, angle: 186, label: 'Documents' },
  { icon: FileSpreadsheet, tone: 'mint', ring: 2, angle: 354, label: 'Excel lists' },
  { icon: Laptop, tone: 'azure', ring: 2, angle: 150, label: 'IT team' },
  { icon: WalletCards, tone: 'sun', ring: 2, angle: 30, label: 'Finance team' },
  { icon: Users, tone: 'iris', ring: 3, angle: 200, label: 'Managers' },
  { icon: BellRing, tone: 'sun', ring: 3, angle: 340, label: 'Reminders' },
  { icon: ShieldCheck, tone: 'mint', ring: 3, angle: 160, label: 'Privacy' },
  { icon: MessageCircleHeart, tone: 'ember', ring: 3, angle: 20, label: 'Feedback' },
];

export function OrbitRings({ className, bubbles = true }: { className?: string; bubbles?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2', className)}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0">
        <defs>
          <radialGradient id="orbit-fade" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="orbit-mask">
            <rect width={SIZE} height={SIZE} fill="url(#orbit-fade)" />
          </mask>
        </defs>
        <g mask="url(#orbit-mask)">
          {RINGS.map((radius) => (
            <circle
              key={radius}
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              className="stroke-border"
              strokeWidth="1.2"
            />
          ))}
          {RINGS.map((radius, index) => (
            <circle
              key={`arc-${radius}`}
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.55}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray={`${70 + index * 30} ${radius * 2 * Math.PI}`}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: reduced
                  ? undefined
                  : `orbit ${50 + index * 18}s linear infinite${index % 2 ? ' reverse' : ''}`,
              }}
            />
          ))}
        </g>
      </svg>
      {bubbles &&
        BUBBLES.map((bubble, index) => {
          const Icon = bubble.icon;
          const radians = (bubble.angle * Math.PI) / 180;
          const x = CENTER + RINGS[bubble.ring] * Math.cos(radians);
          const y = CENTER + RINGS[bubble.ring] * Math.sin(radians);
          return (
            <motion.span
              key={bubble.label}
              className="absolute -translate-x-1/2 -translate-y-1/2 max-sm:hidden"
              style={{ left: x, top: y }}
              initial={reduced ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.06, ease: EASE_FLUID }}
            >
              <span
                className="flex size-14 animate-orb-float items-center justify-center rounded-full glass"
                style={{ animationDelay: `${-index * 0.7}s`, animationDuration: `${6 + (index % 4)}s` }}
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full',
                    TONE_STYLES[bubble.tone].soft,
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </span>
            </motion.span>
          );
        })}
    </div>
  );
}
