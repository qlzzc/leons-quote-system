const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');
const { loadProjectRemovalState } = require('./_lib/project-removal');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await requireAdmin(req);
    const { projectId } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'Project is required.' });
    }

    await loadProjectRemovalState(projectId);

    const { data: project, error } = await supabase
      .from('projects')
      .update({ status: 'archived', phase_label: 'Archived project' })
      .eq('id', projectId)
      .select('id, project_code, title, status, phase_label, updated_at')
      .single();
    if (error) throw error;

    return res.status(200).json({
      success: true,
      project,
      archived: true,
    });
  } catch (error) {
    console.error('archive-project error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to archive project' });
  }
};
