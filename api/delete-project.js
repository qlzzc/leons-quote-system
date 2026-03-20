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
    const { projectId, confirmationText } = req.body || {};
    if (!projectId) {
      return res.status(400).json({ error: 'Project is required.' });
    }
    if (String(confirmationText || '').trim().toUpperCase() !== 'DELETE') {
      return res.status(400).json({ error: 'Deletion confirmation failed.' });
    }

    const removalState = await loadProjectRemovalState(projectId);
    if (!removalState.canHardDelete) {
      return res.status(409).json({
        error: 'This project has related quotes, assets, contracts, or signatures. Archive it instead of deleting it.',
        relatedCounts: removalState.relatedCounts,
      });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (error) throw error;

    return res.status(200).json({
      success: true,
      deleted: true,
      wasTestProject: removalState.isTestProject,
    });
  } catch (error) {
    console.error('delete-project error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete project' });
  }
};
