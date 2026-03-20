const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function handleDashboard(req, res) {
  await requireAdmin(req);
  const [{ data: clients = [] }, { data: projects = [] }, { data: whitelists = [] }, { data: logs = [] }] = await Promise.all([
    supabase.from('clients').select('*').order('updated_at', { ascending: false }).limit(50),
    supabase.from('projects').select('*').order('updated_at', { ascending: false }).limit(50),
    supabase.from('whitelists').select('*').order('updated_at', { ascending: false }).limit(100),
    supabase.from('access_logs').select('*').order('timestamp', { ascending: false }).limit(100),
  ]);

  const projectIds = [...new Set(projects.map((p) => p.id).filter(Boolean))];
  const clientMap = new Map(clients.map((c) => [String(c.id), c]));
  const projectMap = new Map(projects.map((p) => [String(p.id), p]));

  const { data: currentQuotes = [] } = projectIds.length
    ? await supabase.from('quotes').select('project_id, version_number, status, updated_at').in('project_id', projectIds).eq('is_current', true)
    : { data: [] };
  const currentQuoteMap = new Map(currentQuotes.map((q) => [String(q.project_id), q]));

  return res.status(200).json({
    stats: { clients: clients.length, projects: projects.length, whitelists: whitelists.length, logs: logs.length },
    clients: clients.map((c) => ({ ...c, secondary_phone: null })),
    projects: projects.map((p) => ({ ...p, clients: p.client_id ? clientMap.get(String(p.client_id)) || null : null, current_quote_version: currentQuoteMap.get(String(p.id))?.version_number || null, current_quote_status: currentQuoteMap.get(String(p.id))?.status || null })),
    whitelists: whitelists.map((w) => ({ ...w, clients: w.client_id ? clientMap.get(String(w.client_id)) || null : null, projects: w.project_id ? projectMap.get(String(w.project_id)) || null : null })),
    logs,
  });
}

async function handleLogs(req, res) {
  await requireAdmin(req);
  const { data: logs, error } = await supabase.from('access_logs').select('id, phone, action, resource_type, resource_id, ip_address, timestamp, projects:project_id ( title, project_code ), quotes:quote_id ( quote_number ), clients:client_id ( full_name )').order('timestamp', { ascending: false }).limit(200);
  if (error) throw error;
  return res.status(200).json({ logs: logs || [] });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();
  const action = req.query.action;
  try {
    if (action === 'dashboard') return await handleDashboard(req, res);
    if (action === 'logs') return await handleLogs(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('admin error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Admin request failed' });
  }
};
