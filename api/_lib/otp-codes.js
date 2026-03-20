const { supabase } = require('./supabase');
const { supportsColumn } = require('./schema-compat');

async function otpUsesContextKey() {
  return supportsColumn('otp_codes', 'context_key');
}

async function findOtpCode(phone, contextKey = 'portal') {
  const useContextKey = await otpUsesContextKey();
  let query = supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1);

  if (useContextKey) query = query.eq('context_key', contextKey);

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

async function storeOtpCode({ phone, otpHash, expiresAt, contextKey = 'portal', quoteId = null }) {
  const existing = await findOtpCode(phone, contextKey);
  const useContextKey = await otpUsesContextKey();
  const payload = {
    phone,
    quote_id: quoteId,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts: 0,
    created_at: new Date().toISOString(),
  };

  if (useContextKey) payload.context_key = contextKey;

  if (existing?.id) {
    const { error } = await supabase.from('otp_codes').update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.from('otp_codes').insert(payload).select('id').limit(1);
  if (error) throw error;
  return data?.[0]?.id || null;
}

async function incrementOtpAttempts(id, attempts) {
  const { error } = await supabase
    .from('otp_codes')
    .update({ attempts: attempts + 1 })
    .eq('id', id);
  if (error) throw error;
}

async function deleteOtpCode(id) {
  const { error } = await supabase.from('otp_codes').delete().eq('id', id);
  if (error) throw error;
}

module.exports = {
  deleteOtpCode,
  findOtpCode,
  incrementOtpAttempts,
  storeOtpCode,
};
