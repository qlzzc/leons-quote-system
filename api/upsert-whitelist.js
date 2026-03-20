const { supabase } = require('./_lib/supabase');
const { normalizePhone, requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await requireAdmin(req);
    const body = req.body || {};
    const phone = normalizePhone(body.phone);
    if (!phone || !body.project_id) {
      return res.status(400).json({ error: 'Phone and project are required.' });
    }

    const payload = {
      id: body.id || undefined,
      client_id: body.client_id ? Number(body.client_id) : null,
      project_id: body.project_id ? Number(body.project_id) : null,
      phone,
      access_role: body.access_role || 'client',
      is_active: body.is_active !== false,
      expires_at: body.expires_at || null,
      notes: body.notes || null,
    };
    console.log('upsert-whitelist payload keys', Object.keys(payload));

    const { data, error } = await supabase
      .from('whitelists')
      .upsert(payload, { onConflict: 'phone,project_id' })
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, whitelist: data });
  } catch (error) {
    console.error('upsert-whitelist error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to save whitelist entry' });
  }
};
