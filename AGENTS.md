# Yashoth Enterprises ERP — Engineering & Regression Guardrails

This file records critical bugs, root causes, and UI/UX standards resolved in this repository so future upgrades never reintroduce them.

## 1. Android Capacitor WebView & PNG/Report Exports
- **Never rely solely on `<a download>` with `data:` or `blob:` URLs** for PNG/image exports—Android WebView silently ignores `<a download>`.
- Always use [`generateVisualFinanceReport`](file:///data/user/0/com.termux/files/home/YE/src/utils/visualReportExporter.ts) + [`shareOrDownloadPng`](file:///data/user/0/com.termux/files/home/YE/src/utils/visualReportExporter.ts) + [`VisualReportModal`](file:///data/user/0/com.termux/files/home/YE/src/components/common/VisualReportModal.tsx), which:
  1. Uses `navigator.share({ files: [file] })` for native Android/WhatsApp sharing.
  2. Always renders an in-app PNG preview (allowing long-press save), download fallback, and copy-text summary.
- Visual report sending (**Day-wise**, **Week-wise**, **Month-wise**) must remain accessible from **Cockpit**, **Daily Expenses**, **Cash & Bank**, and **Reports**—not only Cash & Bank.

## 2. Dates & Timezone Safety
- **Never use `new Date().toISOString().split('T')[0]` for `todayStr`**—in IST (UTC+5:30), UTC shifts dates backward between 00:00 and 05:30 AM.
- Always use `getLocalDateStr()` from [`visualReportExporter.ts`](file:///data/user/0/com.termux/files/home/YE/src/utils/visualReportExporter.ts).

## 3. Daily Expense Entry Integrity
- **Payment Mode ↔ Account Type Sync**: In [`FinanceView.tsx`](file:///data/user/0/com.termux/files/home/YE/src/modules/finance/FinanceView.tsx), changing `Payment Mode` (`CASH` / `BANK` / `UNPAID`) must automatically switch `Paid From Account` (`resolveDefaultAccountForMode`) and filter/validate that `CASH` expenses only deduct from `CASH` accounts and `BANK` expenses only deduct from `BANK` accounts.
- **Default Amount**: Initialize new expense amount to `0` (never a hardcoded placeholder like `1500`).
- **Delete Feedback**: Always surface `{ success, message }` from `deleteExpense()` via `showFeedback()` (posted/paid vouchers cannot be hard-deleted and must be reversed).
- **Custom Expense Categories**: Keep `EXPENSE_CATEGORIES` in [`src/types/index.ts`](file:///data/user/0/com.termux/files/home/YE/src/types/index.ts) at the 10 standard items (verified by `tests/finance_module.test.ts`), and support user-added custom categories via `ye_custom_expense_categories` + `allExpenseCategories` in both the Expense Modal and Monthly Expense Report.

## 4. Cockpit Completeness
- Finance **Cockpit** (`DASHBOARD` tab) must display **Today**, **This Week**, **This Month**, and **All Active** expense totals, monthly category breakdown bars, and the recent expense vouchers table—not only a single `Today's Expenses` KPI card.

## 5. Mobile UI/UX & Apple Design Standards
- **Top Header Bar** ([`AppLayout.tsx`](file:///data/user/0/com.termux/files/home/YE/src/components/layout/AppLayout.tsx)): Left container must have `min-w-0 overflow-hidden` and `truncate` on `CompanySwitcher` (and hide redundant logo on `< sm`) so it never overlaps `LanguageToggle` on 360px phones.
- **Module Tabs**: Never hide tabs off-screen in a narrow `overflow-x-auto` strip on mobile; use `grid-cols-2 sm:flex sm:flex-wrap` so all tabs are immediately visible and tappable.
- **Wide Tables on Mobile**: Any table with >4 columns (e.g. Daily Expenses) must include a `sm:hidden` mobile card view so Amount, Status, and Actions are never clipped off-screen.
- **Modals & Motion** ([`index.css`](file:///data/user/0/com.termux/files/home/YE/src/index.css), [`Modal.tsx`](file:///data/user/0/com.termux/files/home/YE/src/components/common/Modal.tsx), [`MobileBottomNav.tsx`](file:///data/user/0/com.termux/files/home/YE/src/components/layout/MobileBottomNav.tsx)):
  - Use `grid-cols-1 sm:grid-cols-2 items-end` for 2-column form rows so wrapped bilingual labels never misalign inputs.
  - Keep modal titles concise so they don't truncate on phones.
  - Preserve Apple Design frosted glass chrome (`backdrop-blur-xl`), spring sheet entrance (`apple-sheet`), instant pointer-down `:active` scale (`90ms`), and `prefers-reduced-motion` / `prefers-reduced-transparency` media queries.

## 6. Build & Verification Checklist
Before pushing any upgrade:
1. `pnpm typecheck`
2. `pnpm test:vitest`
3. `pnpm build && pnpm exec cap sync android`
4. Commit and push to GitHub to trigger the CI Android APK build (local Termux has `openjdk-21`, `gradle`, and `aapt2`, but no local Android SDK).
