const { supabase } = require('./_lib/supabase');
const { ensureProjectAccess, logAccess, requireSession } = require('./_lib/auth');
const { buildSchemaErrorPayload } = require('./_lib/schema-compat');
const { sendSignedQuoteNotifications } = require('./_lib/mailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const session = await requireSession(req);
    const { projectId, quoteId, signerName, signatureData, agreementAccepted } = req.body || {};
    if (!projectId || !quoteId || !signerName || !signatureData || !agreementAccepted) {
      return res.status(400).json({ error: 'Missing required signing fields.' });
    }
    await ensureProjectAccess(session, projectId);

    const [{ data: project, error: projectError }, { data: quote, error: quoteError }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
      supabase.from('quotes').select('*').eq('id', quoteId).eq('project_id', projectId).maybeSingle(),
    ]);
    if (projectError) throw projectError;
    if (quoteError) throw quoteError;
    if (!project || !quote) return res.status(404).json({ error: 'Quote context could not be found.' });
    if (!quote.is_current) return res.status(400).json({ error: 'Only the current quote version can be signed.' });
    if (quote.status !== 'approved' && quote.status !== 'signed') {
      return res.status(400).json({ error: 'This quote must be approved before it can be signed.' });
    }

    const { data: client, error: clientError } = project.client_id
      ? await supabase.from('clients').select('id, full_name, email, primary_phone').eq('id', project.client_id).maybeSingle()
      : { data: null, error: null };
    if (clientError) throw clientError;

    const { data: existingRecord, error: existingError } = await supabase
      .from('quote_signatures')
      .select('id, status')
      .eq('quote_id', quoteId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingRecord?.status === 'signed') {
      return res.status(409).json({ error: 'This quote version has already been signed.' });
    }

    const signedAt = new Date().toISOString();
    const insertPayload = {
      client_id: client?.id || session.client_id || null,
      project_id: projectId,
      quote_id: quoteId,
      quote_version_number: quote.version_number,
      quote_number: quote.quote_number || null,
      signer_name: String(signerName).trim(),
      signer_phone: session.phone,
      signature_data: signatureData,
      signed_at: signedAt,
      status: 'signed',
      source_pdf_path: quote.pdf_file_path || null,
      quote_snapshot: {
        project: {
          id: project.id,
          title: project.title,
          project_code: project.project_code,
          service_address: project.service_address,
          city: project.city,
          province: project.province,
          postal_code: project.postal_code,
        },
        client: client
          ? {
            id: client.id,
            full_name: client.full_name,
            email: client.email,
            primary_phone: client.primary_phone,
          }
          : null,
        quote: {
          id: quote.id,
          version_number: quote.version_number,
          quote_number: quote.quote_number,
          title: quote.title,
          intro: quote.intro,
          status: quote.status,
          subtotal: quote.subtotal,
          tax: quote.tax,
          total: quote.total,
          content: quote.content,
          pdf_file_path: quote.pdf_file_path,
          pdf_file_name: quote.pdf_file_name,
          created_at: quote.created_at,
          updated_at: quote.updated_at,
        },
      },
      ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
      user_agent: req.headers['user-agent'] || null,
    };

    const { data: signedRecord, error: insertError } = await supabase
      .from('quote_signatures')
      .insert(insertPayload)
      .select('*')
      .single();
    if (insertError) {
      const schemaPayload = buildSchemaErrorPayload(insertError);
      if (schemaPayload) return res.status(500).json(schemaPayload);
      throw insertError;
    }

    await Promise.all([
      supabase.from('quotes').update({ status: 'signed' }).eq('id', quoteId).eq('project_id', projectId),
      supabase.from('projects').update({ status: 'signed', phase_label: 'Quote signed' }).eq('id', projectId),
    ]);

    const emailStatus = await sendSignedQuoteNotifications({
      client,
      project,
      quote,
      signedRecord,
    }).catch((error) => {
      console.error('sendSignedQuoteNotifications error:', error);
      return {
        admin: { sent: false, skipped: false, error: error.message },
        client: { sent: false, skipped: false, error: error.message },
      };
    });

    await logAccess({
      phone: session.phone,
      clientId: client?.id || session.client_id,
      projectId,
      quoteId,
      action: 'quote_signed',
      resourceType: 'quote',
      resourceId: quoteId,
      details: {
        signerName: insertPayload.signer_name,
        quoteVersionNumber: quote.version_number,
        quoteSignatureId: signedRecord.id,
        emailStatus,
      },
      req,
    });

    return res.status(200).json({ success: true, signedAt, signedRecord, emailStatus });
  } catch (error) {
    console.error('sign-quote error:', error);
    const schemaPayload = buildSchemaErrorPayload(error);
    if (schemaPayload) return res.status(500).json(schemaPayload);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to sign quote' });
  }
};
