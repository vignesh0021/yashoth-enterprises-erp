---
name: Yashoth Enterprises Scrap ERP
description: Industrial Mobile-First Scrap Metal & Demolition ERP Design System
colors:
  primary: "#dc2626"
  primary-hover: "#b91c1c"
  primary-active: "#991b1b"
  primary-light: "#fef2f2"
  neutral-bg: "#ffffff"
  neutral-surface: "#f8fafc"
  neutral-canvas: "#f1f5f9"
  neutral-border: "#e2e8f0"
  neutral-divider: "#cbd5e1"
  neutral-muted: "#64748b"
  neutral-text: "#0f172a"
  accent-emerald: "#059669"
  accent-emerald-bg: "#ecfdf5"
  accent-amber: "#d97706"
  accent-amber-bg: "#fffbeb"
  accent-blue: "#2563eb"
  accent-blue-bg: "#eff6ff"
  accent-purple: "#7c3aed"
  accent-purple-bg: "#faf5ff"
  accent-rose: "#e11d48"
  accent-rose-bg: "#fff1f2"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.025em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.xl}"
    padding: "12px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.neutral-bg}"
  button-secondary:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "12px 18px"
    height: "48px"
  input-field:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
    height: "48px"
  card-surface:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  chip-status:
    backgroundColor: "{colors.accent-emerald-bg}"
    textColor: "{colors.accent-emerald}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

## Overview

**Creative North Star: "The Industrial Yard Ledger"**

Yashoth Enterprises Scrap ERP is an authoritative, high-cadence digital ledger purpose-built for the rugged operational reality of metal recycling yards, industrial demolition projects, and weighbridge weigh-stations. The visual atmosphere unites the precision of heavy industrial engineering with the clarity of statutory double-entry accounting. It abandons delicate SaaS minimalism in favor of bold, tactile, high-contrast surfaces that remain razor-sharp under bright outdoor sunlight and grease-smudged smartphone screens.

The system serves the proprietor, weighbridge operators, and accounting staff who make continuous commercial and material decisions in seconds: recording gross truck weights, evaluating scrap cuts (HMS-1, MS Boring, Copper, Aluminum), preparing official GST EWB-01 e-Way bills, issuing 1-tap quotations, and disbursing daily wage labor.

**Key Characteristics:**
- **Yard-Hardened High Contrast**: Heavy `#0f172a` ink on crisp `#ffffff` and `#f8fafc` surfaces guaranteed to resist midday solar washout and Android OS forced dark mode degradation.
- **Thumb-Driven 48px Ergonomics**: Every interactive button, input field, and navigation tab honors a rigid $\ge 48\text{px}$ touch target requirement.
- **Tactile Active Feedback**: Buttons depress slightly (`scale(0.97)`) on tap, providing mechanical affirmation without cumbersome animation lag.
- **Bilingual Typographic Harmony**: Dense tabular numerals paired with crisp Latin typography and legible Tamil script (`தமிழ்`) for labour and wage clarity.
- **Zero-Lag Print Authority**: Flawless CSS print stylesheets delivering pixel-perfect official A4 tax invoices and quotations with authentic letterhead, seals, and proprietor signatures.

## Colors

The palette draws from industrial scrap operations: structural steel red, cold-rolled sheet slate, pure scale ticket white, and statutory verification signals.

### Primary
- **Machinery Red** (`#dc2626` / `brand-600`): The signature brand color representing industrial machinery, weighbridge scales, and high-consequence primary actions (Record Slip, Submit Quotation, Post Payment).
- **Deep Steel Red** (`#b91c1c` / `brand-700`): Pressed and hover states for primary controls.
- **Signal Red Alert** (`#991b1b` / `brand-800`): Critical stock loss warnings, flagged slips, and deletion prompts.
- **Soft Red Wash** (`#fef2f2` / `brand-50`, `#fee2e2` / `brand-100`): Light warning badges and high-visibility error banners.

### Secondary
- **Industrial Slate Dark** (`#0f172a` / `slate-900`): The bedrock neutral used for primary titles, table headers, high-contrast numbers, and the mobile bottom navigation bar.
- **Cold Steel Blue** (`#1e293b` / `slate-800`): Modal headers, sidebar surfaces, and secondary control text.

