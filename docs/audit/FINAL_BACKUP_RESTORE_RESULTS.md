# Yashoth Enterprises ERP — Final Backup & Disaster Recovery Report

**Repository:** `https://github.com/vignesh0021/yashoth-enterprises-erp`  
**Working Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit SHA:** `489b355fa110fbcf2a8ef64c514757c2ee73ee51`  
**Audit Date:** 2026-11-13  
**Status:** 100% VERIFIED IN AUTOMATED SUITE (PENDING LIVE DRIVE OAUTH CREDENTIALS)

---

## 1. Cryptographic Vault & Architecture Specification

The backup engine ([`src/utils/backupEngine.ts`](file:///data/user/0/com.termux/files/home/YE/src/utils/backupEngine.ts)) implements zero-knowledge, client-side encrypted backup archives designed to protect sensitive commercial and financial data:

- **Cipher Algorithm:** AES-GCM-256 (authenticated symmetric encryption).
- **Key Derivation Function:** PBKDF2 with SHA-256, 100,000 iterations, 16-byte cryptographically secure salt.
- **Initialization Vector:** 12-byte random IV per backup archive.
- **Integrity Tag:** 128-bit authentication tag appended to ciphertext.
- **Payload Format:** Self-describing JSON containing metadata manifest, table-by-table records, schema version, and SHA-256 checksums.

---

## 2. Backup Archive Structure

```json
{
  "manifest": {
    "version": "1.0.0",
    "createdAt": "2026-11-13T10:00:00.000Z",
    "companyId": "00000000-0000-0000-0000-000000000001",
    "companyName": "Yashoth Enterprises",
    "schemaVersion": "011",
    "checksum": "a1b2c3d4e5f6...",
    "tableCounts": {
      "materials": 24,
      "parties": 48,
      "weighment_tickets": 150,
      "inventory_lots": 85,
      "journal_entries": 310,
      "journal_lines": 620,
      "commercial_documents": 95,
      "cash_bank_accounts": 4,
      "account_transactions": 280
    }
  },
  "tables": {
    "materials": [ ... ],
    "parties": [ ... ],
    "weighment_tickets": [ ... ],
    "inventory_lots": [ ... ],
    "journal_entries": [ ... ],
    "journal_lines": [ ... ],
    "commercial_documents": [ ... ],
    "cash_bank_accounts": [ ... ],
    "account_transactions": [ ... ]
  }
}
```

---

## 3. Storage Providers & Fallback Mechanisms

1. **Google Drive Cloud Integration ([`src/services/googleDriveService.ts`](file:///data/user/0/com.termux/files/home/YE/src/services/googleDriveService.ts)):**
   - Connects via Google Drive API v3 (`drive.file` scope).
   - Encrypted archives are uploaded into an application-specific folder (`Yashoth_ERP_Backups`).
   - Automated retention policy purges archives older than 30 days while retaining monthly baselines.
   - *Status:* `BLOCKED for live cloud upload drill` (requires user OAuth Client ID in staging; engine verified in mock suite).
2. **Encrypted Local File Download (Immediate Fallback):**
   - In-app 1-tap download creates an `.enc` or `.json` archive directly on the device.
   - Zero dependency on external cloud services.
   - *Status:* `PASS (Verified in Suite 05)`.

---

## 4. Restore Engine & Transactional Safety

The restore procedure enforces defensive restoration rules:

1. **Passphrase Decryption:** Fails immediately if the passphrase or PBKDF2 parameters do not authenticate the GCM tag.
2. **Schema Compatibility Check:** Validates that the archive schema version is compatible with the database schema.
3. **Foreign Key Dependency Sorting:** Ingests tables in strict foreign key order:
   - Companies $\to$ Materials $\to$ Parties $\to$ Yards $\to$ Weighment $\to$ Lots $\to$ Accounts $\to$ Documents $\to$ Journals $\to$ Transactions.
4. **Idempotency & Deduplication:** Existing records matching primary key UUIDs or operational sequence numbers are updated or safely merged without duplicating monetary balances.
5. **Post-Restore Balance Reconciliation:** Automatically calls `fn_reconcile_account_balance()` on all cash and bank accounts to guarantee that ledger balances match physical transactions.

---

## 5. Automated Verification Results (Suite 05)

- **Test 5.1:** Successfully derives key and encrypts database snapshot with AES-GCM-256: **PASS**
- **Test 5.2:** Correctly decrypts encrypted payload with valid passphrase: **PASS**
- **Test 5.3:** Rejects corrupted ciphertext or invalid passphrase with `Authentication failed`: **PASS**
- **Test 5.4:** Restores tables in dependency order with zero foreign key constraint violations: **PASS**
- **Test 5.5:** Reconciles cash and bank accounts post-restore: **PASS**
