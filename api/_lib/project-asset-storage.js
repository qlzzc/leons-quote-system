const crypto = require('crypto');
const { supabase } = require('./supabase');

const PROJECT_ASSET_BUCKET = 'project-assets';
const MAX_PROJECT_ASSET_BYTES = 25 * 1024 * 1024;

let bucketEnsured = false;

function sanitizeFileName(name = 'asset-file') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'asset-file';
}

function parseAssetUpload(assetFile) {
  if (!assetFile?.dataUrl) {
    const error = new Error('A project asset upload is required.');
    error.statusCode = 400;
    throw error;
  }

  const match = String(assetFile.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Project asset upload must be a valid file.');
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_PROJECT_ASSET_BYTES) {
    const error = new Error('Project asset must be smaller than 25 MB.');
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    contentType: match[1],
    fileName: sanitizeFileName(assetFile.fileName || assetFile.name || 'asset-file'),
  };
}

async function ensureProjectAssetBucket() {
  if (bucketEnsured) return;
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = (buckets || []).some((bucket) => bucket.name === PROJECT_ASSET_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(PROJECT_ASSET_BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_PROJECT_ASSET_BYTES}`,
    });
    if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
      throw createError;
    }
  }

  bucketEnsured = true;
}

async function uploadProjectAsset({ projectCode, assetFile, assetType = 'document' }) {
  const { buffer, contentType, fileName } = parseAssetUpload(assetFile);
  await ensureProjectAssetBucket();

  const storagePath = [
    sanitizeFileName(projectCode || 'project'),
    sanitizeFileName(assetType || 'document'),
    `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName}`,
  ].join('/');

  const { error } = await supabase.storage
    .from(PROJECT_ASSET_BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });
  if (error) throw error;

  return {
    bucket: PROJECT_ASSET_BUCKET,
    path: storagePath,
    fileName,
    contentType,
  };
}

async function createProjectAssetSignedUrl(path, expiresIn = 60 * 60) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PROJECT_ASSET_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

module.exports = {
  PROJECT_ASSET_BUCKET,
  createProjectAssetSignedUrl,
  ensureProjectAssetBucket,
  parseAssetUpload,
  uploadProjectAsset,
};
