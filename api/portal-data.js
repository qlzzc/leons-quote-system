const { supabase } = require('./_lib/supabase');
const { ensureProjectAccess, getAuthorizedProjectsForPhone, logAccess, requireSession } = require('./_lib/auth');
const { loadProjectBundle } = require('./_lib/project-bundles');

const HIDDEN_CLIENT_PROJECT_STATUSES = new Set(['archived', 'cancelled', 'closed']);

function isHiddenFromClient(project) {
  return HIDDEN_CLIENT_PROJECT_STATUSES.has(String(project?.status || '').toLowerCase());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const session = await requireSession(req);
    const projectId = req.query.projectId || null;

    if (session.isAdmin) {
      if (projectId) {
        const currentProject = await loadProjectBundle(projectId, { includeAllAssets: true });
        return res.status(200).json({ viewer: session, currentProject, projects: [] });
      }
      const { data: projects } = await supabase
        .from('projects')
        .select('id, project_code, title, status, phase_label, service_address, city, province, postal_code, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      return res.status(200).json({ viewer: session, projects: projects || [] });
    }

    const authorizedEntries = await getAuthorizedProjectsForPhone(session.phone);
    const projectIds = [...new Set(authorizedEntries.map(entry => entry.project_id).filter(Boolean))];
    const projects = [];
    for (const id of projectIds) {
      const bundle = await loadProjectBundle(id);
      if (isHiddenFromClient(bundle.project)) continue;
      projects.push({
        id: bundle.project.id,
        projectCode: bundle.project.project_code,
        title: bundle.project.title,
        location: bundle.project.location,
        serviceAddress: bundle.project.service_address,
        city: bundle.project.city,
        province: bundle.project.province,
        postalCode: bundle.project.postal_code,
        summary: bundle.project.summary,
        status: bundle.project.status,
        phaseLabel: bundle.project.phase_label,
        quoteStatus: bundle.quote?.status || null,
        currentQuoteVersion: bundle.quote?.version_number || null,
        contractStatus: bundle.contract?.status || null,
        assetCount: bundle.assets.length,
        updatedAt: bundle.quote?.updated_at || bundle.quote?.created_at || bundle.project.updated_at,
      });
    }

    let currentProject = null;
    if (projectId) {
      await ensureProjectAccess(session, projectId);
      const requestedProject = await loadProjectBundle(projectId);
      if (!isHiddenFromClient(requestedProject.project)) {
        currentProject = requestedProject;
        await logAccess({
          phone: session.phone,
          clientId: session.client_id,
          projectId,
          quoteId: currentProject.quote?.id || null,
          contractId: currentProject.contract?.id || null,
          action: 'project_viewed',
          resourceType: 'project',
          resourceId: projectId,
          req,
        });
      }
    }

    return res.status(200).json({
      viewer: {
        phone: session.phone,
        clientId: session.client_id,
        accessRole: session.access_role,
      },
      client: authorizedEntries[0]?.clients || null,
      projects,
      currentProject,
    });
  } catch (error) {
    console.error('portal-data error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load portal data' });
  }
};
