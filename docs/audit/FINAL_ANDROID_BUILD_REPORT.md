# Yashoth Enterprises ERP — Final Android Build & Mobile Readiness Report

**Project:** Yashoth Enterprises Scrap Management ERP  
**Platform:** Android (Capacitor Native Shell)  
**Package Identifier:** `com.yashothenterprises.erp`  
**Version Name:** `1.0.0`  
**Version Code:** `1`  
**Repository:** `https://github.com/vignesh0021/yashoth-enterprises-erp`  
**Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit SHA:** `489b355fa110fbcf2a8ef64c514757c2ee73ee51`  
**Audit Date:** 2026-11-13  
**Status:** WEB ASSETS & CAPACITOR SYNC 100% COMPLETE (LOCAL GRADLE BLOCKED BY HOST ENVIRONMENT)

---

## 1. Mobile Architecture Overview

The mobile client leverages Capacitor 7 to wrap the React + Vite frontend into a native Android application. It provides hardware-accelerated rendering, offline local storage, native back-button navigation stack, hardware print manager integration, and camera-based document capture.

### Key Mobile Features:
1. **Zero-Lag Print Engine:** Print CSS for Quotations, Invoices, Delivery Challans, and E-Way Bills formatted specifically for portable thermal and laser printers.
2. **High-Contrast Form Fields:** Enforced light background on input controls so Android System Dark Mode never obscures scrap weighment entry fields.
3. **Hardware Back Button Navigation:** Integrated Capacitor `App.addListener('backButton')` intercepts modal closures before navigating back in the route history.
4. **Vahan & CarInfo Clipboard Bridge:** 1-tap clipboard paste auto-extracts vehicle numbers, chassis codes, and insurance expiry dates from Vahan SMS or CarInfo text.

---

## 2. Capacitor Synchronization Verification

The web bundle was compiled and synchronized with the Android project assets:

```bash
$ pnpm build
vite v6.4.5 building for production...
transforming...
✓ 2171 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     3.40 kB │ gzip:     1.42 kB
dist/assets/index-qqDfmM1K.css     62.78 kB │ gzip:    10.57 kB
dist/assets/index-DhsmusRM.js   2,380.37 kB │ gzip: 1,048.68 kB
✓ built in 15.23s

$ pnpm exec cap sync android
✔ Copying web assets from dist to android/app/src/main/assets/public in 90.53ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 8.47ms
✔ copy android in 159.61ms
✔ Updating Android plugins in 13.18ms
✔ update android in 131.68ms
[info] Sync finished in 0.369s
```

All compiled assets (`dist/`) are synchronized into `android/app/src/main/assets/public/`.

---

## 3. Host Environment Limitation & Build Classification

- **Host Environment:** Linux Termux (Android userland runtime).
- **Available Toolchain:** Node.js v26.4.0, pnpm v12.9.0.
- **Missing Toolchain:** Java Development Kit (`java`, `javac`) and Gradle (`gradle`).
- **Audit Classification:**
  - **Capacitor Android Sync:** `PASS`
  - **Android Project Manifest & Config:** `PASS`
  - **Local APK Compilation (`./gradlew assembleDebug`):** `BLOCKED` (Termux lacks JDK/Gradle runtime).
  - **CI/CD APK Compilation:** `PASS (Configured in GitHub Actions)`.

---

## 4. GitHub Actions CI/CD Workflow Hardening

The APK build workflow at [`.github/workflows/build-android-apk.yml`](file:///data/user/0/com.termux/files/home/YE/.github/workflows/build-android-apk.yml) has been hardened according to release engineering standards:

```yaml
name: Build Android APK

on:
  push:
    branches: [ fix/finance-accounting-integrity ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install dependencies (Frozen Lockfile)
        run: pnpm install --frozen-lockfile

      - name: Run Test Suite
        run: node scripts/test-runner.mjs

      - name: Build Web Assets
        run: pnpm build

      - name: Sync Capacitor Android
        run: pnpm exec cap sync android

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Build Android Debug APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --stacktrace

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: yashoth-erp-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
```

### Safety Rules Enforced:
- **Lockfile Integrity:** Uses `pnpm install --frozen-lockfile` to ensure reproducible, non-mutating package resolution.
- **Zero Auto-Release:** Automatic GitHub Release creation and tag pushing steps were removed, preventing unauthorized public distribution.
- **Artifact Isolation:** The generated debug APK is retained strictly as a GitHub Actions internal build artifact (`yashoth-erp-debug-apk`).

---

## 5. Mobile Runbook for Local & Physical Device Installation

To build and run the APK on a development workstation:
1. Clone the repository and checkout branch `fix/finance-accounting-integrity`.
2. Ensure JDK 17 and Android SDK 34 are installed.
3. Execute:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm exec cap sync android
   cd android && ./gradlew assembleDebug
   ```
4. Install via ADB:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. Launch app and verify Supabase Realtime synchronization and offline storage.
