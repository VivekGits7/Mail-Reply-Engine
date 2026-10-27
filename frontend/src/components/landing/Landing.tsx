import { useRef, type ReactNode } from 'react';
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CircleCheck,
  DoorOpen,
  Eye,
  FlaskConical,
  Inbox,
  LockKeyhole,
  Mail,
  MessageCircleHeart,
  MessageSquareWarning,
  OctagonPause,
  ScanSearch,
  ScrollText,
  UserPlus,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion, useScroll } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import { selectIsAuthenticated } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { PageTitle } from '@/components/common/PageHeader';
import { ThemeMenu } from '@/components/common/ThemeMenu';
import { Orb } from '@/components/visual/Orb';
import { TONE_STYLES, type VisualTone } from '@/components/visual/tones';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { EASE_FLUID, riseIn, staggerParent } from '@/utils/animations';
import { AgentStory } from './AgentStory';
import { NotificationStack } from './NotificationStack';
import { OrbitRings } from './OrbitRings';
import {
  ComplaintsVisual,
  ExitVisual,
  FeedbackVisual,
  InductionVisual,
  OnboardingVisual,
  RemindersVisual,
} from './WorkflowVisuals';

const WRAP = 'mx-auto w-full max-w-[1760px] px-5 sm:px-8 lg:px-12';

const SECTIONS = [
  { id: 'how', label: 'How it works' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'safety', label: 'Safety' },
];

const STEPS: { icon: LucideIcon; title: string; text: string; tone: VisualTone }[] = [
  {
    icon: Inbox,
    title: 'Read',
    text: 'Watches the HR mailbox in Microsoft 365, checks it every two minutes as a backup and skips spam and auto replies.',
    tone: 'azure',
  },
  {
    icon: ScanSearch,
    title: 'Understand',
    text: 'Masks personal data, sorts each email into one of eight types and finds the joiner or exit it belongs to.',
    tone: 'iris',
  },
  {
    icon: Workflow,
    title: 'Act',
    text: 'Checks documents, chases teams and plans inductions. Replies are drafted for HR to approve, and emails it is unsure about are left for a person.',
    tone: 'mint',
  },
];

const FLOWS: {
  icon: LucideIcon;
  tone: VisualTone;
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  visual: ReactNode;
}[] = [
  {
    icon: UserPlus,
    tone: 'azure',
    eyebrow: 'Onboarding · before day one',
    title: 'Documents collected, checked and signed off',
    text: 'The moment HR adds a joiner, the agent emails the document checklist, reads every attachment that comes back and checks the name on each one.',
    points: [
      'Follows up until every document is in',
      'Flags name mismatches and salary documents',
      'Sign-off sends the IT setup request',
    ],
    visual: <OnboardingVisual />,
  },
  {
    icon: DoorOpen,
    tone: 'ember',
    eyebrow: 'Exits · when someone leaves',
    title: 'Clearances chased with every team',
    text: 'Start an exit and the agent asks IT, Finance, Admin and the manager for clearance, reads their replies and keeps chasing until all four are done.',
    points: [
      'Reads each team’s clearance reply',
      'Escalates when a team goes quiet',
      'Ready for release once everyone clears',
    ],
    visual: <ExitVisual />,
  },
  {
    icon: BookOpenCheck,
    tone: 'iris',
    eyebrow: 'Induction · the first week',
    title: 'Induction planned around real calendars',
    text: 'The agent drafts a session plan for each joiner. Once HR approves it, session owners are asked for times before the invites go out.',
    points: [
      'Plans around holidays and working hours',
      'Asks owners for their availability',
      'Books the calendar invites once agreed',
    ],
    visual: <InductionVisual />,
  },
  {
    icon: BellRing,
    tone: 'sun',
    eyebrow: 'Reminders · every month',
    title: 'Recurring nudges without the spreadsheet chasing',
    text: 'Upload a list for timesheets, appraisals, leave approvals or training and the agent reminds each person on schedule.',
    points: [
      'Pauses people who are on leave',
      'Questions in replies go to Approvals',
      'Escalates unanswered reminders once',
    ],
    visual: <RemindersVisual />,
  },
  {
    icon: MessageCircleHeart,
    tone: 'mint',
    eyebrow: 'Feedback · 30, 60 and 90 days',
    title: 'Hear from new joiners while it still matters',
    text: 'Surveys go out at each milestone, responses are imported and low scores are flagged so HR can step in early.',
    points: [
      'A survey link for each hire type',
      'Low scores alert HR right away',
      'Period reports for leadership',
    ],
    visual: <FeedbackVisual />,
  },
  {
    icon: MessageSquareWarning,
    tone: 'ember',
    eyebrow: 'Complaints · handled with care',
    title: 'Sensitive concerns, kept private',
    text: 'Complaints from email, exit interviews and HR Connect land in a restricted area that only the people HR chooses can open.',
    points: [
      'Access is granted person by person',
      'Kept off the shared dashboards',
      'Interview transcripts can be uploaded',
    ],
    visual: <ComplaintsVisual />,
  },
];

