# YASHOTH ENTERPRISES ERP — BACKUP & DISASTER RECOVERY MANUAL

**Target Audience:** System Administrators, ERP Operators, IT Staff  
**System:** Yashoth Enterprises Scrap & Demolition Works ERP (YE ERP)  
**Security Level:** High / Encrypted  

---

## 1. Overview of Backup Engine

The Yashoth Enterprises Backup Manager protects operational scrap yard data against hardware failure, accidental deletion, malware/ransomware, or mobile device loss.

### Supported Destinations:
1. **Local Device Download:** Direct download of `.yebak` (encrypted) or `.json` (plain) archives to your phone or desktop storage.
2. **Google Drive Cloud Sync:** Secure transfer directly into a dedicated Google Drive folder via user-authorized OAuth 2.0.
3. **ZIP Archive Package:** Complete offline bundle containing database JSON, 14 company Excel registers, and document attachments.
4. **Excel Workbooks:** 14 independent company spreadsheets plus a consolidated master workbook.
5. **CSV Registry Files:** Comma-separated exports for customer, supplier, and vehicle registries.

---

## 2. Cryptographic Security Standards

1. **Encryption Standard:** Authenticated **AES-256-GCM** with PBKDF2 key derivation (100,000 iterations), random 16-byte salt, and 12-byte initialization vector (IV).
2. **Integrity Verification:** Every backup archive is hashed using **SHA-256**. The checksum is stamped into the archive header and recalculated before any restore operation. If a single byte is tampered with, the system aborts restoration.
3. **Pre-Restore Safety Snapshot:** Before executing any restore command, the system automatically creates a timestamped `SAFETY_PRE_RESTORE` backup of current data so that inadvertent restores can be undone immediately.

---

## 3. How to Create a Backup

### Method A: Web / Mobile UI (Recommended)
1. Open the ERP navigation menu and select **Settings → Backup & Restore Manager**.
2. Select your **Backup Scope**:
   - **Full Database:** Backs up all companies (`YE-MAIN` and `CS-BRANCH`), system configurations, accounts, and audit logs.
   - **Company-Scoped:** Backs up only the active company (e.g., Yashoth Enterprises only).
3. Select your **Destination**: Local Device, Google Drive, or ZIP Archive.
4. Check **Enable AES-256 Encryption** (Strongly Recommended).
5. Enter and confirm a strong passphrase.
6. Click **Generate & Export Backup**.
7. The archive is created, hashed, and downloaded or synced to Google Drive.

### Method B: Automated Scheduling
1. In the **Backup Manager**, open the **Automated Schedule** tab.
2. Select the frequency:
   - **Daily:** Triggered daily at 02:00 AM local time.
   - **Weekly:** Triggered every Sunday night.
   - **Monthly:** Triggered on the 1st of each month.
3. Enter your notification email or webhook endpoint.
4. Save schedule settings.

---

## 4. How to Restore from a Backup (Disaster Recovery)

> [!CAUTION]
> Performing a Full Database Restore replaces active data with the archive contents. Always ensure you have created or verified the safety snapshot before proceeding.

### Step-by-Step Restoration Procedure:
1. Navigate to **Backup Manager → Restore Database**.
2. Upload the `.yebak` or `.json` backup file.
3. If the file is encrypted, enter the passphrase used during backup creation.
4. Click **Inspect Archive Integrity & Compatibility**:
   - The engine validates the SHA-256 checksum.
   - The engine inspects schema compatibility (`version 1.0.0`).
   - A **Restore Preview** is displayed showing record counts for each table (Parties, Invoices, Weighments, Accounts).
5. Review the preview figures carefully.
6. Check the confirmation checkbox: *"I understand this operation will update the database"*.
7. Click **Execute Safe Restoration**:
   - The engine takes an automated safety snapshot of existing records.
   - The verified archive payload is written to the database.
   - A permanent restore audit entry is recorded in the `restore_logs` table.
8. The ERP automatically refreshes with the restored state.

---

## 5. Emergency Recovery via Command Line / Node Script

If the frontend is inaccessible due to a hosting outage, you can restore directly using the backend engine:

```bash
# In the project root on your server or Termux:
node -e "
import('./backend/business-rules/backupEngine.ts').then(async (m) => {
  const fs = await import('fs');
  const backupJson = fs.readFileSync('./backups/YE_FULL_BACKUP_latest.yebak', 'utf-8');
  const validation = await m.validateBackupIntegrity(backupJson, { password: 'YourSecretPassphrase' });
  if (validation.isValid) {
    console.log('Archive verified! Restoring ' + validation.manifest.recordCounts.invoices + ' invoices...');
  } else {
    console.error('Integrity check failed:', validation.error);
  }
});
"
```

---
**Maintained by:** IT Systems Administrator, Yashoth Enterprises
