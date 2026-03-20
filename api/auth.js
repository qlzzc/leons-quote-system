const twilio = require('twilio');
const crypto = require('crypto');
const { supabase } = require('./_lib/supabase');
const { ADMIN_PHONES, getAuthorizedProjectsForPhone, getIp, logAccess, normalizePhone } = require('./_lib/auth');
const { storeOtpCode, deleteOtpCode, findOtpCode, incrementOtpAttempts } = require('./_lib/otp-codes');
const { buildSchemaErrorPayload, supportsColumn } = require('./_lib/schema-compat');

const DEV_BYPASS_PHONE = normalizePhone('+17789262989');
const DEV_BYPASS_OTP = '111111';
const VERIFY_MAX_ATTEMPTS = 5;
const RATE_LIMIT = { WINDOW_MINUTES: 10, MAX_BY_IP: 5, MAX_BY_PHONE: 3, LOCKOUT_HOURS: 1 };

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function isDevOtpBypassPhone(phone) {
  return !isProductionEnv() && normalizePhone(phone) === DEV_BYPASS_PHONE;
}

function getDevRelaxVerifyPhones() {
  return String(process.env.DEV_RELAX_VERIFY_PHONES || '').split(',').map((p) => normalizePhone(p)).filter(Boolean);
}

function isDevRelaxVerifyPhone(phone) {
  if (isProductionEnv()) return false;
  return getDevRelaxVerifyPhones().includes(normalizePhone(phone));
}

async function checkRateLimit(identifier, type, contextKey, maxRequests) {
  const windowStart = new Date(Date.now() - RATE_LIMIT.WINDOW_MINUTES * 60 * 1000).toISOString();
  const hasContextKey = await supportsColumn('rate_limits', 'context_key');
  let query = supabase.from('rate_limits').select('request_count, locked_until, window_start').eq('identifier', identifier).eq('identifier_type', type);
  if (hasContextKey) query = query.eq('context_key', contextKey);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return { locked: false };
  if (data.locked_until && new Date() < new Date(data.locked_until)) {
    return { locked: true, lockedUntil: new Date(data.locked_until).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) };
  }
  if (new Date(data.window_start) > new Date(windowStart) && data.request_count >= maxRequests) {
    const lockedUntil = new Date(Date.now() + RATE_LIMIT.LOCKOUT_HOURS * 60 * 60 * 1000);
    let lockQuery = supabase.from('rate_limits').update({ locked_until: lockedUntil.toISOString() }).eq('identifier', identifier).eq('identifier_type', type);
    if (hasContextKey) lockQuery = lockQuery.eq('context_key', contextKey);
    await lockQuery;
    return { locked: true, lockedUntil: lockedUntil.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }) };
  }
  return { locked: false };
}

async function incrementRateLimit(identifier, type, contextKey) {
  const windowStart = new Date(Date.now() - RATE_LIMIT.WINDOW_MINUTES * 60 * 1000).toISOString();
  const hasContextKey = await supportsColumn('rate_limits', 'context_key');
  let query = supabase.from('rate_limits').select('id, request_count, window_start').eq('identifier', identifier).eq('identifier_type', type);
  if (hasContextKey) query = query.eq('context_key', contextKey);
  const { data: existing, error } = await query.maybeSingle();
  if (error) throw error;
  if (!existing) {
    const payload = { identifier, identifier_type: type, request_count: 1, window_start: new Date().toISOString() };
    if (hasContextKey) payload.context_key = contextKey;
    await supabase.from('rate_limits').insert(payload);
    return;
  }
  if (new Date(existing.window_start) < new Date(windowStart)) {
    await supabase.from('rate_limits').update({ request_count: 1, window_start: new Date().toISOString(), locked_until: null }).eq('id', existing.id);
    return;
  }
  await supabase.from('rate_limits').update({ request_count: existing.request_count + 1 }).eq('id', existing.id);
}

