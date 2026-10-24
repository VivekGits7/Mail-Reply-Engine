# DESIGN.md — TCG Mail Reply Engine

## Product
- **What**: Autonomous HR email triage and workflow engine for TCG Digital with human-in-the-loop approval.
- **For**: TCG HR Operations, People Business Partners, and System Administrators.
- **Primary action**: Secure authentication into the HR Mail Desk.
- **Tone**: Authoritative, Precision-engineered, High-Trust.

## Dials
- **VARIANCE**: 4 (Confident asymmetric layout with 50/50 or 55/45 split on desktop, stacked on mobile)
- **MOTION**: 3 (Snappy UI transitions ≤ 200ms, micro-springs on toggles, zero motion-slop)
- **DENSITY**: 6 (Compact, data-informed layout with legible typography and crisp touch targets)

## Direction
- **Name**: Swiss / Technical Product
- **Idea**: "On this desk, the operational engine's mailbox automation, clearance orchestration, and PII guardrails become a transparent, structured mission control for HR."
- **Live thing**: Real-time Engine Status card showing Microsoft Graph webhook sync status, Presidio PII sanitizer readiness, and active case pipeline counts.

## Color (Tokens in `src/index.css`)
Tailwind v4 OKLCH tokens tailored for an authoritative, enterprise PeopleOps console:

| Token | Role | Light Mode | Dark Mode |
|---|---|---|---|
| `--background` | Ground | `oklch(0.985 0.003 250)` (clean crisp paper) | `oklch(0.14 0.01 255)` (deep graphite) |
| `--card` | Surface | `oklch(1.0 0 0)` (pure white) | `oklch(0.18 0.012 255)` (elevated surface) |
| `--foreground` | Ink | `oklch(0.20 0.02 255)` (deep obsidian) | `oklch(0.96 0.005 250)` (crisp white) |
| `--muted-foreground` | Muted Ink | `oklch(0.48 0.015 255)` | `oklch(0.68 0.015 250)` |
| `--primary` | TCG Brand Cobalt | `oklch(0.45 0.16 252)` (commanding blue) | `oklch(0.68 0.14 250)` (luminous cobalt) |
| `--primary-foreground` | Primary text | `oklch(0.99 0 0)` | `oklch(0.12 0.02 255)` |
| `--border` | Subtle edges | `oklch(0.91 0.006 250)` | `oklch(0.26 0.01 255)` |
| `--input` | Form borders | `oklch(0.88 0.008 250)` | `oklch(0.30 0.012 255)` |
| `--success` | Verified / Active | `oklch(0.58 0.16 150)` | `oklch(0.72 0.15 150)` |
| `--warning` | Pending Approval | `oklch(0.65 0.15 75)` | `oklch(0.78 0.14 75)` |

## Typography
- **Heading & Body Face**: `Public Sans Variable` (structured, authoritative enterprise neo-grotesk)
- **Monospace Face**: `IBM Plex Mono` (for security badges, timestamps, protocol statuses, UUIDs)
- **Scale**:
  - H1 / Display: `text-2xl sm:text-3xl font-bold tracking-tight`
  - H2 / Section: `text-xl font-semibold tracking-tight`
  - Body: `text-sm leading-relaxed`
  - Meta / Code: `text-xs font-mono`

## Layout
- **Auth Page**: Split screen on `lg:` (desktop):
  - **Left Pane (Brand & Engine Mission Control)**: Dark obsidian/navy slate background, TCG Digital seal, workflow pipeline telemetry (Graph Sync, Presidio PII Shield, Celery Queue), and active feature highlights.
  - **Right Pane (Sign-in Terminal)**: Centered ergonomic card, modern inputs with password reveal toggle, CapsLock detection, instant inline validation, and theme toggle.
- **Mobile (`< lg`)**: Graceful single-column layout with compact header emblem, retaining all functional feedback.

## Motion
- Transitions: `cubic-bezier(0.23, 1, 0.32, 1)`, duration 150ms–200ms.
- Respect `prefers-reduced-motion: reduce`.
- No gratuitous floating blobs or bouncy cards.

## Anti-Slop Safeguards
- NO generic purple/violet gradients.
- NO decorative crosshairs or tech noise.
- NO stock marketing copy ("Transform your HR workflow"). Concrete operational language only.
- Strict test compatibility: labels and roles preserved for Vitest suites.
