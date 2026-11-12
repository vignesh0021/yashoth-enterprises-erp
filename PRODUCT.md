# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

1. **Proprietor (P. Nandha Kumar)**: Final approver and commercial decision-maker. Manages high-stakes scrap demolition contracts, customer quotations, supplier purchase orders, GST tax invoices, bank and cash ledgers, contractor settlements, and statutory compliance. Operates via mobile smartphone on-site and desktop in the office; requires high-density ledger overviews, zero-scroll summary cards, and 1-tap instant A4 PDF printing and WhatsApp sharing.
2. **Yard Supervisor & Weighbridge Operator**: Stationed at the primary industrial yard in Gummidipoondi, Tamil Nadu. Operates the weighbridge station, records vehicle registrations, measures gross and tare weights, inspects scrap grades (Heavy Melting Steel HMS-1/2, MS Turning & Boring, Aluminum, Copper, Cast Iron), applies approved tare/moisture/foreign matter deductions, flags duplicate slips, and supervises material intake/dispatch under bright sunlight, dust, and grease.
3. **Accounts Admin & Billing Clerk**: Handles day-to-day transaction recording, NIC Form GST EWB-01 e-Way bill preparation, customer billing, contractor payable accruals, daily wage labour disbursements, employee salary advances, and FIFO inventory COGS reconciliation.
4. **Transport Drivers & Demolition Contractors**: Interfacing with the yard gate for vehicle weight verification, hauling documents, e-Way bills, and immediate wage or contractor work claims.

## Product Purpose

Yashoth Enterprises Scrap ERP is an industrial-grade, mobile-first Enterprise Resource Planning application built to govern the end-to-end lifecycle of scrap metal trading, industrial demolition, haulage, weighbridge tracking, GST compliance, and double-entry financial accounting. It eliminates paper register discrepancies, prevents weight manipulation, enforces FIFO inventory valuation, ensures multi-company financial isolation, and operates seamlessly in low-connectivity scrap yard environments.

## Positioning

Unlike generic accounting software or complex desktop-only enterprise ERPs, Yashoth Enterprises Scrap ERP is custom-engineered for the harsh operational reality of Indian metal recycling yards:
- Operates offline-first on Android mobile devices with zero network dependencies at the weighbridge.
- Features built-in NIC Form GST EWB-01 e-Way bill generation and 100% authentic IMOP commercial document replicas with official proprietor seal and signature.
- Enforces strict atomic database RPCs and multi-company ledger segregation for both Yashoth Enterprises and Yashoth Logistics.
- Delivers dual English and Tamil language operational clarity for shopfloor daily wage and contractor disbursements.

## Operating Context

- **Physical Environment**: High-temperature outdoor scrap yards, weighbridge cabins, and demolition sites with direct midday sunlight glare, high dust levels, and intermittent 4G/2G mobile connectivity.
- **Hardware & Device**: Handheld Android smartphones (Capacitor 8 runtime, Android SDK 24–36), thermal receipt printers, and A4 office printers.
- **Core Documents**: Weighbridge tickets (gross/tare/net/payable weights), NIC Form GST EWB-01 e-Way Bills, GST Tax Invoices, Quotation Sheets with authentic proprietor letterhead, Contractor Work Sheets, Daily Wage Muster Rolls, and Employee Advance Slips.
- **Bilingual Workflows**: Professional English for official GST invoices, e-Way bills, and commercial documentation; combined English and Tamil (`நிதி மற்றும் கணக்கு மேலாண்மை`) for daily labour muster rolls, contractor settlements, and cash vouchers.

## Capabilities and Constraints

- **Offline-First Synchronization**: Local IndexedDB / localStorage queue captures all transactions immediately and syncs automatically with remote Supabase PostgreSQL when internet connectivity is available (`offlineSyncService`).
- **Native Android Hardware Bridge**: Direct integration via `AndroidNativeBridge` (`shareBackupFile`, `saveFileToDownloads`, `printPage`, `exitApp`, and predictive back-button interception).
- **Multi-Company Security & Isolation**: Cryptographic session verification via `auth.uid()` and company membership checks ensuring zero cross-company journal postings or FIFO inventory contamination.
- **Deterministic FIFO Inventory & COGS**: Strict chronological lot consumption with immutable historical unit cost snapshots and comprehensive audit verification.
- **Physical Yard Accessibility Constraints**: Minimum touch target size of 48px by 48px (`min-h-[48px]`, `min-w-[48px]`) to support dirty, wet, or gloved hands.
- **Sunlight Readability**: Absolute high-contrast light surfaces (`color-scheme: light !important`, `#ffffff` form inputs, `#0f172a` ink) to prevent system dark mode from washing out critical weighbridge figures under solar glare.

