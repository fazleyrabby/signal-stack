---
name: SignalStack Public Reader
description: Readable news surfaces with a restrained purple accent and paired dark/light themes.
colors:
  dark-background: "#222631"
  dark-foreground: "#f2f1f6"
  dark-card: "#2a2f3c"
  dark-muted: "#343a48"
  dark-muted-foreground: "#b8becb"
  dark-border: "#454b5b"
  dark-primary: "#c4b5fd"
  dark-primary-foreground: "#241c3d"
  light-background: "#faf9fc"
  light-foreground: "#23212b"
  light-card: "#fff"
  light-muted: "#eeecf3"
  light-muted-foreground: "#62606e"
  light-border: "#d9d6e2"
  light-primary: "#6d45bd"
  light-primary-foreground: "#fff"
typography:
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    lineHeight: 1.75
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 550
  bengali:
    fontFamily: "Hind Siliguri, Noto Sans Bengali, sans-serif"
    lineHeight: 1.8
    letterSpacing: "0"
rounded:
  control: "10px"
  field: "12px"
  card: "10px"
  modal: "16px"
spacing:
  inline: "8px"
  control: "12px"
  compact-grid: "12px"
  grid: "16px"
  card: "20px"
  desktop-gutter: "32px"
components:
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-primary-foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-primary-foreground}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  story-card-dark:
    backgroundColor: "{colors.dark-card}"
    textColor: "{colors.dark-foreground}"
    rounded: "{rounded.card}"
    padding: "24px"
  story-card-light:
    backgroundColor: "{colors.light-card}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: SignalStack Public Reader

## Overview

This is an extraction of the implemented public reader, not a replacement identity. It applies to `.public-surface` and the reader components. Administration, login, and unrelated shared primitives retain their existing visual system; do not propagate these tokens into them.

The public UI uses quiet tonal panels, purple actions, readable type, and compact source metadata. The headline and summary carry the visual emphasis. The surface-specific composition and verification limits live in [docs/public-reader-design.md](docs/public-reader-design.md).

## Colors

### Primary

Soft lavender in dark mode and deeper purple in light mode mark selected navigation, primary actions, saved state, links, text selection, and focus. Use the matching primary foreground for filled controls.

### Neutral

Use the paired background, card, muted, foreground, secondary text, and border roles from the active theme. Popovers use the card and foreground colors. All story cards use the same card surface; priority remains secondary text.

## Typography

Inter is the Latin family. Bengali uses Hind Siliguri with Noto Sans Bengali fallback, neutral tracking, and the existing language-specific line-height override. Do not impose Latin tracking on Bengali text.

All card headlines wrap completely and share the same 21px size. Section headings use 23px/600. The compact feed introduction uses 26px on desktop and 24px on mobile, weight 650; its short summary uses 14px on desktop. Modal titles use 28px/1.35, reduced to 25px on mobile. Article titles use `clamp(30px, 4vw, 46px)`/1.25; article body uses 18px/1.85.

## Layout

The reader container is centered at a maximum 1320px with 32px desktop gutters and 20px mobile gutters. Briefing and latest grids share equal-width columns: three columns with 16px gaps, two columns at widths up to 1000px, and one column with 12px gaps at widths up to 767px. Cards use 20px padding at every size. Article reading width is capped at 760px. The intro row uses 16px top / 12px bottom padding on desktop and 14px top / 10px bottom on mobile. Section headings use 12px vertical margins; topic, filter, and update spacing stays compact.

Controls and icon actions have at least 44px targets. Preserve visible keyboard focus and mobile safe-area spacing. Mobile navigation has four equal positions and a 68px minimum row height.

## Elevation & Depth

Reader cards use a shared surface and subtle borders mixed at 65% opacity rather than decorative shadows. The modal overlay supplies depth with a half-opacity black backdrop and supported backdrop blur. Avoid importing the existing global glass-card treatment into the public reader.

## Shapes

Use softly rounded controls, fields, cards, and desktop dialogs according to the extracted radius roles. Mobile dialogs fill the viewport and have square corners. Borders separate card footers, page sections, and dialog actions.

## Components

- Buttons: primary is filled purple; secondary is bordered; icon actions remain quiet until hover. Primary hover applies brightness 1.08; secondary and icon hover use the muted surface.
- Topic navigation: quiet text becomes foreground on muted hover; the current topic is filled primary. Mobile topics form a single horizontally scrollable row.
- Inputs: transparent desktop search and bordered selects use neutral strokes. Mobile search uses the card surface. Select and action focus is a 2px primary outline offset by 4px.
- Cards: source/date precede the complete headline; summary follows; secondary priority and actions share a divided footer. Briefing and latest cards share the same visual treatment; the first card has no separate featured style.
- Dialog: a scrollable content area and separate action footer keep reading and actions distinct. Desktop width is capped at 720px; mobile fills `100dvh`.
- Motion: retain reduced-motion overrides. Dialog transitions use the existing 200ms primitive; theme transitions use the existing 500ms easing, without added decorative motion.

## Do's and Don'ts

- Do keep headlines readable and metadata subordinate.
- Do scope new styling to the public reader and pair dark/light role assignments.
- Do retain focus outlines, labeled icon actions, and readable Bengali spacing.
- Don't truncate headlines to equalize card heights.
- Don't turn priority into an alarm color or dominant badge.
- Don't apply these reader tokens to administration surfaces.
