const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await requireAdmin(req);
    const body = req.body || {};
    if (!body.projectId || !body.quoteId) {
      return res.status(400).json({ error: 'Project and quote are required.' });
    }

    await supabase
      .from('quotes')
      .update({ is_current: false })
      .eq('project_id', body.projectId)
      .eq('is_current', true);

    const { data: quote, error } = await supabase
      .from('quotes')
      .update({ is_current: true })
      .eq('id', body.quoteId)
      .eq('project_id', body.projectId)
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, quote });
  } catch (error) {
    console.error('set-current-quote error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update current quote' });
  }
};
