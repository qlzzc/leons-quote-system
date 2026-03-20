const { supabase } = require('./_lib/supabase');
const { normalizePhone, requireAdmin } = require('./_lib/auth');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const ALLOWED_FIELDS = new Set(['full_name', 'name', 'email', 'secondary_phone', 'notes', 'status']);
function toNullableString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

async function handleUpsertClient(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  if (!body.full_name) return res.status(400).json({ error: 'Client name is required.' });
  const payload = { id: body.id || undefined, full_name: body.full_name, email: body.email || null, primary_phone: normalizePhone(body.primary_phone) || null, status: body.status || 'active', notes: body.notes || null };
  const { data, error } = await supabase.from('clients').upsert(payload).select().single();
  if (error) throw error;
  return res.status(200).json({ success: true, client: data });
}

async function handleUpdateProfile(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  const clientId = body.client_id || body.clientId;
  if (!clientId) return res.status(400).json({ error: 'Client ID is required.' });
  const invalidFields = Object.keys(body).filter((key) => !['client_id', 'clientId'].includes(key) && !ALLOWED_FIELDS.has(key));
  if (invalidFields.length) return res.status(400).json({ error: `Unsupported profile fields: ${invalidFields.join(', ')}` });
  const fullName = toNullableString(body.full_name || body.name);
  if (!fullName) return res.status(400).json({ error: 'Client name is required.' });
  const updatePayload = { full_name: fullName, email: toNullableString(body.email), notes: toNullableString(body.notes), status: toNullableString(body.status) || 'active' };
  const { data: client, error: updateError } = await supabase.from('clients').update(updatePayload).eq('id', clientId).select('*').maybeSingle();
  if (updateError) throw updateError;
  if (!client) return res.status(404).json({ error: 'Client not found.' });
  const normalizedSecondaryPhone = normalizePhone(body.secondary_phone);
  if (normalizedSecondaryPhone && normalizedSecondaryPhone === client.primary_phone) return res.status(400).json({ error: 'Secondary phone must be different from the primary phone.' });
  return res.status(200).json({ success: true, client: { ...client, secondary_phone: null } });
}

async function handleUpsertWhitelist(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  const phone = normalizePhone(body.phone);
  if (!phone || !body.project_id) return res.status(400).json({ error: 'Phone and project are required.' });
  const payload = { id: body.id || undefined, client_id: body.client_id ? Number(body.client_id) : null, project_id: body.project_id ? Number(body.project_id) : null, phone, access_role: body.access_role || 'client', is_active: body.is_active !== false, expires_at: body.expires_at || null, notes: body.notes || null };
  const { data, error } = await supabase.from('whitelists').upsert(payload, { onConflict: 'phone,project_id' }).select().single();
  if (error) throw error;
  return res.status(200).json({ success: true, whitelist: data });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const action = req.query.action;
  try {
    if (action === 'upsert') return await handleUpsertClient(req, res);
    if (action === 'update-profile') return await handleUpdateProfile(req, res);
    if (action === 'upsert-whitelist') return await handleUpsertWhitelist(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('clients error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Client request failed' });
  }
};
