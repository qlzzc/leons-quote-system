const { requireSession } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const session = await requireSession(req);
    return res.status(200).json({
      session: {
        phone: session.phone,
        clientId: session.client_id,
        accessRole: session.access_role,
        isAdmin: session.isAdmin
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Unauthorized' });
  }
};
