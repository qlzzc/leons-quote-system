const { supabase } = require('./_lib/supabase');
const { normalizePhone, requireAdmin } = require('./_lib/auth');

const ALLOWED_FIELDS = new Set([
  'full_name',
  'name',
  'email',
  'secondary_phone',
  'notes',
  'status',
]);

function toNullableString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await requireAdmin(req);
    const body = req.body || {};
    const clientId = body.client_id || body.clientId;
    if (!clientId) return res.status(400).json({ error: 'Client ID is required.' });

    const invalidFields = Object.keys(body).filter((key) => !['client_id', 'clientId'].includes(key) && !ALLOWED_FIELDS.has(key));
    if (invalidFields.length) {
      return res.status(400).json({ error: `Unsupported profile fields: ${invalidFields.join(', ')}` });
    }

    const fullName = toNullableString(body.full_name || body.name);
    if (!fullName) return res.status(400).json({ error: 'Client name is required.' });

    const updatePayload = {
      full_name: fullName,
      email: toNullableString(body.email),
      notes: toNullableString(body.notes),
      status: toNullableString(body.status) || 'active',
    };

    const { data: client, error: updateError } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', clientId)
      .select('*')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!client) return res.status(404).json({ error: 'Client not found.' });

    const normalizedSecondaryPhone = normalizePhone(body.secondary_phone);
    if (normalizedSecondaryPhone && normalizedSecondaryPhone === client.primary_phone) {
      return res.status(400).json({ error: 'Secondary phone must be different from the primary phone.' });
    }

    return res.status(200).json({
      success: true,
      client: {
        ...client,
        secondary_phone: null,
      },
    });
  } catch (error) {
    console.error('update-client-profile error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update client profile' });
  }
};