### Tertiary (Semantic Signals)
- **Verified Emerald** (`#059669` / `emerald-600` on `#ecfdf5`): Weighbridge slip verified, tax invoice paid, e-Way bill generated, and cloud sync completed.
- **Pending Amber** (`#d97706` / `amber-600` on `#fffbeb`): Draft quotation, unverified FIFO COGS, weighbridge slip pending tare, and offline mutations awaiting sync.
- **Logistics Blue** (`#2563eb` / `blue-600` on `#eff6ff`): In-transit dispatches, vehicle registrations, and assigned carrier trips.
- **Shift Purple** (`#7c3aed` / `purple-600` on `#faf5ff`): Double shift labour entries and contractor work accruals.

### Neutral
- **Pure Sheet White** (`#ffffff`): Form input fields, weighment cards, quotation sheets, and print invoices.
- **Card Surface Slate** (`#f8fafc` / `slate-50`): Container backgrounds and subtle card division.
- **Yard Canvas Slate** (`#f1f5f9` / `slate-100`): Default global body background.
- **Border Slate** (`#e2e8f0` / `slate-200`): Crisp card outlines, table borders, and input strokes.
- **Muted Steel** (`#64748b` / `slate-500`): Secondary timestamps, vehicle make metadata, and input placeholder text.

### Named Rules
**The Sunlight Contrast Rule.** Critical numerical data (Gross Weight, Tare Weight, Net Payable Weight, Rate per MT, and Total Invoice Value) must always render in `#0f172a` or `#dc2626` over `#ffffff` or `#f8fafc`. Low-contrast grays (`< 4.5:1`) are strictly forbidden on financial and weight metrics.

**The Strict Light-Surface Rule.** Input fields, text areas, and select dropdowns must enforce `color-scheme: light !important` with a guaranteed `#ffffff` background and `#0f172a` text color so that external Android dark mode switches cannot invert form elements into unreadable low-contrast states.

## Typography

**Display Font:** Inter, system-ui, -apple-system, sans-serif
**Body Font:** Inter, system-ui, -apple-system, sans-serif
**Tamil Typography:** Noto Sans Tamil, system-ui, sans-serif

**Character:** Technical, utilitarian, and exceptionally legible. High x-height ensures rapid scannability of vehicle registration plates (`TN 18 BY 0420`), weighbridge numbers, and Tamil labour terms (`முன்பணம்`, `நிகர சம்பளம்`).

### Hierarchy
- **Display** (Font-weight 900, `2.25rem` / 36px, line-height 1.15): Top-level KPI overviews and financial summary totals.
- **Headline** (Font-weight 800, `1.5rem` / 24px, line-height 1.25): Module titles (Weighment Register, Quotations & Documents, Finance Ledger).
- **Title** (Font-weight 700, `1.125rem` / 18px, line-height 1.35): Card headers, modal titles, and commercial document line group labels.
- **Body** (Font-weight 500, `0.875rem` / 14px, line-height 1.5): Standard data table cells, form label descriptions, and ledger transaction lines.
- **Label** (Font-weight 700, `0.75rem` / 12px, letter-spacing 0.025em): Status badge chips, column headers, and vehicle compliance expiration tags.

### Named Rules
**The Tabular Number Rule.** All scrap weight quantities (KG, MT) and currency values (₹) must utilize monospace tabular figures (`font-feature-settings: "tnum"`) to maintain strict vertical column alignment across dense financial tables.

**The Bilingual Parity Rule.** When displaying Tamil alongside English in labour, wage, or cash vouchers, both scripts must share identical typographic optical weight and vertical alignment without awkward baseline clipping.

## Layout

The spatial model uses an 8px grid (4px micro-increments: 4px, 8px, 12px, 16px, 24px, 32px) tailored to single-handed handheld operation.

- **Mobile Viewport Grid**: Compact 1-column card stack on mobile devices (`< 768px`) with zero unnecessary side padding (12px outer margin).
- **48px Touch Target Standard**: All tap targets (buttons, select inputs, date pickers, hamburger menu items, and bottom nav buttons) must have a minimum physical bounding box of 48px by 48px (`min-h-[48px]`, `min-w-[48px]`).
- **Mobile Bottom Navigation Bar**: Fixed bottom bar (`h-16`, 64px) anchored to the screen with `safe-area-inset-bottom` padding, placing key workflows (Home, Weighment, Quotes, Sales, Menu) directly inside the thumb sweep zone.
- **Safe Area Insets**: Explicit utility classes (`.safe-top`, `.safe-bottom`, `.safe-pb`) safeguarding notch headers and Android gesture navigation bars.

