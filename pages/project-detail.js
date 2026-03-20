import { escapeHtml, formatDate, slugPath } from '../lib/format.js';

function formatAddress(project) {
  return [
    project.service_address,
    [project.city, project.province].filter(Boolean).join(', '),
    project.postal_code,
  ].filter(Boolean).join(' | ');
}

function isRecentlyUpdated(dateStr) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

export function renderProjectDetail(state) {
  const bundle = state.portalData?.currentProject;
  if (!bundle) return '<div class="empty-state">Project data could not be loaded.</div>';

  const { project, quote } = bundle;
  const address = formatAddress(project) || project.location || 'Address pending';

  const hasUpdate = isRecentlyUpdated(quote?.updated_at || quote?.created_at);

  const nextStepLabel = quote?.status === 'signed'
    ? 'Signed and complete.'
    : quote?.status === 'approved'
      ? 'Ready to sign — please review and sign the quote below.'
      : quote
        ? 'Please review your current quote.'
        : 'Your quote will appear here once issued.';

  const statusLabel = {
    draft: 'Draft',
    proposal_sent: 'Proposal Ready',
    approved: 'Approved',
    signed: 'Signed',
    in_progress: 'In Progress',
    complete: 'Complete',
  }[project.status] || project.status;

  return `
    <section class="section">
      <div class="panel">
        <div class="viewer-header">
          <div class="eyebrow">Current Quote</div>
          <div class="viewer-meta-row" style="margin-top:18px;">
            <span class="status-pill">${escapeHtml(project.project_code)}</span>
            ${quote?.status ? `<span class="status-pill">${escapeHtml(quote.status)}</span>` : ''}
            <span class="status-pill">${escapeHtml(statusLabel)}</span>
          </div>
          <h2 class="section-heading section-heading--small" style="margin-top:20px;">${escapeHtml(quote?.title || 'Quote pending')}</h2>
          <p class="body-copy" style="margin-top:14px;">${escapeHtml(quote?.intro || 'Your current formal quote PDF is shown here once it has been issued by the studio.')}</p>
        </div>

        ${hasUpdate ? `
          <div style="
            margin-top:20px;
            padding:14px 18px;
            border-radius:8px;
            background:rgba(92,184,122,0.12);
            border:1px solid rgba(92,184,122,0.35);
            display:flex;align-items:center;gap:12px;
          ">
            <span style="font-size:1.1rem;">🔔</span>
            <div>
              <div style="font-size:0.82rem;font-weight:600;color:#5cb87a;">Quote Updated</div>
              <div style="font-size:0.78rem;margin-top:3px;opacity:0.8;">A new version of your quote was uploaded recently. Please review the latest PDF below.</div>
            </div>
          </div>
        ` : ''}

        <div style="margin-top:24px;">
          ${quote?.pdf_file_url ? `
            <div class="pdf-frame">
              <iframe src="${escapeHtml(quote.pdf_file_url)}#view=FitH" title="Current quote PDF"></iframe>
            </div>
          ` : '<div class="empty-state">No current quote PDF has been attached to this project yet.</div>'}
        </div>

        <div class="viewer-secondary-meta">
          <div><span class="meta-label">Project</span><span class="viewer-secondary-value">${escapeHtml(project.title)}</span></div>
          <div><span class="meta-label">Service address</span><span class="viewer-secondary-value">${escapeHtml(address)}</span></div>
          <div><span class="meta-label">Next step</span><span class="viewer-secondary-value">${escapeHtml(nextStepLabel)}</span></div>
        </div>

        <div style="margin-top:18px;">
          <a class="button button--primary" href="${slugPath(`projects/${project.id}/quote`)}">View & Sign Quote</a>
        </div>
      </div>
    </section>
  `;
}
