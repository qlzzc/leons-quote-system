const crypto = require('crypto');
const { supabase } = require('./_lib/supabase');
const { ADMIN_PHONES, getAuthorizedProjectsForPhone, getIp, logAccess, normalizePhone } = require('./_lib/auth');
const { deleteOtpCode, findOtpCode, incrementOtpAttempts } = require('./_lib/otp-codes');
const { buildSchemaErrorPayload } = require('./_lib/schema-compat');

const VERIFY_MAX_ATTEMPTS = 5;
const DEV_RELAX_VERIFY_LOCKOUT_MS = 60 * 1000;
const DEV_BYPASS_PHONE = normalizePhone('+17789262989');
const DEV_BYPASS_OTP = '111111';

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function isDevOtpBypassPhone(phone) {
  return !isProductionEnv() && normalizePhone(phone) === DEV_BYPASS_PHONE;
}

function getDevRelaxVerifyPhones() {
  return String(process.env.DEV_RELAX_VERIFY_PHONES || '')
    .split(',')
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

function isDevRelaxVerifyPhone(phone) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProduction) return false;
  return getDevRelaxVerifyPhones().includes(normalizePhone(phone));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || '').trim();
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone number and verification code are required.' });
  }

  try {
    let record = await findOtpCode(phone, 'portal');
    if (!record) {
      return res.status(401).json({ error: 'No verification code found. Please request a new one.' });
    }
    if (new Date() > new Date(record.expires_at)) {
      return res.status(401).json({ error: 'Code has expired. Please request a new code.' });
    }
    if (record.attempts >= VERIFY_MAX_ATTEMPTS) {
      if (!isDevRelaxVerifyPhone(phone)) {
        return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
      }

      const unlockAt = new Date(new Date(record.created_at).getTime() + DEV_RELAX_VERIFY_LOCKOUT_MS);
      if (Date.now() < unlockAt.getTime()) {
        return res.status(429).json({
          error: `Too many attempts. Try again after ${unlockAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}.`
        });
      }

      const resetTimestamp = new Date().toISOString();
      const { error: resetError } = await supabase
        .from('otp_codes')
        .update({ attempts: 0, created_at: resetTimestamp })
        .eq('id', record.id);
      if (resetError) throw resetError;
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
    if (!isAdmin && authorizedProjects.length === 0) {
      return res.status(401).json({ error: 'No active portal access found for this phone number.' });
    }

    const clientId = isAdmin ? null : (authorizedProjects[0]?.client_id || authorizedProjects[0]?.clients?.id || null);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const sessionPayload = {
      phone,
      client_id: clientId,
      access_role: isAdmin ? 'admin' : 'client',
      token_hash: tokenHash,
      expires_at: sessionExpiry,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
    const { error: sessionInsertError } = await supabase.from('sessions').insert(sessionPayload);
    if (sessionInsertError) throw sessionInsertError;
    console.log('verify-otp session created', {
      phone,
      isAdmin,
      tokenPreview: token.slice(0, 8),
      tokenHashPreview: tokenHash.slice(0, 12),
      expiresAt: sessionExpiry,
    });

    await logAccess({
      phone,
      clientId,
      projectId: authorizedProjects[0]?.project_id || null,
      action: 'verified',
      resourceType: 'portal',
      details: { projectCount: authorizedProjects.length, accessRole: isAdmin ? 'admin' : 'client', devBypass: bypassAccepted },
      req,
    });

    await deleteOtpCode(record.id);

    return res.status(200).json({
      success: true,
      token,
      isAdmin,
      clientId,
      phone
    });
  } catch (error) {
    console.error('verify-otp error:', error);
    const schemaError = buildSchemaErrorPayload(error);
    return res.status(500).json(
      schemaError || { error: 'Verification failed. Please try again.' }
    );
  }
};
