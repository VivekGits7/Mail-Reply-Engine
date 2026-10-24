# DESIGN.md — TCG Mail Reply Engine

## Product
- **What**: Autonomous HR email triage and workflow engine for TCG Digital with human-in-the-loop approval.
- **For**: TCG HR Operations, People Business Partners, and System Administrators.
- **Primary action**: Secure, modern authentication into the HR Mail Desk.
- **Tone**: Authoritative, Modern, High-Precision, Product-Led.

## Dials
- **VARIANCE**: 5 (Confident split-screen with authentic product showcase on left, focused terminal on right)
- **MOTION**: 3 (Snappy UI micro-interactions ≤ 200ms, subtle status breathing pulse)
- **DENSITY**: 5 (Comfortable, structured card layout with clear visual hierarchy)

## Direction
- **Name**: Modern Split-Screen with Product Showcase
- **Idea**: "The login screen showcases a live simulation of the Mail Reply Engine triaging pre-onboarding documents and drafting HR replies alongside a clean, ergonomic sign-in terminal."

## Color & Typography
- **Showcase Pane**: Deep obsidian slate (`#090d16`) with cobalt ambient lighting and crisp status pills
- **Terminal Pane**: Adaptive neutral surface (`bg-background` to `bg-card`) with high-contrast inputs
- **Typography**: `Public Sans Variable` + `IBM Plex Mono` for status badges

## Decisions Log
- **Redesign Iteration 3**: Implemented modern split-screen layout with an authentic product workflow preview (incoming email, UC-DOC classification, Presidio PII masking, auto-extracted document checklist, and HR approval gate) on the left, paired with an uncluttered, responsive sign-in card on the right.
