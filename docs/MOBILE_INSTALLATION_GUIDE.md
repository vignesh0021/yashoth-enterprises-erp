# YASHOTH ENTERPRISES ERP — MOBILE & PWA INSTALLATION GUIDE

**Platform:** Progressive Web Application (PWA)  
**Supported Devices:** Android Phones & Tablets, Apple iPhones & iPads, Windows & macOS Desktops  
**Application Title:** Yashoth Enterprises ERP (`YE ERP`)  

---

## 1. What is an Installable PWA?

The Yashoth Enterprises ERP is engineered as an **Installable Progressive Web App (PWA)**. It provides a native app experience without requiring installation via Google Play Store or Apple App Store:
- Runs in a full-screen, standalone window without browser URL bars.
- Adds an app icon directly to your home screen or desktop.
- Operates offline in the scrap yard when network signals drop.
- Features touch-optimized controls, safe area insets for notches, and zero touch lag.

---

## 2. Installation on Android Devices (Chrome / Edge / Brave)

1. Connect your Android phone to the internet and open **Google Chrome**.
2. Navigate to your ERP URL (e.g., `https://erp.yashothenterprises.com` or local LAN IP like `http://192.168.1.100:5173`).
3. Chrome will automatically display an **"Add Yashoth Enterprises ERP to Home screen"** banner at the bottom of the screen.
4. Alternatively, tap the **three dots menu (⋮)** in the top right corner and select **"Install app"** or **"Add to Home screen"**.
5. Tap **Install** in the confirmation dialog.
6. The **YE ERP** scrap truck icon will now appear on your home screen and in your app drawer.
7. Tap the icon to launch the app in full-screen standalone mode.

---

## 3. Installation on Apple iOS Devices (iPhone / iPad - Safari)

1. Open **Safari** on your iPhone or iPad.
2. Navigate to your ERP URL.
3. Tap the **Share** button (the square with an arrow pointing upward) in the Safari bottom bar.
4. Scroll down the share sheet and tap **"Add to Home Screen"**.
5. Confirm the name **YE ERP** and tap **Add** in the top-right corner.
6. The ERP icon will appear on your iOS home screen.
7. Tapping the icon opens the ERP in standalone display mode with notch safe-area padding.

---

## 4. Installation on Desktop (Windows / macOS / ChromeOS)

1. Open **Google Chrome** or **Microsoft Edge**.
2. Navigate to the ERP website.
3. In the right side of the address bar, look for the **Install icon** (a small computer screen with a down arrow).
4. Click **Install**.
5. The ERP opens in its own dedicated desktop window with its own taskbar/dock icon and keyboard shortcuts.

---

## 5. Working Offline in the Scrap Yard

Scrap yards and demolition work sites frequently suffer from weak cellular reception or network dead zones. The YE ERP offline engine ensures continuous operation:

### How Offline Mode Works:
1. **App Shell Pre-caching:** The Service Worker (`public/sw.js`) caches the core user interface, CSS, icons, and JavaScript logic. The app opens instantaneously even without internet.
2. **Offline Mutation Queue:**
   - Weighment entries, inward purchases, sales orders, attendance marks, and expenses created offline are automatically stored in the local offline queue (`offlineSyncService.ts`).
   - The top header displays an orange **"Offline (N pending)"** status pill.
3. **Automatic Network Reconnect Sync:**
   - As soon as the mobile device reconnects to Wi-Fi or cellular data, the ERP detects the connection and flushes queued transactions sequentially.
4. **Strict Conflict Resolution (No Silent Overwrites):**
   - If a record was modified on the server while you were offline, the sync engine flags a **Conflict** instead of silently overwriting newer data.
   - You can review conflicts in the **Sync Drawer** and choose:
     * **Keep Server:** Preserve server record and discard offline edit.
     * **Force Client:** Apply offline edit over the server version.
     * **Save as New:** Save your offline edit as a new duplicate record so both versions are preserved.

---

## 6. Recommended Mobile Settings

- **Font Size:** Keep default system zoom at 100%. The app guarantees a minimum `16px` font size on all inputs to prevent disruptive auto-zooming.
- **Orientation:** Supports both Portrait (optimal for mobile navigation) and Landscape (optimal for wide weighbridge tables).

---
**Prepared by:** Mobile UI & Infrastructure Architect, Yashoth Enterprises
