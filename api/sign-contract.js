const { supabase } = require('./_lib/supabase');
const { ensureProjectAccess, logAccess, requireSession } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const session = await requireSession(req);
    const { projectId, contractId, signerName, signatureData, consentText } = req.body || {};
    if (!projectId || !contractId || !signerName || !signatureData) {
      return res.status(400).json({ error: 'Missing required signing fields.' });
    }
    await ensureProjectAccess(session, projectId);

    const signedAt = new Date().toISOString();
    const { error: signatureError } = await supabase
      .from('contract_signatures')
      .insert({
        contract_id: contractId,
        signer_role: 'client',
        signer_name: signerName,
        signer_phone: session.phone,
        signature_data: signatureData,
        consent_text: consentText || 'Electronic signature consent provided by client.',
        signed_at: signedAt,
        ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
      });
    if (signatureError) throw signatureError;

    await supabase
      .from('contracts')
      .update({ status: 'signed', signed_at: signedAt })
      .eq('id', contractId);

    await supabase
      .from('projects')
      .update({ status: 'signed', phase_label: 'Signed and scheduled' })
      .eq('id', projectId);

    await logAccess({
      phone: session.phone,
      clientId: session.client_id,
      projectId,
      contractId,
      action: 'contract_signed',
      resourceType: 'contract',
      resourceId: contractId,
      details: { signerName },
      req,
    });

    return res.status(200).json({ success: true, signedAt });
  } catch (error) {
    console.error('sign-contract error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to sign contract' });
  }
};
