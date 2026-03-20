import { escapeHtml, formatDate, slugPath } from '../lib/format.js';

function formatAddress(project) {
  return [
    project.serviceAddress,
    [project.city, project.province].filter(Boolean).join(', '),
    project.postalCode,
  ].filter(Boolean).join(' | ');
}

function isRecentlyUpdated(dateStr) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
}

export function renderPortalHome(state) {
  const viewer = state.viewer;
  const portal = state.portalData;
  const projects = portal?.projects || [];

  return `
    <section class="section">
      <div class="hero-card portal-home-hero">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Client Portal</div>
            <h1 class="headline page-headline--compact" style="margin-top:18px;">Your current project documents,<br><em>kept ready for review.</em></h1>
            <p class="lede lede--compact">Welcome${portal?.client?.full_name ? `, ${escapeHtml(portal.client.full_name)}` : ''}. This portal gives you access to the current quote and next step for each project assigned to your verified phone number.</p>
          </div>
          <div class="glass-card">
            <div class="meta-label">Current access</div>
            <div class="stat-value stat-value--compact" style="margin-top:8px;">${String(projects.length).padStart(2, '0')}</div>
            <div class="body-copy" style="margin-top:10px;">Authorized project${projects.length === 1 ? '' : 's'} linked to ${escapeHtml(viewer.phone)}.</div>
            <div class="stack" style="margin-top:18px;">
              <div>
                <div class="meta-label">Client</div>
                <div class="body-copy" style="margin-top:6px;">${escapeHtml(portal?.client?.full_name || 'Verified client access')}</div>
              </div>
              <div>
                <div class="meta-label">Portal focus</div>
                <div class="body-copy" style="margin-top:6px;">Current quote, current status, and what to do next.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="project-grid">
        ${projects.length ? projects.map((project) => {
          const hasUpdate = isRecentlyUpdated(project.updatedAt || project.lastUpdated);
          const statusLabel = {
            draft: 'Draft',
            proposal_sent: 'Proposal Ready',
            approved: 'Approved',
            signed: 'Signed',
            in_progress: 'In Progress',
            complete: 'Complete',
          }[project.status] || project.status;

          return `
          <a class="project-card panel" href="${slugPath(`projects/${project.id}`)}">
            <div class="project-card__body" style="padding-top:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div class="meta-label">Project ${escapeHtml(project.projectCode)}</div>
                ${hasUpdate ? `<span style="
                  background:#5cb87a;color:#fff;
                  font-size:0.68rem;font-weight:600;letter-spacing:0.04em;
                  padding:3px 9px;border-radius:20px;white-space:nowrap;
                ">Updated</span>` : ''}
              </div>
              <h2 class="project-card__title" style="margin-top:14px;">${escapeHtml(project.title)}</h2>
              <p class="body-copy" style="margin-top:14px;">${escapeHtml(formatAddress(project) || project.location || 'Service address pending')}</p>
              <div class="project-card__meta">
                <span>${escapeHtml(statusLabel)}</span>
                ${project.quoteStatus ? `<span>${escapeHtml(project.quoteStatus)}</span>` : '<span>Quote pending</span>'}
                <span>Updated ${escapeHtml(formatDate(project.updatedAt || project.lastUpdated || ''))}</span>
              </div>
              <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                <span class="status-pill">${escapeHtml(statusLabel)}</span>
                ${project.quoteStatus ? `<span class="status-pill">${escapeHtml(project.quoteStatus)}</span>` : ''}
              </div>
              <div style="margin-top:18px;">
                <span class="button button--primary">${hasUpdate ? 'View Updated Quote' : 'View Current Quote'}</span>
              </div>
            </div>
          </a>
        `}).join('') : '<div class="empty-state">No authorized projects are currently attached to this phone number.</div>'}
      </div>
    </section>
  `;
}
