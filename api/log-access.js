const { getSessionFromToken, getBearerToken, logAccess, normalizePhone } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getBearerToken(req);
    const session = token ? await getSessionFromToken(token) : null;
    const body = req.body || {};
    await logAccess({
      phone: session?.phone || normalizePhone(body.phone),
      clientId: session?.client_id || null,
      projectId: body.projectId || null,
      quoteId: body.quoteId || null,
      contractId: body.contractId || null,
      action: body.action || 'viewed',
      resourceType: body.resourceType || null,
      resourceId: body.resourceId || null,
      details: body.details || {},
      req,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('log-access error:', error);
    return res.status(500).json({ error: 'Log failed' });
  }
};
