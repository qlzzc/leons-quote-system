const twilio = require('twilio');
const crypto = require('crypto');
const { supabase } = require('./_lib/supabase');
const { ADMIN_PHONES, getAuthorizedProjectsForPhone, getIp, logAccess, normalizePhone } = require('./_lib/auth');
const { storeOtpCode } = require('./_lib/otp-codes');
const { buildSchemaErrorPayload, supportsColumn } = require('./_lib/schema-compat');

const DEV_BYPASS_PHONE = normalizePhone('+17789262989');
const DEV_BYPASS_OTP = '111111';

const RATE_LIMIT = {
  WINDOW_MINUTES: 10,
  MAX_BY_IP: 5,
  MAX_BY_PHONE: 3,
  LOCKOUT_HOURS: 1,
};

const SEND_OTP_STAGES = {
  REQUEST_PARSE: 'request_parse',
  PHONE_VALIDATION: 'phone_validation',
  WHITELIST_LOOKUP: 'whitelist_lookup',
  RATE_LIMIT_CHECK: 'rate_limit_check',
  RATE_LIMIT_INCREMENT: 'rate_limit_increment',
  OTP_GENERATION: 'otp_generation',
  OTP_STORE: 'otp_store',
  TWILIO_SEND: 'twilio_send',
  RESPONSE_RETURN: 'response_return',
};

