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

    const [{ data: clients = [] }, { data: projects = [] }, { data: whitelists = [] }, { data: logs = [] }] = await Promise.all([
      supabase.from('clients').select('*').order('updated_at', { ascending: false }).limit(50),
      supabase.from('projects').select('*').order('updated_at', { ascending: false }).limit(50),
      supabase.from('whitelists').select('*').order('updated_at', { ascending: false }).limit(100),
      supabase.from('access_logs').select('*').order('timestamp', { ascending: false }).limit(100),
    ]);

    const projectIds = [...new Set(projects.map((project) => project.id).filter(Boolean))];
    const clientMap = new Map(clients.map((client) => [String(client.id), client]));
    const projectMap = new Map(projects.map((project) => [String(project.id), project]));

    const { data: currentQuotes = [] } = projectIds.length
      ? await supabase
        .from('quotes')
        .select('project_id, version_number, status, updated_at')
        .in('project_id', projectIds)
        .eq('is_current', true)
      : { data: [] };

    const currentQuoteMap = new Map(currentQuotes.map((quote) => [String(quote.project_id), quote]));

    const decoratedClients = clients.map((client) => ({
      ...client,
      secondary_phone: null,
    }));

    const decoratedProjects = projects.map((project) => ({
      ...project,
      clients: project.client_id ? clientMap.get(String(project.client_id)) || null : null,
      current_quote_version: currentQuoteMap.get(String(project.id))?.version_number || null,
      current_quote_status: currentQuoteMap.get(String(project.id))?.status || null,
    }));

    const decoratedWhitelists = whitelists.map((item) => ({
      ...item,
      clients: item.client_id ? clientMap.get(String(item.client_id)) || null : null,
      projects: item.project_id ? projectMap.get(String(item.project_id)) || null : null,
    }));

    return res.status(200).json({
      stats: {
        clients: clients.length || 0,
        projects: projects.length || 0,
        whitelists: whitelists.length || 0,
        logs: logs.length || 0,
      },
      clients: decoratedClients,
      projects: decoratedProjects,
      whitelists: decoratedWhitelists,
      logs,
    });
  } catch (error) {
    console.error('admin-dashboard error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load admin dashboard' });
  }
};