const SAFETY: { icon: LucideIcon; title: string; text: string; tone: VisualTone }[] = [
  {
    icon: Eye,
    title: 'A person approves',
    text: 'Every reply the agent drafts and every induction plan waits in Approvals until someone signs off.',
    tone: 'azure',
  },
  {
    icon: OctagonPause,
    title: 'Kill switch',
    text: 'One switch stops every outgoing email in under a minute. Reading mail carries on.',
    tone: 'ember',
  },
  {
    icon: FlaskConical,
    title: 'Dry run',
    text: 'Send everything to a test inbox first, with the real recipients shown in the subject line.',
    tone: 'sun',
  },
  {
    icon: LockKeyhole,
    title: 'Private by design',
    text: 'Personal data is masked before the AI sees it, and stored details are encrypted.',
    tone: 'iris',
  },
  {
    icon: ScrollText,
    title: 'Full audit log',
    text: 'Every action by the agent, the system or an admin is recorded with who did it and when.',
    tone: 'mint',
  },
];

function scrollToSection(id: string, smooth: boolean) {
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

function Reveal({
  children,
  className,
  delay = 0,
  from = 'bottom',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: 'bottom' | 'left' | 'right';
}) {
  const reduced = useReducedMotion();
  const offset = from === 'left' ? { x: -36 } : from === 'right' ? { x: 36 } : { y: 28 };
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-90px 0px' }}
      transition={{ duration: 0.7, delay, ease: EASE_FLUID }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center pill px-3.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <Reveal className="mx-auto mb-10 max-w-3xl text-center lg:mb-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-[2.4rem] leading-[1.05] font-normal tracking-[-0.04em] text-balance sm:text-6xl">
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{text}</p>
    </Reveal>
  );
}

function PrimaryCta({ to, label, size = 'lg' }: { to: string; label: string; size?: 'lg' | 'default' }) {
  return (
    <Button asChild size={size}>
      <Link to={to}>
        {label}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

function Hero({ cta }: { cta: { to: string; label: string } }) {
  const reduced = useReducedMotion();
  return (
    <section className="relative isolate overflow-hidden">
      <OrbitRings className="top-[23rem] -translate-y-1/2 scale-[0.55] sm:scale-75 lg:top-[25rem] lg:scale-100" />
      <motion.div
        variants={staggerParent}
        initial={reduced ? false : 'hidden'}
        animate="show"
        className={cn(WRAP, 'relative flex flex-col items-center pt-32 pb-14 text-center sm:pt-40')}
      >
        <motion.h1
          variants={riseIn}
          className="max-w-4xl text-[2.6rem] leading-[1] font-normal tracking-[-0.05em] text-balance sm:text-7xl lg:text-[6rem]"
        >
          Your HR inbox, <span className="text-primary">handled.</span>
        </motion.h1>
        <motion.p
          variants={riseIn}
          className="mt-7 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl"
        >
          HR Desk reads the HR mailbox, collects joiner documents, chases exit clearances and drafts replies
          to questions. Every reply waits for HR to approve it.
        </motion.p>
        <motion.div variants={riseIn} className="mt-9 flex flex-wrap justify-center gap-3">
          <PrimaryCta to={cta.to} label={cta.label} />
          <Button variant="outline" size="lg" onClick={() => scrollToSection('how', !reduced)}>
            See how it works
          </Button>
        </motion.div>
        <motion.div variants={riseIn} className="mt-14 w-full">
          <NotificationStack />
        </motion.div>
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className={cn(WRAP, 'scroll-mt-28 py-24 lg:py-36')}>
      <Reveal from="left">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-5 text-[2.4rem] leading-[1.05] font-normal tracking-[-0.04em] text-balance sm:text-6xl">
          Read, understand, act
        </h2>
        <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          The agent works the same way on every message, so HR always knows what happened and why.
        </p>
      </Reveal>
      <div className="mt-12 grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-28">
        <div>
          <ol className="relative flex flex-col gap-10">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} from="left" delay={0.1 + index * 0.12}>
                  <li className="relative flex gap-6">
                    {index < STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-14 -bottom-10 left-7 w-px -translate-x-1/2"
                        style={{
                          backgroundImage: `linear-gradient(var(--${step.tone}), var(--${STEPS[index + 1].tone}))`,
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex size-14 shrink-0 items-center justify-center pill rounded-full',
                        TONE_STYLES[step.tone].text,
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="pt-1">
                      <span className="text-sm text-muted-foreground tabular-nums">Step {index + 1}</span>
                      <span className="mt-0.5 block text-2xl font-normal tracking-[-0.02em]">
                        {step.title}
                      </span>
                      <span className="mt-2 block max-w-lg text-base text-pretty text-muted-foreground">
                        {step.text}
                      </span>
                    </span>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
        <Reveal from="right" className="relative flex justify-center">
          <div aria-hidden="true" className="absolute inset-10 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative w-full max-w-md min-w-0">
            <AgentStory />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WorkflowFlow() {
  const reduced = useReducedMotion();
  const spine = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: spine, offset: ['start 70%', 'end 60%'] });

  return (
    <section id="workflows" className={cn(WRAP, 'scroll-mt-28 pb-24 lg:pb-36')}>
      <SectionIntro
        eyebrow="Workflows"
        title="From the offer to the last day"
        text="Six HR workflows run on the same desk. Follow the flow from a new joiner’s first email to a leaver’s final clearance."
      />
      <div ref={spine} className="relative">
        <span aria-hidden="true" className="absolute top-0 bottom-0 left-5 w-px bg-border lg:left-1/2" />
        <motion.span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-5 w-0.5 origin-top -translate-x-1/4 rounded-full bg-linear-to-b from-azure via-iris to-mint lg:left-1/2"
          style={{ scaleY: reduced ? 1 : scrollYProgress }}
        />
        {FLOWS.map((flow, index) => {
          const Icon = flow.icon;
          const flip = index % 2 === 1;
          return (
            <div
              key={flow.title}
              className="relative grid grid-cols-1 items-center gap-8 py-12 pl-12 lg:grid-cols-2 lg:gap-32 lg:py-24 lg:pl-0"
            >
              <Reveal className="absolute top-12 left-5 z-10 -translate-x-1/2 lg:top-1/2 lg:left-1/2 lg:-translate-y-1/2">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center pill rounded-full lg:size-14',
                    TONE_STYLES[flow.tone].text,
                  )}
                >
                  <Icon className="size-5 lg:size-6" aria-hidden="true" />
                </span>
              </Reveal>
              <Reveal from={flip ? 'right' : 'left'} className={cn(flip && 'lg:order-2')}>
                <span className="text-sm font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, '0')} · {flow.eyebrow}
                </span>
                <h3 className="mt-4 text-[1.75rem] leading-[1.08] font-normal tracking-[-0.035em] text-balance sm:text-5xl">
                  {flow.title}
                </h3>
                <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
                  {flow.text}
                </p>
                <ul className="mt-7 flex flex-col gap-3">
                  {flow.points.map((point) => (
                    <li key={point} className="flex items-center gap-3 text-sm sm:text-base">
                      <CircleCheck
                        className={cn('size-5 shrink-0', TONE_STYLES[flow.tone].text)}
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal
                from={flip ? 'left' : 'right'}
                delay={0.1}
                className={cn('min-w-0', flip && 'lg:order-1')}
              >
                {flow.visual}
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Safety() {
  return (
    <section id="safety" className={cn(WRAP, 'scroll-mt-28 pb-24 lg:pb-36')}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-28">
        <Reveal from="left" className="lg:sticky lg:top-32 lg:self-start">
          <Eyebrow>Safety</Eyebrow>
          <h2 className="mt-5 text-[2.4rem] leading-[1.05] font-normal tracking-[-0.04em] text-balance sm:text-6xl">
            Careful by default
          </h2>
          <p className="mt-5 max-w-lg text-lg text-pretty text-muted-foreground">
            An agent that emails candidates and teams needs guard rails. These are switched on from day one,
            and admins control them from one screen.
          </p>
        </Reveal>
        <ul className="divide-y divide-border">
          {SAFETY.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="py-7 first:pt-0 last:pb-0">
                <Reveal from="right" delay={index * 0.06} className="flex gap-6">
                  <span
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                      TONE_STYLES[item.tone].soft,
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-2xl font-normal tracking-[-0.02em]">{item.title}</span>
                    <span className="mt-1.5 block max-w-xl text-base text-pretty text-muted-foreground">
                      {item.text}
                    </span>
                  </span>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Closing({ cta, signedIn }: { cta: { to: string; label: string }; signedIn: boolean }) {
  return (
    <section className="relative isolate overflow-hidden py-32 lg:py-44">
      <OrbitRings bubbles={false} className="top-1/2 -translate-y-1/2 scale-[0.6] sm:scale-90" />
      <Reveal className={cn(WRAP, 'relative flex flex-col items-center text-center')}>
        <Orb className="size-32" />
        <h2 className="mt-10 max-w-3xl text-[2.4rem] leading-[1.05] font-normal tracking-[-0.04em] text-balance sm:text-6xl">
          Ready when your inbox is
        </h2>
        <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          Open the desk to see who is joining, who is leaving and what is waiting for you today.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <PrimaryCta to={cta.to} label={cta.label} />
          {signedIn && (
            <Button asChild size="lg" variant="outline">
              <Link to="/approvals">Review approvals</Link>
            </Button>
          )}
        </div>
      </Reveal>
    </section>
  );
}

export default function Landing() {
  const signedIn = useAppSelector(selectIsAuthenticated);
  const reduced = useReducedMotion();
  const [params] = useSearchParams();
  const next = params.get('next');
  const signIn = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  const cta = signedIn ? { to: '/', label: 'Open the desk' } : { to: signIn, label: 'Sign in' };

  return (
    <div className="relative min-h-svh overflow-x-clip text-foreground">
      <PageTitle title="Welcome" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] overflow-hidden"
      >
        <div className="absolute -top-48 -left-40 size-[40rem] animate-drift rounded-full bg-azure/16 blur-3xl max-sm:animate-none dark:bg-iris/14" />
        <div
          className="absolute top-32 -right-48 size-[36rem] animate-drift rounded-full bg-iris/14 blur-3xl max-sm:animate-none dark:bg-azure/10"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      <header className="sticky top-3 z-40 px-3 sm:top-4 sm:px-4 lg:px-5">
        <nav
          aria-label="Landing"
          className="flex w-full items-center gap-3 rounded-full glass py-2 pr-2 pl-2.5 sm:pl-3"
        >
          <Link
            to="/welcome"
            className="flex shrink-0 items-center gap-2.5 rounded-full pr-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]">
              <Mail className="size-[1.1rem]" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight font-semibold tracking-tight whitespace-nowrap">
              HR Desk
              <span className="hidden text-xs font-normal text-muted-foreground sm:block">
                Mail Reply Engine
              </span>
            </span>
          </Link>
          <div className="mx-auto hidden items-center gap-1 md:flex">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id, !reduced)}
                className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {section.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeMenu
              iconClassName="size-4"
              className="flex size-10 items-center justify-center pill rounded-full text-foreground/80 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <PrimaryCta to={cta.to} label={cta.label} size="default" />
          </div>
        </nav>
      </header>

      <main>
        <Hero cta={cta} />
        <HowItWorks />
        <WorkflowFlow />
        <Safety />
        <Closing cta={cta} signedIn={signedIn} />
      </main>

      <footer className="border-t border-border/70">
        <div
          className={cn(
            WRAP,
            'flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row',
          )}
        >
          <span className="inline-flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="size-3.5" aria-hidden="true" />
            </span>
            HR Desk, the Mail Reply Engine for TCG Digital
          </span>
          <span>Accounts are provisioned by an HR administrator.</span>
        </div>
      </footer>
    </div>
  );
}
