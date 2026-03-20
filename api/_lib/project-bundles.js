const { supabase } = require('./supabase');
const { createQuotePdfSignedUrl } = require('./quote-storage');
const { createProjectAssetSignedUrl } = require('./project-asset-storage');

function isMissingTableError(error) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

async function decorateQuote(quote) {
  if (!quote) return null;
  return {
    ...quote,
    pdf_file_url: quote.pdf_file_path ? await createQuotePdfSignedUrl(quote.pdf_file_path) : null,
  };
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

async function decorateAsset(asset) {
  if (!asset) return null;

  let fileUrl = asset.file_url || null;
  if (fileUrl && !isRemoteUrl(fileUrl)) {
    fileUrl = await createProjectAssetSignedUrl(fileUrl);
  }

  return {
    ...asset,
    file_url: fileUrl,
  };
}

async function loadOptionalRows(query, fallback) {
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return fallback;
    throw error;
  }
  return data ?? fallback;
}

async function getNextQuoteVersion(projectId) {
  const { data, error } = await supabase
    .from('quotes')
    .select('version_number')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.version_number || 0) + 1;
}

async function loadProjectBundle(projectId, { includeAllAssets = false } = {}) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id, project_code, title, summary, status, phase_label, service_area, location, service_address, city, province, postal_code, internal_notes, created_at, updated_at')
    .eq('id', projectId)
    .single();
  if (projectError) throw projectError;

  const { data: client, error: clientError } = project.client_id
    ? await supabase.from('clients').select('id, full_name, email, primary_phone').eq('id', project.client_id).maybeSingle()
    : { data: null, error: null };
  if (clientError) throw clientError;

  const { data: quoteRows, error: quotesError } = await supabase
    .from('quotes')
    .select('*')
    .eq('project_id', projectId)
    .order('is_current', { ascending: false })
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false });
  if (quotesError) throw quotesError;

  const quotes = [];
  for (const row of quoteRows || []) {
    quotes.push(await decorateQuote(row));
  }
  const currentQuote = quotes.find((quote) => quote.is_current) || quotes[0] || null;

  const assetQuery = supabase
      .from('project_assets')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
  if (!includeAllAssets) assetQuery.eq('is_client_visible', true);

  const assetRows = await loadOptionalRows(assetQuery, []);
  const assets = [];
  for (const asset of assetRows || []) {
    assets.push(await decorateAsset(asset));
  }

  const contracts = await loadOptionalRows(
    supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1),
    []
  );

  const contract = contracts?.[0] || null;
  const signatures = contract
    ? await loadOptionalRows(
      supabase.from('contract_signatures').select('*').eq('contract_id', contract.id).order('signed_at'),
      []
    )
    : [];

  const currentQuoteSignature = currentQuote
    ? await loadOptionalRows(
      supabase
        .from('quote_signatures')
        .select('*')
        .eq('quote_id', currentQuote.id)
        .eq('project_id', projectId)
        .order('signed_at', { ascending: false })
        .limit(1),
      []
    )
    : [];

  return {
    project: {
      ...project,
      clients: client || null,
    },
    quote: currentQuote,
    quotes,
    assets,
    quoteSignature: currentQuoteSignature?.[0] || null,
    contract: contract ? { ...contract, signatures } : null,
  };
}

module.exports = {
  getNextQuoteVersion,
  loadOptionalRows,
  loadProjectBundle,
};
