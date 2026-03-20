const { supabase } = require('./supabase');

function isMissingTableError(error) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

async function countRows(query, { optional = false } = {}) {
  const { count, error } = await query;
  if (error) {
    if (optional && isMissingTableError(error)) return 0;
    throw error;
  }
  return count || 0;
}

async function loadRows(query, { optional = false, fallback = [] } = {}) {
  const { data, error } = await query;
  if (error) {
    if (optional && isMissingTableError(error)) return fallback;
    throw error;
  }
  return data ?? fallback;
}

function isLikelyTestProject(project) {
  const haystack = `${project?.project_code || ''} ${project?.title || ''}`.toLowerCase();
  return ['test', 'demo', 'sandbox', 'sample'].some((token) => haystack.includes(token));
}

async function loadProjectRelationCounts(projectId) {
  const [
    quoteCount,
    assetCount,
    contractCount,
    quoteSignatureCount,
  ] = await Promise.all([
    countRows(supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('project_id', projectId)),
    countRows(supabase.from('project_assets').select('id', { count: 'exact', head: true }).eq('project_id', projectId), { optional: true }),
    countRows(supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('project_id', projectId), { optional: true }),
    countRows(supabase.from('quote_signatures').select('id', { count: 'exact', head: true }).eq('project_id', projectId), { optional: true }),
  ]);

  const contractIds = await loadRows(
    supabase.from('contracts').select('id').eq('project_id', projectId),
    { optional: true, fallback: [] }
  );

  const contractIdList = contractIds.map((item) => item.id).filter(Boolean);
  const contractSignatureCount = contractIdList.length
    ? await countRows(
      supabase.from('contract_signatures').select('id', { count: 'exact', head: true }).in('contract_id', contractIdList),
      { optional: true }
    )
    : 0;

  return {
    quotes: quoteCount,
    assets: assetCount,
    contracts: contractCount,
    quoteSignatures: quoteSignatureCount,
    contractSignatures: contractSignatureCount,
  };
}

async function loadProjectRemovalState(projectId) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_code, title, status')
    .eq('id', projectId)
    .single();
  if (projectError) throw projectError;

  const relatedCounts = await loadProjectRelationCounts(projectId);
  const totalRelated = Object.values(relatedCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const canHardDelete = totalRelated === 0;

  return {
    project,
    relatedCounts,
    totalRelated,
    isTestProject: isLikelyTestProject(project),
    canHardDelete,
  };
}

module.exports = {
  loadProjectRelationCounts,
  loadProjectRemovalState,
};
