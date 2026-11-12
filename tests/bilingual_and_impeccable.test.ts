import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TRANSLATIONS } from '../src/i18n/translations.ts';

describe('Suite 14: Bilingual Translation Engine (English & Tamil) & Impeccable Touch Audit', () => {
  it('14.1 verifies dictionary completeness and key parity between English and Tamil', () => {
    const enKeys = Object.keys(TRANSLATIONS.en);
    const taKeys = Object.keys(TRANSLATIONS.ta);

    expect(enKeys.length).toBeGreaterThan(30);
    expect(taKeys.length).toBeGreaterThan(30);

    // Critical Navigation Keys
    expect(TRANSLATIONS.en['nav.dashboard']).toBe('Dashboard');
    expect(TRANSLATIONS.ta['nav.dashboard']).toContain('முகப்பு');
    expect(TRANSLATIONS.en['nav.weighment']).toBe('Weighment');
    expect(TRANSLATIONS.ta['nav.weighment']).toContain('எடை மேடை');
    expect(TRANSLATIONS.en['nav.finance']).toBe('Finance & Accounts');
    expect(TRANSLATIONS.ta['nav.finance']).toContain('நிதி');

    // Weighment Keys
    expect(TRANSLATIONS.en['weigh.record_slip']).toBe('Record Weighment Slip');
    expect(TRANSLATIONS.ta['weigh.record_slip']).toBe('எடை ரசீது பதிவு செய்க');
    expect(TRANSLATIONS.en['weigh.payable_weight']).toBe('Payable Weight (KG)');
    expect(TRANSLATIONS.ta['weigh.payable_weight']).toContain('கொள்முதல் எடை');

    // Every key in English must have a corresponding translation in Tamil
    for (const key of enKeys) {
      expect(TRANSLATIONS.ta[key]).toBeDefined();
      expect(TRANSLATIONS.ta[key].length).toBeGreaterThan(0);
    }
  });

  it('14.2 verifies Impeccable Design System 48px touch targets and light-scheme safety', () => {
    const root = process.cwd();
    
    // Check index.css has forced light surface for form inputs
    const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf-8');
    expect(indexCss).toContain('color-scheme: light !important');
    expect(indexCss).toContain('#ffffff !important');

    // Check LanguageToggle has active tactile feedback
    const toggleCode = fs.readFileSync(path.join(root, 'src/components/common/LanguageToggle.tsx'), 'utf-8');
    expect(toggleCode).toContain('active:scale-');
    expect(toggleCode).toContain('toggleLanguage');

    // Check AppLayout includes LanguageToggle and translated navigation
    const layoutCode = fs.readFileSync(path.join(root, 'src/components/layout/AppLayout.tsx'), 'utf-8');
    expect(layoutCode).toContain('<LanguageToggle');
    expect(layoutCode).toContain('useLanguage');

    // Check MobileBottomNav has translated items and active states
    const bottomNavCode = fs.readFileSync(path.join(root, 'src/components/layout/MobileBottomNav.tsx'), 'utf-8');
    expect(bottomNavCode).toContain('useLanguage');
    expect(bottomNavCode).toContain('nav.weighment');

    // Check MobileMenuDrawer has 48px touch targets and LanguageToggle
    const drawerCode = fs.readFileSync(path.join(root, 'src/components/layout/MobileMenuDrawer.tsx'), 'utf-8');
    expect(drawerCode).toContain('<LanguageToggle');
    expect(drawerCode).toContain('min-h-[48px]');

    // Check WeighmentView has 48px buttons and inputs
    const weighCode = fs.readFileSync(path.join(root, 'src/modules/weighment/WeighmentView.tsx'), 'utf-8');
    expect(weighCode).toContain('useLanguage');
    expect(weighCode).toContain('min-h-[48px]');
    expect(weighCode).toContain('tabular-nums');

    // Check SettingsView includes 1-Tap Language preference card
    const settingsCode = fs.readFileSync(path.join(root, 'src/modules/settings/SettingsView.tsx'), 'utf-8');
    expect(settingsCode).toContain('<LanguageToggle');
    expect(settingsCode).toContain('Application Language');
  });
});
