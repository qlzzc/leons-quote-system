const { supabase } = require('./_lib/supabase');
const { ensureProjectAccess, logAccess, requireAdmin, requireSession } = require('./_lib/auth');
const { uploadQuotePdf } = require('./_lib/quote-storage');
const { getNextQuoteVersion } = require('./_lib/project-bundles');
const { buildSchemaErrorPayload } = require('./_lib/schema-compat');
const { sendSignedQuoteNotifications } = require('./_lib/mailer');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function omitNilValues(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null));
}

async function handleAddVersion(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  if (!body.projectId || !body.quotePdf?.dataUrl) return res.status(400).json({ error: 'Project and quote PDF are required.' });
  const { data: project, error: projectError } = await supabase.from('projects').select('id, project_code, title').eq('id', body.projectId).single();
  if (projectError) throw projectError;
  const versionNumber = await getNextQuoteVersion(project.id);
  const uploadedPdf = await uploadQuotePdf({ projectCode: project.project_code, versionNumber, quotePdf: body.quotePdf });
  const makeCurrent = body.makeCurrent !== false;
  if (makeCurrent) await supabase.from('quotes').update({ is_current: false }).eq('project_id', project.id).eq('is_current', true);
  const quotePayload = omitNilValues({ project_id: project.id, version_number: versionNumber, quote_number: body.quote_number || `${project.project_code}-V${versionNumber}`, title: body.quote_title || `${project.title} Proposal`, intro: body.quote_intro || null, status: body.quote_status || 'sent', subtotal: Number(body.quote_subtotal || 0), tax: Number(body.quote_tax || 0), total: Number(body.quote_total || 0), content: body.quote_content ? { text: body.quote_content } : {}, pdf_file_path: uploadedPdf.path, pdf_file_name: uploadedPdf.fileName, is_current: makeCurrent, sent_at: new Date().toISOString() });
  const { data: quote, error: quoteError } = await supabase.from('quotes').insert(quotePayload).select().single();
  if (quoteError) throw quoteError;
  return res.status(200).json({ success: true, quote });
}

async function handleSetCurrent(req, res) {
  await requireAdmin(req);
  const body = req.body || {};
  if (!body.projectId || !body.quoteId) return res.status(400).json({ error: 'Project and quote are required.' });
  await supabase.from('quotes').update({ is_current: false }).eq('project_id', body.projectId).eq('is_current', true);
  const { data: quote, error } = await supabase.from('quotes').update({ is_current: true }).eq('id', body.quoteId).eq('project_id', body.projectId).select().single();
  if (error) throw error;
  return res.status(200).json({ success: true, quote });
}

async function handleApprove(req, res) {
  const session = await requireSession(req);
  const { projectId, quoteId } = req.body || {};
  if (!projectId || !quoteId) return res.status(400).json({ error: 'Project and quote are required.' });
  await ensureProjectAccess(session, projectId);
  const approvedAt = new Date().toISOString();
  const { error: quoteError } = await supabase.from('quotes').update({ status: 'approved', approved_at: approvedAt }).eq('id', quoteId).eq('project_id', projectId);
  if (quoteError) throw quoteError;
  await supabase.from('projects').update({ status: 'approved', phase_label: 'Contract preparation' }).eq('id', projectId);
  await logAccess({ phone: session.phone, clientId: session.client_id, projectId, quoteId, action: 'quote_approved', resourceType: 'quote', resourceId: quoteId, req });
  return res.status(200).json({ success: true, approvedAt });
}

async function handleSign(req, res) {
  const session = await requireSession(req);
  const { projectId, quoteId, signerName, signatureData, agreementAccepted } = req.body || {};
  if (!projectId || !quoteId || !signerName || !signatureData || !agreementAccepted) return res.status(400).json({ error: 'Missing required signing fields.' });
  await ensureProjectAccess(session, projectId);

  const [{ data: project, error: projectError }, { data: quote, error: quoteError }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('quotes').select('*').eq('id', quoteId).eq('project_id', projectId).maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (quoteError) throw quoteError;
  if (!project || !quote) return res.status(404).json({ error: 'Quote context could not be found.' });
  if (!quote.is_current) return res.status(400).json({ error: 'Only the current quote version can be signed.' });
  if (quote.status !== 'approved' && quote.status !== 'signed') return res.status(400).json({ error: 'This quote must be approved before it can be signed.' });

  const { data: client } = project.client_id ? await supabase.from('clients').select('id, full_name, email, primary_phone').eq('id', project.client_id).maybeSingle() : { data: null };
  const { data: existingRecord } = await supabase.from('quote_signatures').select('id, status').eq('quote_id', quoteId).eq('project_id', projectId).maybeSingle();
  if (existingRecord?.status === 'signed') return res.status(409).json({ error: 'This quote version has already been signed.' });

  const signedAt = new Date().toISOString();
  const insertPayload = { client_id: client?.id || session.client_id || null, project_id: projectId, quote_id: quoteId, quote_version_number: quote.version_number, quote_number: quote.quote_number || null, signer_name: String(signerName).trim(), signer_phone: session.phone, signature_data: signatureData, signed_at: signedAt, status: 'signed', source_pdf_path: quote.pdf_file_path || null, quote_snapshot: { project: { id: project.id, title: project.title, project_code: project.project_code, service_address: project.service_address, city: project.city, province: project.province, postal_code: project.postal_code }, client: client ? { id: client.id, full_name: client.full_name, email: client.email, primary_phone: client.primary_phone } : null, quote: { id: quote.id, version_number: quote.version_number, quote_number: quote.quote_number, title: quote.title, intro: quote.intro, status: quote.status, subtotal: quote.subtotal, tax: quote.tax, total: quote.total, content: quote.content, pdf_file_path: quote.pdf_file_path, pdf_file_name: quote.pdf_file_name, created_at: quote.created_at, updated_at: quote.updated_at } }, ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null, user_agent: req.headers['user-agent'] || null };

  const { data: signedRecord, error: insertError } = await supabase.from('quote_signatures').insert(insertPayload).select('*').single();
  if (insertError) { const sp = buildSchemaErrorPayload(insertError); if (sp) return res.status(500).json(sp); throw insertError; }

  await Promise.all([
    supabase.from('quotes').update({ status: 'signed' }).eq('id', quoteId).eq('project_id', projectId),
    supabase.from('projects').update({ status: 'signed', phase_label: 'Quote signed' }).eq('id', projectId),
  ]);

  const emailStatus = await sendSignedQuoteNotifications({ client, project, quote, signedRecord }).catch((e) => ({ admin: { sent: false, error: e.message }, client: { sent: false, error: e.message } }));
  await logAccess({ phone: session.phone, clientId: client?.id || session.client_id, projectId, quoteId, action: 'quote_signed', resourceType: 'quote', resourceId: quoteId, details: { signerName: insertPayload.signer_name, quoteVersionNumber: quote.version_number, quoteSignatureId: signedRecord.id, emailStatus }, req });

  return res.status(200).json({ success: true, signedAt, signedRecord, emailStatus });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const action = req.query.action;
  try {
    if (action === 'add-version') return await handleAddVersion(req, res);
    if (action === 'set-current') return await handleSetCurrent(req, res);
    if (action === 'approve') return await handleApprove(req, res);
    if (action === 'sign') return await handleSign(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('quotes error:', error);
    const sp = buildSchemaErrorPayload(error);
    return res.status(error.statusCode || 500).json(sp || { error: error.message || 'Quote request failed' });
  }
};
