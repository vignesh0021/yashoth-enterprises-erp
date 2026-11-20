// Supabase Edge Function: verify-and-commit-attachment
// Server-side trusted verification of uploaded receipt binaries in private bucket `erp-receipts`.
// Uses SUPABASE_SERVICE_ROLE_KEY strictly on server; never exposed to frontend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BYTES = 5_242_880; // 5 MB app cap

function hasValidMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  if (mimeType === 'image/webp') {
    // RIFF....WEBP
    return (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    );
  }
  if (mimeType === 'image/jpeg') {
    // FF D8 FF
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'application/pdf') {
    // %PDF-
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return new Response(JSON.stringify({ error: 'Missing server config or Authorization header' }), { status: 401 });
  }

  // 1. Verify caller JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const attachmentId = body?.attachment_id as string | undefined;
  if (!attachmentId) {
    return new Response(JSON.stringify({ error: 'attachment_id is required' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // 2. Fetch attachment row
  const { data: att, error: attErr } = await admin
    .from('document_attachments')
    .select('*')
    .eq('id', attachmentId)
    .single();

  if (attErr || !att) {
    return new Response(JSON.stringify({ error: 'Attachment reservation not found' }), { status: 404 });
  }

  // Idempotent replay if already COMMITTED
  if (att.upload_status === 'COMMITTED') {
    return new Response(JSON.stringify({ status: 'COMMITTED', attachment_id: att.id }), { status: 200 });
  }

  // 3. Verify company membership
  const { data: membership } = await admin
    .from('company_memberships')
    .select('role')
    .eq('company_id', att.company_id)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Forbidden: cross-company access denied' }), { status: 403 });
  }

  // 4. Download object from private bucket and validate size + magic bytes
  const { data: fileBlob, error: dlErr } = await admin.storage
    .from(att.storage_bucket || 'erp-receipts')
    .download(att.storage_path);

  if (dlErr || !fileBlob) {
    return new Response(JSON.stringify({ error: 'Uploaded binary not found in storage' }), { status: 404 });
  }

  const buf = new Uint8Array(await fileBlob.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES || !hasValidMagicBytes(buf, att.mime_type)) {
    // Reject and purge spoofed/oversized object
    const toRemove = [att.storage_path, ...(att.thumbnail_path ? [att.thumbnail_path] : [])];
    await admin.storage.from(att.storage_bucket || 'erp-receipts').remove(toRemove);
    await admin
      .from('document_attachments')
      .update({ upload_status: 'REJECTED' })
      .eq('id', att.id);

    return new Response(JSON.stringify({ status: 'REJECTED', error: 'Invalid file signature or size limit exceeded' }), {
      status: 422,
    });
  }

  // 5. Commit metadata
  await admin
    .from('document_attachments')
    .update({ upload_status: 'COMMITTED', committed_at: new Date().toISOString() })
    .eq('id', att.id);

  return new Response(JSON.stringify({ status: 'COMMITTED', attachment_id: att.id }), { status: 200 });
});
