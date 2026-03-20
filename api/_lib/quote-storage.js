const crypto = require('crypto');
const { supabase } = require('./supabase');

const QUOTE_BUCKET = 'quote-documents';
const MAX_QUOTE_PDF_BYTES = 15 * 1024 * 1024;

let bucketEnsured = false;

function sanitizeFileName(name = 'quote.pdf') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'quote.pdf';
}

function parsePdfUpload(quotePdf) {
  if (!quotePdf?.dataUrl) {
    const error = new Error('A quote PDF upload is required.');
    error.statusCode = 400;
    throw error;
  }

  const match = String(quotePdf.dataUrl).match(/^data:(application\/pdf);base64,(.+)$/);
  if (!match) {
    const error = new Error('Quote upload must be a PDF file.');
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_QUOTE_PDF_BYTES) {
    const error = new Error('Quote PDF must be smaller than 15 MB.');
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    contentType: match[1],
    fileName: sanitizeFileName(quotePdf.fileName || quotePdf.name || 'quote.pdf'),
  };
}

async function ensureQuoteBucket() {
  if (bucketEnsured) return;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  const exists = (buckets || []).some((bucket) => bucket.name === QUOTE_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(QUOTE_BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_QUOTE_PDF_BYTES}`,
      allowedMimeTypes: ['application/pdf'],
    });
    if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
      throw createError;
    }
  }
  bucketEnsured = true;
}

async function uploadQuotePdf({ projectCode, versionNumber, quotePdf }) {
  const { buffer, contentType, fileName } = parsePdfUpload(quotePdf);
  await ensureQuoteBucket();

  const storagePath = [
    sanitizeFileName(projectCode || 'project'),
    `v${versionNumber}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName}`,
  ].join('/');

  const { error } = await supabase.storage
    .from(QUOTE_BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (error) throw error;

  return {
    bucket: QUOTE_BUCKET,
    path: storagePath,
    fileName,
  };
}

async function createQuotePdfSignedUrl(path, expiresIn = 15 * 60) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(QUOTE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

module.exports = {
  createQuotePdfSignedUrl,
  ensureQuoteBucket,
  parsePdfUpload,
  QUOTE_BUCKET,
  uploadQuotePdf,
};
