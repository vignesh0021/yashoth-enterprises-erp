-- ============================================================================
-- YASHOTH ENTERPRISES ERP — PHASE 5 DATABASE MIGRATION
-- Migration: 006_backup_and_restore.sql
-- Description: Backup history, restore logs, and automated scheduling metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_history (
    id VARCHAR(64) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(32) NOT NULL CHECK (backup_type IN ('FULL_DATABASE', 'COMPANY_SCOPED', 'SAFETY_PRE_RESTORE')),
    destination VARCHAR(32) NOT NULL CHECK (destination IN ('LOCAL_FILE', 'ENCRYPTED_ARCHIVE', 'GOOGLE_DRIVE', 'CLOUD_STORAGE')),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64) NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_algorithm VARCHAR(32) DEFAULT NULL,
    schema_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    total_records INTEGER NOT NULL DEFAULT 0,
    record_counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    financial_totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'VERIFIED')),
    error_message TEXT DEFAULT NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restore_logs (
    id VARCHAR(64) PRIMARY KEY,
    backup_id VARCHAR(64) NOT NULL,
    pre_restore_backup_id VARCHAR(64) NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    restored_by VARCHAR(128) NOT NULL,
    restoration_type VARCHAR(32) NOT NULL CHECK (restoration_type IN ('FULL_RESTORE', 'COMPANY_RESTORE')),
    records_restored_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    sha256_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'ROLLED_BACK')),
    notes TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    restored_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_schedules (
    id VARCHAR(64) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    frequency VARCHAR(32) NOT NULL CHECK (frequency IN ('MANUAL_ONLY', 'DAILY', 'WEEKLY', 'MONTHLY')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    destination VARCHAR(32) NOT NULL DEFAULT 'LOCAL_FILE' CHECK (destination IN ('LOCAL_FILE', 'ENCRYPTED_ARCHIVE', 'GOOGLE_DRIVE')),
    encrypt_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    retention_count INTEGER NOT NULL DEFAULT 10 CHECK (retention_count >= 1),
    last_run_at TIMESTAMPTZ DEFAULT NULL,
    last_run_status VARCHAR(32) DEFAULT NULL,
    next_run_at TIMESTAMPTZ DEFAULT NULL,
    google_drive_folder_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_history_company ON backup_history(company_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restore_logs_created_at ON restore_logs(restored_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_company ON backup_schedules(company_id);