## Brand Commitments

- **Corporate Entity**: Yashoth Enterprises.
- **Sister Logistics Entity**: Yashoth Logistics & Transport.
- **Proprietor**: P. Nandha Kumar.
- **Yard Location**: Gummidipoondi, Tamil Nadu, India.
- **Brand Palette**:
  - Primary Red: `#dc2626` (Tailwind `brand-600` / `red-600`) symbolizing industrial scrap machinery and urgency.
  - Industrial Dark: `#0f172a` (Tailwind `slate-900`) representing cast iron, heavy steel, and structural permanence.
  - High-Contrast Surface: `#ffffff` and `#f8fafc` (Tailwind `slate-50` / `white`) providing glare-resistant clarity.
  - Verified Emerald: `#059669` (Tailwind `emerald-600`) for verified weights, paid invoices, and completed syncs.
  - Warning Amber: `#d97706` (Tailwind `amber-600`) for pending weighments, unverified COGS, and offline queue items.
  - Logistics Blue: `#2563eb` (Tailwind `blue-600`) for in-transit dispatches, vehicles, and active trips.
- **Visual Assets**: Exact high-resolution reproduction of Yashoth Enterprises letterhead, trade logos, and official proprietor seal/signature in all printable commercial documents.

## Evidence on Hand

- `src/assets/quotationAssets.ts`: Exact base64 letterhead, seal, and logo extracted from Yashoth Enterprises official Word document (`.docx`).
- `src/types/index.ts`: Authoritative TypeScript domain models for scrap items, weighbridge slips, commercial documents, vehicles, labour, and double-entry accounts.
- `database/migrations/`: 11 production-grade PostgreSQL migrations enforcing atomic RPC transactions, RLS policies, and company isolation.
- `android/app/src/main/java/com/yashothenterprises/erp/`: Native Android Capacitor project with custom `AndroidNativeBridge` for printing and file downloads.
- Automated Test Suite: 246 automated regression tests across 98 suites in `scripts/test-runner.mjs` verifying FIFO inventory, e-Way bill compliance, and financial integrity.

## Product Principles

1. **The Yard-First Reality**: The app is built for a weighbridge operator standing in the sun with dirty fingers. Every primary action must be thumb-accessible, with $\ge 48\text{px}$ touch targets, crisp font contrast, and instant haptic/scale feedback.
2. **Absolute Financial & Inventory Integrity**: No unverified cost of goods sold, no cross-company lot leakage, and no partial React state updates when database persistence fails. Every rupee and every kilogram must balance to the decimal.
3. **1-Tap Print & Share**: Commercial documents (Quotations, POs, Tax Invoices, Weighment Slips) must render instantaneously in standard A4 portrait format without lag, ready for instant thermal/laser printing or WhatsApp dispatch.
4. **Local Autonomy, Zero-Friction Sync**: The scrap yard cannot stop moving because the cell tower failed. Weighbridge receipts, sales, and labour logs are captured locally first, verified against business rules, and queued for cloud persistence.
5. **Bilingual Clarity**: High-consequence cash disbursements, daily wages, and labour muster rolls must be readable and unambiguous in both Tamil and English to eliminate misunderstanding between management and field workers.

## Accessibility & Inclusion

- **Visual Contrast Standard**: WCAG 2.1 AA compliant across all outdoor lighting conditions, targeting $\ge 7:1$ contrast ratio for tabular numbers, weights, and currency amounts.
- **Form Readability**: Input font size fixed at 16px minimum to avoid unwanted iOS/Android auto-zoom; placeholder text contrast set to `#64748b` for immediate visibility.
- **Touch Affirmation**: Active press scaling (`transform: scale(0.97)`) on all tappable elements to provide clear tactile feedback on touchscreens without physical buttons.
