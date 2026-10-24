import { useQuery } from '@tanstack/react-query';
import { Angry, Flag, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { MiniStat } from '@/components/visual/Breakdown';
import { RadialProgress } from '@/components/visual/RadialProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { EASE_FLUID, riseIn, staggerParent } from '@/utils/animations';
import { SurveyStatus } from '@/types';
import { surveyListQuery } from './Feedbackapi';

const MAX_SCORE = 5;
const SAMPLE_LIMIT = 100;

const MOODS: { label: string; icon: LucideIcon; upTo: number }[] = [
  { label: 'Terrible', icon: Angry, upTo: 1.5 },
  { label: 'Bad', icon: Frown, upTo: 2.5 },
  { label: 'Okay', icon: Meh, upTo: 3.5 },
  { label: 'Good', icon: Smile, upTo: 4.5 },
  { label: 'Great', icon: Laugh, upTo: Infinity },
];

function moodIndex(score: number) {
  return MOODS.findIndex((mood) => score < mood.upTo);
}

interface FeedbackStatsProps {
  flagged: boolean;
  onFlagged: (active: boolean) => void;
}

export function FeedbackStats({ flagged, onFlagged }: FeedbackStatsProps) {
  const reduced = useReducedMotion();
  const sent = useQuery(surveyListQuery({ limit: 1, offset: 0 }));
  const responded = useQuery(
    surveyListQuery({
      status: SurveyStatus.RESPONDED,
      sort_by: 'sent_at',
      sort_order: 'latest',
      limit: SAMPLE_LIMIT,
      offset: 0,
    }),
  );
  const lowScores = useQuery(surveyListQuery({ flagged: true, limit: 1, offset: 0 }));

  const scores = (responded.data?.data ?? []).flatMap((item) => (item.score == null ? [] : [item.score]));
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : undefined;
  const counts = MOODS.map((_, index) => scores.filter((score) => moodIndex(score) === index).length);
  const loading = sent.isPending || responded.isPending;
  const position = average === undefined ? 0 : Math.min(1, Math.max(0, (average - 1) / (MAX_SCORE - 1)));

  return (
    <motion.section
      variants={staggerParent}
      initial="hidden"
      animate="show"
      aria-label="Survey summary"
      className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <motion.div variants={riseIn} className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-normal tracking-[-0.02em]">Joiner mood</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Average of the last {scores.length || 'few'} survey scores, out of {MAX_SCORE}.
            </p>
          </div>
          <div className="text-[2.75rem] leading-none font-light tracking-[-0.04em] tabular-nums">
            {loading ? <Skeleton className="h-11 w-20" /> : average === undefined ? '—' : average.toFixed(1)}
          </div>
        </div>

        <div
          className="relative mt-7 h-3"
          role="img"
          aria-label={
            average === undefined ? 'No scores yet' : `Average score ${average.toFixed(1)} of ${MAX_SCORE}`
          }
        >
          <div className="absolute inset-0 flex gap-1.5">
            {MOODS.map((mood, index) => (
              <span
                key={mood.label}
                className={cn(
                  'h-full flex-1 rounded-full',
                  average !== undefined && index <= moodIndex(average) ? 'bg-ember' : 'bg-muted',
                )}
              />
            ))}
          </div>
          {average !== undefined && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={reduced ? false : { x: '0%' }}
              animate={{ x: `${position * 100}%` }}
              transition={{ duration: 0.8, ease: EASE_FLUID }}
            >
              <span className="absolute top-1/2 left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ember bg-card shadow-md" />
            </motion.div>
          )}
        </div>

        <ul className="mt-5 grid grid-cols-5 gap-2 text-center">
          {MOODS.map((mood, index) => {
            const Icon = mood.icon;
            const current = average !== undefined && moodIndex(average) === index;
            return (
              <li key={mood.label} className="flex flex-col items-center gap-1">
                <Icon
                  className={cn(
                    'size-6 transition-colors',
                    current ? 'text-ember' : 'text-muted-foreground/70',
                  )}
                  aria-hidden="true"
                />
                <span className={cn('text-xs', current ? 'font-medium' : 'text-muted-foreground')}>
                  {mood.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{counts[index]}</span>
              </li>
            );
          })}
        </ul>
      </motion.div>

      <motion.div variants={riseIn} className="grid grid-cols-2 gap-4 lg:w-[22rem]">
        <div className="flex min-h-36 flex-col items-start panel p-4">
          <RadialProgress
            value={responded.data?.total ?? 0}
            max={sent.data?.total ?? 0}
            label="Surveys answered"
            tone="mint"
            size={52}
            stroke={6}
          />
          <span className="mt-auto pt-4 text-xs text-muted-foreground">Response rate</span>
          <span className="text-3xl leading-tight font-light tracking-[-0.03em] tabular-nums">
            {loading ? '–' : `${responded.data?.total ?? 0}/${sent.data?.total ?? 0}`}
          </span>
        </div>
        <MiniStat
          label="Low scores flagged"
          icon={Flag}
          tone="ember"
          value={lowScores.data?.total}
          loading={lowScores.isPending}
          active={flagged}
          onClick={() => onFlagged(!flagged)}
        />
      </motion.div>
    </motion.section>
  );
}
