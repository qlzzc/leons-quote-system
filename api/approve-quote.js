const { supabase } = require('./_lib/supabase');
const { ensureProjectAccess, logAccess, requireSession } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const session = await requireSession(req);
    const { projectId, quoteId } = req.body || {};
    if (!projectId || !quoteId) return res.status(400).json({ error: 'Project and quote are required.' });
    await ensureProjectAccess(session, projectId);

    const approvedAt = new Date().toISOString();
    const { error: quoteError } = await supabase
      .from('quotes')
      .update({ status: 'approved', approved_at: approvedAt })
      .eq('id', quoteId)
      .eq('project_id', projectId);
    if (quoteError) throw quoteError;

    await supabase
      .from('projects')
      .update({ status: 'approved', phase_label: 'Contract preparation' })
      .eq('id', projectId);

    await logAccess({
      phone: session.phone,
      clientId: session.client_id,
      projectId,
      quoteId,
      action: 'quote_approved',
      resourceType: 'quote',
      resourceId: quoteId,
      req,
    });

    return res.status(200).json({ success: true, approvedAt });
  } catch (error) {
    console.error('approve-quote error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to approve quote' });
  }
};
