const { supabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/auth');
const { uploadQuotePdf } = require('./_lib/quote-storage');
const { getNextQuoteVersion } = require('./_lib/project-bundles');

function omitNilValues(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
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
    if (!body.client_id || !body.project_code || !body.title || !body.service_address) {
      return res.status(400).json({ error: 'Client, project code, project title, and service address are required.' });
    }
    if (!body.quotePdf?.dataUrl) {
      return res.status(400).json({ error: 'Upload the first quote PDF before saving the project.' });
    }

    const projectPayload = omitNilValues({
      id: body.id || undefined,
      client_id: Number(body.client_id),
      project_code: body.project_code,
      title: body.title,
      summary: body.summary || null,
      internal_notes: body.internal_notes || null,
      status: body.status || 'proposal_sent',
      phase_label: body.phase_label || 'Initial Quote',
      service_area: body.service_area || null,
      location: [body.city, body.province].filter(Boolean).join(', ') || null,
      service_address: body.service_address || null,
      city: body.city || null,
      province: body.province || null,
      postal_code: body.postal_code || null,
    });
    console.log('upsert-project project payload keys', Object.keys(projectPayload));

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .upsert(projectPayload, { onConflict: 'project_code' })
      .select()
      .single();
    if (projectError) throw projectError;

    const versionNumber = await getNextQuoteVersion(project.id);
    const uploadedPdf = await uploadQuotePdf({
      projectCode: project.project_code,
      versionNumber,
      quotePdf: body.quotePdf,
    });

    const quotePayload = omitNilValues({
      project_id: project.id,
      version_number: versionNumber,
      quote_number: body.quote_number || `${project.project_code}-V${versionNumber}`,
      title: body.quote_title || `${project.title} Proposal`,
      intro: body.quote_intro || null,
      status: body.quote_status || 'sent',
      subtotal: Number(body.quote_subtotal || 0),
      tax: Number(body.quote_tax || 0),
      total: Number(body.quote_total || 0),
      content: body.quote_content ? { text: body.quote_content } : {},
      pdf_file_path: uploadedPdf.path,
      pdf_file_name: uploadedPdf.fileName,
      is_current: true,
      sent_at: new Date().toISOString(),
    });
    console.log('upsert-project quote payload keys', Object.keys(quotePayload));

    await supabase
      .from('quotes')
      .update({ is_current: false })
      .eq('project_id', project.id)
      .eq('is_current', true);

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert(quotePayload)
      .select()
      .single();
    if (quoteError) throw quoteError;

    return res.status(200).json({ success: true, project, quote });
  } catch (error) {
    console.error('upsert-project error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to save project' });
  }
};
