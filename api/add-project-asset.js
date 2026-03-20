const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');
const { uploadProjectAsset } = require('./_lib/project-asset-storage');

const ALLOWED_ASSET_TYPES = new Set(['render', 'reference', 'photo', 'document', 'attachment']);

function toNullableInteger(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const assetType = String(body.asset_type || body.file_type || 'document').toLowerCase();

    if (!body.projectId || !body.title || !body.assetFile?.dataUrl) {
      return res.status(400).json({ error: 'Project, asset title, and file upload are required.' });
    }
    if (!ALLOWED_ASSET_TYPES.has(assetType)) {
      return res.status(400).json({ error: 'Asset type is not supported.' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_code')
      .eq('id', body.projectId)
      .single();
    if (projectError) throw projectError;

    const uploadedAsset = await uploadProjectAsset({
      projectCode: project.project_code,
      assetFile: body.assetFile,
      assetType,
    });

    const payload = {
      project_id: project.id,
      quote_id: body.quote_id || null,
      asset_type: assetType,
      title: body.title,
      description: body.description || null,
      file_url: uploadedAsset.path,
      sort_order: toNullableInteger(body.sort_order, 0),
      is_client_visible: body.is_client_visible !== false,
    };

    const { data: asset, error } = await supabase
      .from('project_assets')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, asset });
  } catch (error) {
    console.error('add-project-asset error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to upload project asset' });
  }
};
