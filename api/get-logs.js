const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    await requireAdmin(req);
    const { data: logs, error } = await supabase
      .from('access_logs')
      .select(`
        id,
        phone,
        action,
        resource_type,
        resource_id,
        ip_address,
        timestamp,
        projects:project_id ( title, project_code ),
        quotes:quote_id ( quote_number ),
        clients:client_id ( full_name )
      `)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.status(200).json({ logs: logs || [] });
  } catch (error) {
    console.error('get-logs error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch logs' });
  }
};
