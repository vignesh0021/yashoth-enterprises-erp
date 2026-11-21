import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  validateBackupIntegrity,
  generateRestorePreview,
  executeRestoreWithRollback,
  verifyRestoreReconciliation,
  verifyBackupAttachmentBinaries,
} from '../../backend/business-rules/backupEngine.ts';
import { calculateReconciledAccountBalance } from '../../backend/business-rules/financeEngine.ts';

const DEFAULT_BACKUP_PATH =
  '/data/user/0/com.termux/files/home/storage/downloads/YE_FULL_BACKUP_2026-11-20T02-14-42.json';

describe('Mandatory Real-Backup Acceptance Gate (Fail-Closed)', () => {
  it('fails if source backup is missing/invalid, and restores 1.0.0 production backup into 2.0.0 with exact reconciliation', async () => {
    const backupPath = process.env.YE_BACKUP_FILE || DEFAULT_BACKUP_PATH;

    // NEVER silently skip: fail hard if missing or unreadable
    expect(fs.existsSync(backupPath)).toBe(true);

    const raw = fs.readFileSync(backupPath, 'utf8');
    const integrity = await validateBackupIntegrity(raw);
    expect(integrity.isValid).toBe(true);
    expect(integrity.parsedArchive).toBeDefined();

    const archive = integrity.parsedArchive!;
    expect(archive.manifest.version).toBe('1.0.0');

    const preview = generateRestorePreview(archive, archive.data.activeCompanyId, {});
    expect(preview.isValid).toBe(true);
    expect(preview.isCompatible).toBe(true);

    const { restoredState, restoreLog, rolledBack } = executeRestoreWithRollback(archive, {}, {
      backupId: archive.manifest.sha256,
      preRestoreBackupId: 'snap-real-gate-1',
      restoreMode: 'FULL',
      actor: 'Acceptance Gate',
    });
    expect(rolledBack).toBe(false);
    expect(restoreLog.status).toBe('COMPLETED');

    const recon = verifyRestoreReconciliation(archive.data, restoredState);
    expect(recon.isExactMatch).toBe(true);
    expect(recon.mismatchedTables).toHaveLength(0);

    // Petty Cash balance & 19 transactions preserved
    expect(restoredState.accounts).toHaveLength(1);
    expect(restoredState.accountTransactions).toHaveLength(19);
    expect(calculateReconciledAccountBalance(restoredState.accounts![0], restoredState.accountTransactions || [])).toBe(6020);

    // Verify exact 5 classification candidate IDs remain intact
    const txIds = new Set((restoredState.accountTransactions || []).map((t) => t.id));
    for (const expectedId of ['atx-rp2l11r', 'atx-g8ktcok', 'atx-mzj3dzt', 'atx-bjtqe9h', 'atx-vmewoeg']) {
      expect(txIds.has(expectedId)).toBe(true);
    }

    // Attachment binary verification
    const attCheck = await verifyBackupAttachmentBinaries(archive);
    expect(attCheck.totalChecked).toBe(1);
    expect(attCheck.verifiedCount).toBe(1);
    expect(attCheck.checksumMismatches).toHaveLength(0);

    // Repeat restore must not duplicate
    const repeat = executeRestoreWithRollback(archive, restoredState, {
      backupId: archive.manifest.sha256,
      preRestoreBackupId: 'snap-real-gate-2',
      restoreMode: 'FULL',
      actor: 'Acceptance Gate',
      preventOverwrite: true,
    });
    expect(repeat.rolledBack).toBe(false);
    expect(repeat.restoredState.accountTransactions).toHaveLength(19);
    expect(
      calculateReconciledAccountBalance(repeat.restoredState.accounts![0], repeat.restoredState.accountTransactions || [])
    ).toBe(6020);
  });
});
