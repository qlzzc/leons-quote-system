const crypto = require('crypto');
const { supabase } = require('./supabase');

const ADMIN_PHONES = [
  process.env.ADMIN_PHONE_1,
  process.env.ADMIN_PHONE_2,
].filter(Boolean);

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return '';
  return String(authHeader).replace(/^Bearer\s+/i, '').trim();
}

async function getSessionFromToken(token) {
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, phone, client_id, access_role, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) {
    console.error('getSessionFromToken query failed', {
      code: error.code,
      message: error.message,
    });
    throw error;
  }
  console.log('getSessionFromToken lookup', {
    hasToken: Boolean(token),
    tokenPreview: token.slice(0, 8),
    tokenHashPreview: tokenHash.slice(0, 12),
    found: Boolean(session),
  });
  if (!session) return null;
  if (new Date() > new Date(session.expires_at)) return null;
  await supabase.from('sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id);
  return {
    ...session,
    isAdmin: session.access_role === 'admin' || ADMIN_PHONES.includes(session.phone),
  };
}

async function requireSession(req) {
  const token = getBearerToken(req);
  console.log('requireSession header check', {
    hasAuthorizationHeader: Boolean(req.headers.authorization || req.headers.Authorization),
    hasToken: Boolean(token),
    tokenPreview: token ? token.slice(0, 8) : '',
  });
  const session = await getSessionFromToken(token);
  if (!session) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

async function requireAdmin(req) {
  const session = await requireSession(req);
  if (!session.isAdmin) {
    const error = new Error('Admin access only');
    error.statusCode = 403;
    throw error;
  }
  return session;
}

async function getAuthorizedProjectsForPhone(phone) {
  const normalized = normalizePhone(phone);
  const [
    { data: phoneClients = [], error: clientsError },
    { data: whitelistRows = [], error: whitelistError },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email, primary_phone')
      .eq('primary_phone', normalized),
    supabase
      .from('whitelists')
      .select('id, phone, access_role, is_active, expires_at, client_id, project_id')
      .eq('phone', normalized)
      .eq('is_active', true),
  ]);
  if (clientsError) throw clientsError;
  if (whitelistError) throw whitelistError;

  const clientMap = new Map(phoneClients.map((client) => [String(client.id), client]));
  const ownedClientIds = [...new Set(phoneClients.map((client) => client.id).filter(Boolean))];

  const { data: ownedProjects = [], error: ownedProjectsError } = ownedClientIds.length
    ? await supabase
      .from('projects')
      .select('id, client_id, project_code, title, location, summary, status, phase_label, service_area, service_address, city, province, postal_code, created_at, updated_at')
      .in('client_id', ownedClientIds)
    : { data: [], error: null };
  if (ownedProjectsError) throw ownedProjectsError;

  const directAccessRows = ownedProjects.map((project) => ({
    id: `client-${project.client_id}-project-${project.id}`,
    phone: normalized,
    access_role: 'client',
    is_active: true,
    expires_at: null,
    client_id: project.client_id,
    project_id: project.id,
    clients: clientMap.get(String(project.client_id)) || null,
    projects: project,
  }));

  const activeWhitelistRows = (whitelistRows || []).filter((item) => !item.expires_at || new Date(item.expires_at) > new Date());
  const whitelistClientIds = [...new Set(activeWhitelistRows.map((item) => item.client_id).filter(Boolean).filter((id) => !clientMap.has(String(id))))];
  const whitelistProjectIds = [...new Set(activeWhitelistRows.map((item) => item.project_id).filter(Boolean).filter((id) => !ownedProjects.some((project) => String(project.id) === String(id))))];

  const [{ data: whitelistClients = [] }, { data: whitelistProjects = [] }] = await Promise.all([
    whitelistClientIds.length
      ? supabase.from('clients').select('id, full_name, email, primary_phone').in('id', whitelistClientIds)
      : Promise.resolve({ data: [] }),
    whitelistProjectIds.length
      ? supabase.from('projects').select('id, client_id, project_code, title, location, summary, status, phase_label, service_area, service_address, city, province, postal_code, created_at, updated_at').in('id', whitelistProjectIds)
      : Promise.resolve({ data: [] }),
  ]);

  whitelistClients.forEach((client) => clientMap.set(String(client.id), client));
  const projectMap = new Map(ownedProjects.map((project) => [String(project.id), project]));
  whitelistProjects.forEach((project) => projectMap.set(String(project.id), project));

  const whitelistAccessRows = activeWhitelistRows.map((item) => ({
    ...item,
    clients: item.client_id ? clientMap.get(String(item.client_id)) || null : null,
    projects: item.project_id ? projectMap.get(String(item.project_id)) || null : null,
  }));

  const seen = new Set();
  return [...directAccessRows, ...whitelistAccessRows].filter((item) => {
    const key = `${item.client_id || 'none'}:${item.project_id || 'none'}:${item.access_role || 'client'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ensureProjectAccess(session, projectId) {
  if (session.isAdmin) return true;
  const projects = await getAuthorizedProjectsForPhone(session.phone);
  const allowed = projects.some((entry) => String(entry.project_id) === String(projectId));
  if (!allowed) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }
  return true;
}

async function logAccess({ phone, clientId = null, projectId = null, quoteId = null, contractId = null, action, resourceType = null, resourceId = null, details = {}, req }) {
  try {
    await supabase.from('access_logs').insert({
      phone,
      client_id: clientId,
      project_id: projectId,
      quote_id: quoteId,
      contract_id: contractId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: req ? getIp(req) : null,
      user_agent: req?.headers['user-agent'] || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('logAccess failed', error);
  }
}

module.exports = {
  ADMIN_PHONES,
  ensureProjectAccess,
  getAuthorizedProjectsForPhone,
  getBearerToken,
  getIp,
  getSessionFromToken,
  logAccess,
  normalizePhone,
  requireAdmin,
  requireSession,
};
