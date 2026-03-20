const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');

function omitUndefined(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
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

    if (!body.projectId) {
      return res.status(400).json({ error: 'Project is required.' });
    }

    const payload = omitUndefined({
      title: body.title || null,
      summary: body.summary || null,
      status: body.status || null,
      phase_label: body.phase_label || null,
      service_address: body.service_address || null,
      city: body.city || null,
      province: body.province || null,
      postal_code: body.postal_code || null,
      internal_notes: body.internal_notes || null,
      location: [body.city, body.province].filter(Boolean).join(', ') || null,
    });

    if (!payload.title || !payload.service_address) {
      return res.status(400).json({ error: 'Project title and service address are required.' });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', body.projectId)
      .select('id, client_id, project_code, title, summary, status, phase_label, service_address, city, province, postal_code, internal_notes, location, updated_at')
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, project });
  } catch (error) {
    console.error('update-project-basics error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update project basics' });
  }
};