async function handleSendOtp(req, res) {
  const rawPhone = req.body?.phone;
  const phone = normalizePhone(rawPhone);
  const ip = getIp(req);
  if (!phone) return res.status(400).json({ error: 'A valid phone number is required.' });

  const ipCheck = await checkRateLimit(ip, 'ip', 'portal', RATE_LIMIT.MAX_BY_IP);
  if (ipCheck.locked) {
    await logAccess({ phone, action: 'blocked_ip', details: { lockedUntil: ipCheck.lockedUntil }, req });
    return res.status(429).json({ error: `Too many requests from this network. Try again after ${ipCheck.lockedUntil}.` });
  }
  const phoneCheck = await checkRateLimit(phone, 'phone', 'portal', RATE_LIMIT.MAX_BY_PHONE);
  if (phoneCheck.locked) {
    await logAccess({ phone, action: 'blocked_phone', details: { lockedUntil: phoneCheck.lockedUntil }, req });
    return res.status(429).json({ error: `Too many verification attempts. Try again after ${phoneCheck.lockedUntil}.` });
  }

  const isAdmin = ADMIN_PHONES.includes(phone);
  const authorizedProjects = isAdmin ? [] : await getAuthorizedProjectsForPhone(phone);
  if (!isAdmin && authorizedProjects.length === 0) {
    await logAccess({ phone, action: 'blocked_not_whitelisted', resourceType: 'portal', req });
    return res.status(401).json({ error: 'This phone number is not authorized for portal access. Please contact the studio.' });
  }

  await incrementRateLimit(ip, 'ip', 'portal');
  await incrementRateLimit(phone, 'phone', 'portal');

  const otp = isDevOtpBypassPhone(phone) ? DEV_BYPASS_OTP : String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash('sha256').update(otp + process.env.OTP_SALT).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await storeOtpCode({ phone, quoteId: null, otpHash, expiresAt, contextKey: 'portal' });

  if (!isDevOtpBypassPhone(phone)) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your Leon's Venetian Plaster portal verification code is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
  }

  await logAccess({ phone, clientId: authorizedProjects[0]?.client_id || null, projectId: authorizedProjects[0]?.project_id || null, action: 'otp_sent', resourceType: 'portal', details: { projectCount: authorizedProjects.length, devBypass: isDevOtpBypassPhone(phone) }, req });
  return res.status(200).json({ success: true });
}

async function handleVerifyOtp(req, res) {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || '').trim();
  if (!phone || !code) return res.status(400).json({ error: 'Phone number and verification code are required.' });

  let record = await findOtpCode(phone, 'portal');
  if (!record) return res.status(401).json({ error: 'No verification code found. Please request a new one.' });
  if (new Date() > new Date(record.expires_at)) return res.status(401).json({ error: 'Code has expired. Please request a new code.' });

  if (record.attempts >= VERIFY_MAX_ATTEMPTS) {
    if (!isDevRelaxVerifyPhone(phone)) return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    const unlockAt = new Date(new Date(record.created_at).getTime() + 60 * 1000);
    if (Date.now() < unlockAt.getTime()) return res.status(429).json({ error: `Too many attempts. Try again after ${unlockAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}.` });
    const resetTimestamp = new Date().toISOString();
    await supabase.from('otp_codes').update({ attempts: 0, created_at: resetTimestamp }).eq('id', record.id);
    record = { ...record, attempts: 0, created_at: resetTimestamp };
  }

  const bypassAccepted = isDevOtpBypassPhone(phone) && code === DEV_BYPASS_OTP;
  const inputHash = crypto.createHash('sha256').update(code + process.env.OTP_SALT).digest('hex');
  if (!bypassAccepted && inputHash !== record.otp_hash) {
    await incrementOtpAttempts(record.id, record.attempts);
    return res.status(401).json({ error: 'Incorrect code. Please try again.' });
  }

  const isAdmin = ADMIN_PHONES.includes(phone);
  const authorizedProjects = isAdmin ? [] : await getAuthorizedProjectsForPhone(phone);
  if (!isAdmin && authorizedProjects.length === 0) return res.status(401).json({ error: 'No active portal access found for this phone number.' });

  const clientId = isAdmin ? null : (authorizedProjects[0]?.client_id || authorizedProjects[0]?.clients?.id || null);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sessionExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: sessionInsertError } = await supabase.from('sessions').insert({ phone, client_id: clientId, access_role: isAdmin ? 'admin' : 'client', token_hash: tokenHash, expires_at: sessionExpiry, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString() });
  if (sessionInsertError) throw sessionInsertError;

  await logAccess({ phone, clientId, projectId: authorizedProjects[0]?.project_id || null, action: 'verified', resourceType: 'portal', details: { projectCount: authorizedProjects.length, accessRole: isAdmin ? 'admin' : 'client', devBypass: bypassAccepted }, req });
  await deleteOtpCode(record.id);

  return res.status(200).json({ success: true, token, isAdmin, clientId, phone });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const action = req.query.action || req.body?.action;
  try {
    if (action === 'send-otp') return await handleSendOtp(req, res);
    if (action === 'verify-otp') return await handleVerifyOtp(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('auth error:', error);
    const schemaError = buildSchemaErrorPayload(error);
    return res.status(500).json(schemaError || { error: error.message || 'Auth failed' });
  }
};
