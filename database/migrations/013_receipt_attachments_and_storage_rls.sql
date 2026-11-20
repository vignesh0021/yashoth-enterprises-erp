-- ============================================================================
-- YASHOTH ENTERPRISES ERP — RECEIPT ATTACHMENTS & STORAGE RLS
-- Migration: 013_receipt_attachments_and_storage_rls.sql
-- Implements:
--   1. document_attachments table with 5-state upload machine:
--      PENDING_UPLOAD | UPLOAD_FAILED | COMMITTED | REJECTED | EXPIRED
--   2. fn_validate_attachment_parent() with vehicle_documents -> vehicles join
--   3. fn_is_parent_financial_locked() with FOR UPDATE concurrency locking
--   4. document_attachments RLS + storage.objects RLS (erp-receipts)
--   5. fn_reserve_document_attachment, fn_mark_attachment_upload_failed,
--      fn_expire_stale_attachments, fn_reconcile_attachments
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS document_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_entity_type VARCHAR(30) NOT NULL CHECK (
        parent_entity_type IN ('EXPENSE', 'PURCHASE', 'INVOICE', 'VEHICLE_DOC', 'TRIP', 'PAYMENT_AUTH')
    ),
    parent_entity_id UUID NOT NULL,
    storage_bucket VARCHAR(64) NOT NULL DEFAULT 'erp-receipts',
    storage_path TEXT NOT NULL UNIQUE,
    thumbnail_path TEXT,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/webp', 'image/jpeg', 'application/pdf')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
    width INT,
    height INT,
    sha256_checksum CHAR(64) NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'PENDING_UPLOAD' CHECK (
        upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED', 'COMMITTED', 'REJECTED', 'EXPIRED')
    ),
    integrity_status VARCHAR(20) NOT NULL DEFAULT 'OK' CHECK (
        integrity_status IN ('OK', 'MISSING_OBJECT')
    ),
    replaced_attachment_id UUID REFERENCES document_attachments(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    committed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doc_att_parent ON document_attachments(company_id, parent_entity_type, parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_doc_att_dedup ON document_attachments(company_id, parent_entity_type, parent_entity_id, sha256_checksum)
    WHERE deleted_at IS NULL;

-- Polymorphic parent validation (vehicle_documents joins via vehicles.company_id)
CREATE OR REPLACE FUNCTION fn_validate_attachment_parent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_exists BOOLEAN := false;
BEGIN
    CASE NEW.parent_entity_type
        WHEN 'EXPENSE' THEN
            SELECT EXISTS(SELECT 1 FROM expenses WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'PURCHASE' THEN
            SELECT EXISTS(SELECT 1 FROM purchase_headers WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'INVOICE' THEN
            SELECT EXISTS(SELECT 1 FROM invoices WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'VEHICLE_DOC' THEN
            SELECT EXISTS(
                SELECT 1 FROM vehicle_documents vd
                JOIN vehicles v ON v.id = vd.vehicle_id
                WHERE vd.id = NEW.parent_entity_id AND v.company_id = NEW.company_id
            ) INTO v_exists;
        WHEN 'TRIP' THEN
            SELECT EXISTS(SELECT 1 FROM vehicle_trips WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'PAYMENT_AUTH' THEN
            SELECT EXISTS(SELECT 1 FROM payment_authorizations WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        ELSE
            RAISE EXCEPTION 'Unsupported parent_entity_type: %', NEW.parent_entity_type;
    END CASE;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'Parent % (%) not found in company %', NEW.parent_entity_type, NEW.parent_entity_id, NEW.company_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attachment_parent ON document_attachments;
CREATE TRIGGER trg_validate_attachment_parent
    BEFORE INSERT OR UPDATE ON document_attachments
    FOR EACH ROW EXECUTE FUNCTION fn_validate_attachment_parent();

-- Authoritative financial lock with FOR UPDATE serialization
CREATE OR REPLACE FUNCTION fn_is_parent_financial_locked(p_type VARCHAR, p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_locked BOOLEAN := false;
BEGIN
    CASE p_type
        WHEN 'EXPENSE' THEN
            SELECT (status IN ('PAID', 'REVERSED')) INTO v_locked
            FROM expenses WHERE id = p_id FOR UPDATE;
        WHEN 'PURCHASE' THEN
            SELECT (status = 'POSTED' OR COALESCE(amount_paid, 0) > 0) INTO v_locked
            FROM purchase_headers WHERE id = p_id FOR UPDATE;
        WHEN 'INVOICE' THEN
            SELECT (payment_status IN ('PARTIALLY_PAID', 'PAID')) INTO v_locked
            FROM invoices WHERE id = p_id FOR UPDATE;
        WHEN 'VEHICLE_DOC' THEN
            v_locked := false;
        WHEN 'TRIP' THEN
            SELECT (status = 'SETTLED') INTO v_locked
            FROM vehicle_trips WHERE id = p_id FOR UPDATE;
        WHEN 'PAYMENT_AUTH' THEN
            SELECT (status = 'USED') INTO v_locked
            FROM payment_authorizations WHERE id = p_id FOR UPDATE;
        ELSE
            v_locked := false;
    END CASE;
    RETURN COALESCE(v_locked, false);
END;
$$;

CREATE OR REPLACE FUNCTION fn_block_locked_attachment_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF OLD.upload_status = 'COMMITTED' AND fn_is_parent_financial_locked(OLD.parent_entity_type, OLD.parent_entity_id) THEN
        RAISE EXCEPTION 'Cannot delete committed attachment % for financially locked % (%)', OLD.id, OLD.parent_entity_type, OLD.parent_entity_id;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_locked_attachment_delete ON document_attachments;
CREATE TRIGGER trg_block_locked_attachment_delete
    BEFORE DELETE ON document_attachments
    FOR EACH ROW EXECUTE FUNCTION fn_block_locked_attachment_delete();

-- RLS on document_attachments
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_attachments_select_policy ON document_attachments;
CREATE POLICY document_attachments_select_policy ON document_attachments
    FOR SELECT TO authenticated
    USING (auth_is_company_member(company_id));

DROP POLICY IF EXISTS document_attachments_insert_policy ON document_attachments;
CREATE POLICY document_attachments_insert_policy ON document_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')
        AND upload_status = 'PENDING_UPLOAD'
        AND uploaded_by = auth.uid()
    );

DROP POLICY IF EXISTS document_attachments_update_policy ON document_attachments;
CREATE POLICY document_attachments_update_policy ON document_attachments
    FOR UPDATE TO authenticated
    USING (auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor'))
    WITH CHECK (
        auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')
        AND upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED')
    );

DROP POLICY IF EXISTS document_attachments_delete_policy ON document_attachments;
CREATE POLICY document_attachments_delete_policy ON document_attachments
    FOR DELETE TO authenticated
    USING (
        auth_has_company_role(company_id, 'owner_admin')
        AND NOT fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)
    );

-- Private bucket + Storage RLS (guarded if storage schema exists)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('erp-receipts', 'erp-receipts', false, 5242880, ARRAY['image/webp', 'image/jpeg', 'application/pdf'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880;

    DROP POLICY IF EXISTS erp_receipts_select_policy ON storage.objects;
    CREATE POLICY erp_receipts_select_policy ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'erp-receipts'
            AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
            AND auth_is_company_member(((storage.foldername(name))[1])::uuid)
        );

    DROP POLICY IF EXISTS erp_receipts_insert_policy ON storage.objects;
    CREATE POLICY erp_receipts_insert_policy ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'erp-receipts'
            AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
            AND auth_has_company_role(((storage.foldername(name))[1])::uuid, 'owner_admin', 'accounts_operator', 'supervisor')
            AND EXISTS (
                SELECT 1 FROM public.document_attachments da
                WHERE da.company_id = ((storage.foldername(name))[1])::uuid
                  AND (da.storage_path = name OR da.thumbnail_path = name)
                  AND da.upload_status = 'PENDING_UPLOAD'
                  AND da.deleted_at IS NULL
            )
        );

    DROP POLICY IF EXISTS erp_receipts_delete_policy ON storage.objects;
    CREATE POLICY erp_receipts_delete_policy ON storage.objects
        FOR DELETE TO authenticated
        USING (
            bucket_id = 'erp-receipts'
            AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
            AND auth_has_company_role(((storage.foldername(name))[1])::uuid, 'owner_admin')
            AND EXISTS (
                SELECT 1 FROM public.document_attachments da
                WHERE da.company_id = ((storage.foldername(name))[1])::uuid
                  AND (da.storage_path = name OR da.thumbnail_path = name)
                  AND NOT public.fn_is_parent_financial_locked(da.parent_entity_type, da.parent_entity_id)
            )
        );
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL;
END $$;

-- Idempotent reservation & failure transition RPCs
CREATE OR REPLACE FUNCTION fn_reserve_document_attachment(
    p_company_id UUID,
    p_parent_type VARCHAR,
    p_parent_id UUID,
    p_sha256 CHAR(64),
    p_filename VARCHAR,
    p_mime_type VARCHAR,
    p_file_size BIGINT,
    p_replaced_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_existing RECORD;
    v_id UUID := uuid_generate_v4();
    v_ext VARCHAR;
    v_path TEXT;
    v_thumb TEXT;
BEGIN
    IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'accounts_operator', 'supervisor') THEN
        RAISE EXCEPTION 'Unauthorized role for attachment upload';
    END IF;
    IF p_file_size <= 0 OR p_file_size > 5242880 THEN
        RAISE EXCEPTION 'Attachment size must be between 1 byte and 5 MB (5242880 bytes)';
    END IF;

    SELECT * INTO v_existing FROM document_attachments
    WHERE company_id = p_company_id
      AND parent_entity_type = p_parent_type
      AND parent_entity_id = p_parent_id
      AND sha256_checksum = p_sha256
      AND upload_status = 'COMMITTED'
      AND deleted_at IS NULL
    LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('status', 'ALREADY_COMMITTED', 'attachment_id', v_existing.id,
                                 'storage_path', v_existing.storage_path, 'thumbnail_path', v_existing.thumbnail_path);
    END IF;

    SELECT * INTO v_existing FROM document_attachments
    WHERE company_id = p_company_id
      AND parent_entity_type = p_parent_type
      AND parent_entity_id = p_parent_id
      AND sha256_checksum = p_sha256
      AND upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED')
      AND reserved_at > NOW() - INTERVAL '24 hours'
      AND deleted_at IS NULL
    LIMIT 1;
    IF FOUND THEN
        UPDATE document_attachments SET upload_status = 'PENDING_UPLOAD', reserved_at = NOW() WHERE id = v_existing.id;
        RETURN jsonb_build_object('status', 'PENDING_UPLOAD', 'attachment_id', v_existing.id,
                                 'storage_path', v_existing.storage_path, 'thumbnail_path', v_existing.thumbnail_path);
    END IF;

    v_ext := CASE p_mime_type WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
    v_path := p_company_id::TEXT || '/' || LOWER(p_parent_type) || '/' || p_parent_id::TEXT || '/' || v_id::TEXT || '.' || v_ext;
    v_thumb := CASE WHEN v_ext = 'pdf' THEN NULL ELSE p_company_id::TEXT || '/' || LOWER(p_parent_type) || '/' || p_parent_id::TEXT || '/' || v_id::TEXT || '_thumb.webp' END;

    INSERT INTO document_attachments (
        id, company_id, parent_entity_type, parent_entity_id, storage_path, thumbnail_path,
        original_filename, mime_type, file_size_bytes, sha256_checksum, upload_status, replaced_attachment_id, uploaded_by
    ) VALUES (
        v_id, p_company_id, p_parent_type, p_parent_id, v_path, v_thumb,
        p_filename, p_mime_type, p_file_size, p_sha256, 'PENDING_UPLOAD', p_replaced_id, auth.uid()
    );

    RETURN jsonb_build_object('status', 'PENDING_UPLOAD', 'attachment_id', v_id, 'storage_path', v_path, 'thumbnail_path', v_thumb);
END;
$$;

CREATE OR REPLACE FUNCTION fn_mark_attachment_upload_failed(p_attachment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE document_attachments
    SET upload_status = 'UPLOAD_FAILED'
    WHERE id = p_attachment_id
      AND upload_status = 'PENDING_UPLOAD'
      AND auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor');
END;
$$;

CREATE OR REPLACE FUNCTION fn_expire_stale_attachments()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE document_attachments
    SET upload_status = 'EXPIRED'
    WHERE upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED')
      AND reserved_at <= NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