function respondOptions(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function logStage(stage, details = {}) {
  console.log(`[send-otp] ${stage}`, details);
}

function buildStageError(stage, error) {
  const schemaError = buildSchemaErrorPayload(error);
  if (schemaError) {
    return {
      ...schemaError,
      stage,
    };
  }
  return {
    error: 'Failed to send verification code. Please try again.',
    code: 'SEND_OTP_FAILED',
    stage,
    details: {
      sourceCode: error?.code || null,
      sourceMessage: error?.message || null,
    },
  };
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function isDevOtpBypassPhone(phone) {
  return !isProductionEnv() && normalizePhone(phone) === DEV_BYPASS_PHONE;
}

async function runStage(stage, fn) {
  try {
    return await fn();
  } catch (error) {
    error.stage = error.stage || stage;
    throw error;
  }
}

module.exports = async (req, res) => {
  respondOptions(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  logStage(SEND_OTP_STAGES.REQUEST_PARSE, {
    method: req.method,
    hasBody: Boolean(req.body),
  });

  const rawPhone = req.body?.phone;
  const phone = normalizePhone(rawPhone);
  const ip = getIp(req);

  if (!phone) {
    logStage(SEND_OTP_STAGES.PHONE_VALIDATION, {
      rawPhone: rawPhone || null,
      valid: false,
    });
    return res.status(400).json({ error: 'A valid phone number is required.' });
  }

  try {
    logStage(SEND_OTP_STAGES.PHONE_VALIDATION, {
      rawPhone: rawPhone || null,
      normalizedPhone: phone,
      ip,
      valid: true,
    });

    logStage(SEND_OTP_STAGES.RATE_LIMIT_CHECK, { rateType: 'ip', identifier: ip });
    const ipCheck = await runStage(
      SEND_OTP_STAGES.RATE_LIMIT_CHECK,
      () => checkRateLimit(ip, 'ip', 'portal', RATE_LIMIT.MAX_BY_IP)
    );
    if (ipCheck.locked) {
      await logAccess({ phone, action: 'blocked_ip', details: { lockedUntil: ipCheck.lockedUntil }, req });
      return res.status(429).json({ error: `Too many requests from this network. Try again after ${ipCheck.lockedUntil}.` });
    }

    logStage(SEND_OTP_STAGES.RATE_LIMIT_CHECK, { rateType: 'phone', identifier: phone });
    const phoneCheck = await runStage(
      SEND_OTP_STAGES.RATE_LIMIT_CHECK,
      () => checkRateLimit(phone, 'phone', 'portal', RATE_LIMIT.MAX_BY_PHONE)
    );
    if (phoneCheck.locked) {
      await logAccess({ phone, action: 'blocked_phone', details: { lockedUntil: phoneCheck.lockedUntil }, req });
      return res.status(429).json({ error: `Too many verification attempts. Try again after ${phoneCheck.lockedUntil}.` });
    }

    const isAdmin = ADMIN_PHONES.includes(phone);
    logStage(SEND_OTP_STAGES.WHITELIST_LOOKUP, { phone, isAdmin });
    const authorizedProjects = isAdmin
      ? []
      : await runStage(
        SEND_OTP_STAGES.WHITELIST_LOOKUP,
        () => getAuthorizedProjectsForPhone(phone)
      );
    if (!isAdmin && authorizedProjects.length === 0) {
      await logAccess({ phone, action: 'blocked_not_whitelisted', resourceType: 'portal', req });
      return res.status(401).json({ error: 'This phone number is not authorized for portal access. Please contact the studio.' });
    }

    logStage(SEND_OTP_STAGES.RATE_LIMIT_INCREMENT, { rateType: 'ip', identifier: ip });
    await runStage(
      SEND_OTP_STAGES.RATE_LIMIT_INCREMENT,
      () => incrementRateLimit(ip, 'ip', 'portal')
    );
    logStage(SEND_OTP_STAGES.RATE_LIMIT_INCREMENT, { rateType: 'phone', identifier: phone });
    await runStage(
      SEND_OTP_STAGES.RATE_LIMIT_INCREMENT,
      () => incrementRateLimit(phone, 'phone', 'portal')
    );

    logStage(SEND_OTP_STAGES.OTP_GENERATION, { phone });
    const otp = isDevOtpBypassPhone(phone)
      ? DEV_BYPASS_OTP
      : String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp + process.env.OTP_SALT).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    logStage(SEND_OTP_STAGES.OTP_STORE, { phone, expiresAt });
    await runStage(SEND_OTP_STAGES.OTP_STORE, () => storeOtpCode({
      phone,
      quoteId: null,
      otpHash,
      expiresAt,
      contextKey: 'portal',
    }));

    if (isDevOtpBypassPhone(phone)) {
      logStage(SEND_OTP_STAGES.TWILIO_SEND, {
        phone,
        bypass: true,
        reason: 'dev_whitelisted_phone',
      });
    } else {
      logStage(SEND_OTP_STAGES.TWILIO_SEND, {
        phone,
        fromConfigured: Boolean(process.env.TWILIO_PHONE_NUMBER),
        sidConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID),
        tokenConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
      });
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await runStage(SEND_OTP_STAGES.TWILIO_SEND, () => client.messages.create({
        body: `Your Leon's Venetian Plaster portal verification code is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      }));
    }

    await logAccess({
      phone,
      clientId: authorizedProjects[0]?.client_id || null,
      projectId: authorizedProjects[0]?.project_id || null,
      action: 'otp_sent',
      resourceType: 'portal',
      details: { projectCount: authorizedProjects.length, devBypass: isDevOtpBypassPhone(phone) },
      req,
    });

    logStage(SEND_OTP_STAGES.RESPONSE_RETURN, { phone, success: true });
    return res.status(200).json({ success: true });
  } catch (error) {
    const stage = error?.stage || 'unknown';
    console.error('send-otp error:', { stage, code: error?.code, message: error?.message, stack: error?.stack });
    return res.status(500).json(buildStageError(stage, error));
  }
};

async function checkRateLimit(identifier, type, contextKey, maxRequests) {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT.WINDOW_MINUTES * 60 * 1000).toISOString();
    const hasContextKey = await supportsColumn('rate_limits', 'context_key');
    let query = supabase
      .from('rate_limits')
      .select('request_count, locked_until, window_start')
      .eq('identifier', identifier)
      .eq('identifier_type', type);
    if (hasContextKey) query = query.eq('context_key', contextKey);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (!data) return { locked: false };

    if (data.locked_until && new Date() < new Date(data.locked_until)) {
      return {
        locked: true,
        lockedUntil: new Date(data.locked_until).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
      };
    }

    if (new Date(data.window_start) > new Date(windowStart) && data.request_count >= maxRequests) {
      const lockedUntil = new Date(Date.now() + RATE_LIMIT.LOCKOUT_HOURS * 60 * 60 * 1000);
      let lockQuery = supabase.from('rate_limits')
        .update({ locked_until: lockedUntil.toISOString() })
        .eq('identifier', identifier)
        .eq('identifier_type', type);
      if (hasContextKey) lockQuery = lockQuery.eq('context_key', contextKey);
      const { error: lockError } = await lockQuery;
      if (lockError) throw lockError;
      return {
        locked: true,
        lockedUntil: lockedUntil.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
      };
    }

    return { locked: false };
  } catch (error) {
    error.stage = SEND_OTP_STAGES.RATE_LIMIT_CHECK;
    throw error;
  }
}

async function incrementRateLimit(identifier, type, contextKey) {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT.WINDOW_MINUTES * 60 * 1000).toISOString();
    const hasContextKey = await supportsColumn('rate_limits', 'context_key');
    let query = supabase
      .from('rate_limits')
      .select('id, request_count, window_start')
      .eq('identifier', identifier)
      .eq('identifier_type', type);
    if (hasContextKey) query = query.eq('context_key', contextKey);

    const { data: existing, error } = await query.maybeSingle();
    if (error) throw error;

    if (!existing) {
      const payload = {
        identifier,
        identifier_type: type,
        request_count: 1,
        window_start: new Date().toISOString()
      };
      if (hasContextKey) payload.context_key = contextKey;
      const { error: insertError } = await supabase.from('rate_limits').insert(payload);
      if (insertError) throw insertError;
      return;
    }

    if (new Date(existing.window_start) < new Date(windowStart)) {
      const { error: resetError } = await supabase.from('rate_limits')
        .update({ request_count: 1, window_start: new Date().toISOString(), locked_until: null })
        .eq('id', existing.id);
      if (resetError) throw resetError;
      return;
    }

    const { error: updateError } = await supabase.from('rate_limits')
      .update({ request_count: existing.request_count + 1 })
      .eq('id', existing.id);
    if (updateError) throw updateError;
  } catch (error) {
    error.stage = SEND_OTP_STAGES.RATE_LIMIT_INCREMENT;
    throw error;
  }
}
