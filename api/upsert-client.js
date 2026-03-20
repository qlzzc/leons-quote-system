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
    if (!body.full_name) return res.status(400).json({ error: 'Client name is required.' });

    const payload = {
      id: body.id || undefined,
      full_name: body.full_name,
      email: body.email || null,
      primary_phone: normalizePhone(body.primary_phone) || null,
      status: body.status || 'active',
      notes: body.notes || null,
    };

    const { data, error } = await supabase
      .from('clients')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, client: data });
  } catch (error) {
    console.error('upsert-client error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to save client' });
  }
};