### Named Rules
**The Thumb Zone Rule.** Primary operational actions (Record Slip, New Quote, Confirm Dispatch) must be placed in the lower half of the mobile viewport or pinned via floating sticky footers to allow effortless one-handed thumb interaction.

## Elevation & Depth

Yashoth Enterprises ERP is flat-by-default with functional tonal layering and subtle tactile shadows. It avoids glossy skeuomorphism, glassmorphism, or heavy blur filters that drain mobile battery life in extreme yard heat.

### Shadow Vocabulary
- **Card Rest** (`box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`): Subtle separation between card surfaces and the canvas background.
- **Floating Sheet / Modal** (`box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`): High-priority dialogs, bottom sheets, and full-screen document builders.
- **Primary Brand Glow** (`box-shadow: 0 4px 14px 0 rgba(220, 38, 38, 0.25)`): Primary action buttons highlighting the immediate next step.

### Named Rules
**The Flat-at-Rest Rule.** All cards, tables, and form sections rest flat against the canvas. Elevation is invoked strictly to lift interactive dialogs, mobile bottom navigation, and action buttons above the document flow.

## Shapes

Form geometry expresses industrial durability through softly rounded corners:
- **Buttons & Form Fields**: `rounded-xl` (12px) to provide a friendly, easy-to-target tactile boundary.
- **Cards & Summary Containers**: `rounded-2xl` (16px) giving structure to complex information groupings.
- **Status Badges & Pills**: `rounded-full` (9999px) for instantly recognizable categorical tags.
- **Borders**: 1px solid `#e2e8f0` crisp structural borders enclosing every card and table container.

## Components

### Buttons
- **Shape**: `rounded-xl` (12px), `min-h-[48px]`.
- **Primary**: Background `#dc2626`, text `#ffffff`, font-weight 700, padding `12px 20px`, active transform `scale(0.97)`.
- **Secondary**: Background `#ffffff`, border 1px solid `#e2e8f0`, text `#0f172a`, font-weight 600, padding `12px 18px`.
- **Destructive**: Background `#fee2e2`, text `#991b1b`, border 1px solid `#fecaca`.

### Form Fields & Inputs
- **Shape**: `rounded-xl` (12px), `min-h-[48px]`, font size 16px minimum.
- **Styling**: Background `#ffffff !important`, text `#0f172a !important`, border 1px solid `#cbd5e1`.
- **Focus State**: Border `#dc2626`, ring 2px `rgba(220, 38, 38, 0.2)`.

### Status Badges
- **Shape**: `rounded-full` (9999px), padding `4px 10px`, font size 12px, font-weight 700.
- **Verified / Paid**: Background `#ecfdf5`, text `#059669`, border 1px solid `#a7f3d0`.
- **Pending / Draft**: Background `#fffbeb`, text `#d97706`, border 1px solid `#fde68a`.
- **Flagged / Rejected**: Background `#fff1f2`, text `#e11d48`, border 1px solid `#fecdd3`.

### Weighment Slips & Documents
- **Container**: High-contrast white card, 1px solid `#e2e8f0` border, `rounded-2xl` corners.
- **Weight Callout Grid**: 3-column split displaying Gross, Tare, and Payable Weight with massive 24px bold tabular numbers.
- **Print Viewport**: `@page { size: A4 portrait; margin: 6mm; }`, zero margin, hiding all navigation chrome and rendering crisp 10pt monochrome typography with authentic letterhead and seals.

## Do's and Don'ts

### Do:
- **Do** maintain a minimum 48px by 48px touch target for all clickable buttons, selects, and navigation items.
- **Do** ensure all form controls specify `color-scheme: light !important` with white backgrounds to protect against Android dark mode washout.
- **Do** format weights (MT, KG) and currency (₹) using tabular numerals and standard Indian numbering notation (`₹1,25,000.00`).
- **Do** display clear bilingual labels (Tamil + English) on daily wage, advance recovery, and labour muster rolls.
- **Do** provide immediate active tactile feedback (`scale(0.97)`) on all touch actions.

### Don't:
- **Don't** use low-contrast text (e.g. light gray on white) for weighbridge readings, invoice values, or tax breakdowns.
- **Don't** create touch targets smaller than 48px on mobile views.
- **Don't** allow form input text to drop below 16px, which causes disruptive automatic zooming in mobile WebViews.
- **Don't** introduce heavy backdrop blurs, floating shadows, or elaborate animations that introduce lag on budget Android hardware.
- **Don't** obscure or crop official letterhead banners or proprietor seals on commercial documents.
