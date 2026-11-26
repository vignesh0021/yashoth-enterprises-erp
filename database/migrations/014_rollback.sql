-- ============================================================================
-- Rollback for Migration 014
-- ============================================================================

DROP FUNCTION IF EXISTS fn_confirm_godown_transfer_receipt_atomic(UUID, UUID, VARCHAR, DATE, NUMERIC, VARCHAR, VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS fn_post_multi_source_dispatch_atomic(UUID, VARCHAR, VARCHAR, UUID, UUID, VARCHAR, NUMERIC, NUMERIC, JSONB, VARCHAR, VARCHAR, UUID, VARCHAR);

DROP TABLE IF EXISTS storage_quota_configs;
DROP TABLE IF EXISTS managed_documents;
DROP TABLE IF EXISTS godown_transfer_receipts;
DROP TABLE IF EXISTS godown_transfers;
DROP TABLE IF EXISTS material_dispatch_allocations;
DROP TABLE IF EXISTS material_dispatches;

DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
DROP FUNCTION IF EXISTS fn_prevent_stock_movement_mutation();

DROP INDEX IF EXISTS uq_weighments_company_bill_vehicle_date;
DROP INDEX IF EXISTS uq_weighments_company_checksum;
