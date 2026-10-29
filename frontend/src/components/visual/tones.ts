export type VisualTone = 'azure' | 'iris' | 'mint' | 'sun' | 'ember' | 'neutral';

export const TONE_STYLES: Record<VisualTone, { solid: string; soft: string; text: string; fill: string }> = {
  azure: {
    solid: 'bg-azure text-white',
    soft: 'bg-azure/12 text-azure',
    text: 'text-azure',
    fill: 'var(--azure)',
  },
  iris: { solid: 'bg-iris text-white', soft: 'bg-iris/12 text-iris', text: 'text-iris', fill: 'var(--iris)' },
  mint: {
    solid: 'bg-mint text-white dark:text-black',
    soft: 'bg-mint/14 text-success',
    text: 'text-success',
    fill: 'var(--mint)',
  },
  sun: {
    // sun now aliases destructive (see index.css), so it needs the same
    // white-on-solid treatment as ember/azure/iris instead of the dark text
    // that worked when this was yellow.
    solid: 'bg-sun text-white',
    soft: 'bg-sun/25 text-sun-foreground dark:text-sun',
    text: 'text-warning',
    fill: 'var(--sun)',
  },
  ember: {
    solid: 'bg-ember text-white',
    soft: 'bg-ember/12 text-ember',
    text: 'text-ember',
    fill: 'var(--ember)',
  },
  neutral: {
    solid: 'bg-muted-foreground text-background',
    soft: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
    fill: 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)',
  },
};
