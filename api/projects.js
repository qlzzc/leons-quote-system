const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');
const { uploadQuotePdf } = require('./_lib/quote-storage');
const { getNextQuoteVersion } = require('./_lib/project-bundles');
const { loadProjectRemovalState } = require('./_lib/project-removal');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function omitNilValues(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null));
}
function omitUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}

async function handleUpsert(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  if (!body.client_id || !body.project_code || !body.title || !body.service_address) return res.status(400).json({ error: 'Client, project code, project title, and service address are required.' });
  if (!body.quotePdf?.dataUrl) return res.status(400).json({ error: 'Upload the first quote PDF before saving the project.' });

  const projectPayload = omitNilValues({ id: body.id || undefined, client_id: Number(body.client_id), project_code: body.project_code, title: body.title, summary: body.summary || null, internal_notes: body.internal_notes || null, status: body.status || 'proposal_sent', phase_label: body.phase_label || 'Initial Quote', service_area: body.service_area || null, location: [body.city, body.province].filter(Boolean).join(', ') || null, service_address: body.service_address || null, city: body.city || null, province: body.province || null, postal_code: body.postal_code || null });
  const { data: project, error: projectError } = await supabase.from('projects').upsert(projectPayload, { onConflict: 'project_code' }).select().single();
  if (projectError) throw projectError;

  const versionNumber = await getNextQuoteVersion(project.id);
  const uploadedPdf = await uploadQuotePdf({ projectCode: project.project_code, versionNumber, quotePdf: body.quotePdf });

  const quotePayload = omitNilValues({ project_id: project.id, version_number: versionNumber, quote_number: body.quote_number || `${project.project_code}-V${versionNumber}`, title: body.quote_title || `${project.title} Proposal`, intro: body.quote_intro || null, status: body.quote_status || 'sent', subtotal: Number(body.quote_subtotal || 0), tax: Number(body.quote_tax || 0), total: Number(body.quote_total || 0), content: body.quote_content ? { text: body.quote_content } : {}, pdf_file_path: uploadedPdf.path, pdf_file_name: uploadedPdf.fileName, is_current: true, sent_at: new Date().toISOString() });

  await supabase.from('quotes').update({ is_current: false }).eq('project_id', project.id).eq('is_current', true);
  const { data: quote, error: quoteError } = await supabase.from('quotes').insert(quotePayload).select().single();
  if (quoteError) throw quoteError;

  return res.status(200).json({ success: true, project, quote });
}

async function handleUpdateBasics(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  if (!body.projectId) return res.status(400).json({ error: 'Project is required.' });
  const payload = omitUndefined({ title: body.title || null, summary: body.summary || null, status: body.status || null, phase_label: body.phase_label || null, service_address: body.service_address || null, city: body.city || null, province: body.province || null, postal_code: body.postal_code || null, internal_notes: body.internal_notes || null, location: [body.city, body.province].filter(Boolean).join(', ') || null });
  if (!payload.title || !payload.service_address) return res.status(400).json({ error: 'Project title and service address are required.' });
  const { data: project, error } = await supabase.from('projects').update(payload).eq('id', body.projectId).select('id, client_id, project_code, title, summary, status, phase_label, service_address, city, province, postal_code, internal_notes, location, updated_at').single();
  if (error) throw error;
  return res.status(200).json({ success: true, project });
}

async function handleArchive(req, res) {
  await requireAdmin(req);
  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'Project is required.' });
  await loadProjectRemovalState(projectId);
  const { data: project, error } = await supabase.from('projects').update({ status: 'archived', phase_label: 'Archived project' }).eq('id', projectId).select('id, project_code, title, status, phase_label, updated_at').single();
  if (error) throw error;
  return res.status(200).json({ success: true, project, archived: true });
}

async function handleDelete(req, res) {
  await requireAdmin(req);
  const { projectId, confirmationText } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'Project is required.' });
  if (String(confirmationText || '').trim().toUpperCase() !== 'DELETE') return res.status(400).json({ error: 'Deletion confirmation failed.' });
  const removalState = await loadProjectRemovalState(projectId);
  if (!removalState.canHardDelete) return res.status(409).json({ error: 'This project has related records. Archive it instead.', relatedCounts: removalState.relatedCounts });
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
  return res.status(200).json({ success: true, deleted: true, wasTestProject: removalState.isTestProject });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const action = req.query.action;
  try {
    if (action === 'upsert') return await handleUpsert(req, res);
    if (action === 'update-basics') return await handleUpdateBasics(req, res);
    if (action === 'archive') return await handleArchive(req, res);
    if (action === 'delete') return await handleDelete(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('projects error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Project request failed' });
  }
};
