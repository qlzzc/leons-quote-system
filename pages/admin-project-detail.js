import { escapeHtml, formatDate } from '../lib/format.js';

const PROJECT_STATUS_OPTIONS = [
  'draft',
  'proposal_sent',
  'approved',
  'signed',
  'in_progress',
  'complete',
];

const QUOTE_STATUS_OPTIONS = [
  'draft',
  'sent',
  'approved',
  'signed',
  'archived',
];

const ASSET_TYPE_OPTIONS = [
  'render',
  'reference',
  'photo',
  'document',
  'attachment',
];

function formatAddress(project) {
  return [
    project.service_address,
    [project.city, project.province].filter(Boolean).join(', '),
    project.postal_code,
  ].filter(Boolean).join(' | ');
}

function renderSelectOptions(options, selectedValue) {
  const normalizedOptions = selectedValue && !options.includes(selectedValue)
    ? [selectedValue, ...options]
    : options;

  return normalizedOptions.map((option) => `
    <option value="${escapeHtml(option)}" ${option === selectedValue ? 'selected' : ''}>${escapeHtml(option)}</option>
  `).join('');
}

function renderQuoteStatus(status, isCurrent) {
  const label = status || 'draft';
  return `<span class="status-pill ${isCurrent ? 'status-success' : ''}">${escapeHtml(label)}</span>`;
}

function renderContractSummary(contract) {
  if (!contract) {
    return `
      <div class="empty-state" style="margin-top:18px;">
        No contract has been attached yet.
        <div class="field-help" style="margin-top:10px;">Keep using the quote workflow for now. Contract attachment can be added later.</div>
        <div style="margin-top:14px;">
          <button class="button" type="button" disabled>Attach contract later</button>
        </div>
      </div>
    `;
  }

  const latestSignature = [...(contract.signatures || [])]
    .sort((a, b) => new Date(b.signed_at || 0).getTime() - new Date(a.signed_at || 0).getTime())[0];

  return `
    <div class="stack" style="margin-top:18px;">
      <div class="viewer-meta-row">
        <span class="status-pill ${contract.status === 'signed' ? 'status-success' : ''}">${escapeHtml(contract.status || 'draft')}</span>
        <span class="status-pill">Version ${escapeHtml(contract.version || 1)}</span>
      </div>
      <div class="viewer-secondary-meta" style="margin-top:0;padding-top:0;border-top:0;">
        <div><span class="meta-label">Title</span><span class="viewer-secondary-value">${escapeHtml(contract.title || 'Untitled contract')}</span></div>
        <div><span class="meta-label">Sent</span><span class="viewer-secondary-value">${escapeHtml(formatDate(contract.sent_at))}</span></div>
        <div><span class="meta-label">Latest signature</span><span class="viewer-secondary-value">${latestSignature ? `${escapeHtml(latestSignature.signer_name || latestSignature.signer_role || 'Signer')} on ${escapeHtml(formatDate(latestSignature.signed_at))}` : 'No signatures yet'}</span></div>
      </div>
    </div>
  `;
}

function renderTabNav(activeView) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'quotes',   label: 'Quotes' },
    { id: 'assets',   label: 'Assets' },
    { id: 'settings', label: 'Settings' },
  ];

  return `
    <nav style="display:flex;gap:8px;flex-wrap:wrap;padding:0 0 24px 0;border-bottom:1px solid var(--border,rgba(255,255,255,0.1));margin-bottom:32px;">
      ${tabs.map((tab) => `
        <button
          class="button${activeView === tab.id ? ' button--primary' : ''}"
          type="button"
          data-action="set-project-view"
          data-view="${tab.id}"
          style="${activeView === tab.id ? '' : 'opacity:0.6;'}"
        >${tab.label}</button>
      `).join('')}
    </nav>
  `;
}

function renderOverviewTab(project, quote, client, address) {
  return `
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Project Basics</div>
        <div class="stack" style="margin-top:18px;">
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="admin-project-title">Title</label>
              <input id="admin-project-title" class="field-input" type="text" value="${escapeHtml(project.title || '')}">
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-project-status">Status</label>
              <select id="admin-project-status" class="field-select">
                ${renderSelectOptions(PROJECT_STATUS_OPTIONS, project.status || 'draft')}
              </select>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-project-summary">Summary</label>
            <textarea id="admin-project-summary" class="field-textarea">${escapeHtml(project.summary || '')}</textarea>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="admin-project-phase-label">Phase Label</label>
              <input id="admin-project-phase-label" class="field-input" type="text" value="${escapeHtml(project.phase_label || '')}">
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-project-postal-code">Postal Code</label>
              <input id="admin-project-postal-code" class="field-input" type="text" value="${escapeHtml(project.postal_code || '')}">
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-project-service-address">Service Address</label>
            <input id="admin-project-service-address" class="field-input" type="text" value="${escapeHtml(project.service_address || '')}">
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="admin-project-city">City</label>
              <input id="admin-project-city" class="field-input" type="text" value="${escapeHtml(project.city || '')}">
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-project-province">Province</label>
              <input id="admin-project-province" class="field-input" type="text" value="${escapeHtml(project.province || '')}">
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-project-internal-notes">Internal Notes</label>
            <textarea id="admin-project-internal-notes" class="field-textarea">${escapeHtml(project.internal_notes || '')}</textarea>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button class="button button--primary" data-action="save-project-basics" data-project-id="${escapeHtml(project.id)}">Save project basics</button>
            <a class="button" href="#/admin">Back to admin</a>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow">Current Quote</div>
        ${quote?.pdf_file_url ? `
          <div class="pdf-frame" style="margin-top:18px;">
            <iframe src="${escapeHtml(quote.pdf_file_url)}#view=FitH" title="Current quote PDF"></iframe>
          </div>
        ` : '<div class="empty-state" style="margin-top:18px;">No quote PDF has been attached to this project yet.</div>'}
        <div class="viewer-secondary-meta">
          <div><span class="meta-label">Version</span><span class="viewer-secondary-value">${escapeHtml(quote?.version_number || 'Pending')}</span></div>
          <div><span class="meta-label">Quote number</span><span class="viewer-secondary-value">${escapeHtml(quote?.quote_number || 'Pending')}</span></div>
          <div><span class="meta-label">Status</span><span class="viewer-secondary-value">${escapeHtml(quote?.status || 'Pending')}</span></div>
        </div>
        <div style="margin-top:18px;">
          <button class="button" type="button" data-action="set-project-view" data-view="quotes">Manage quotes →</button>
        </div>
      </div>
    </section>
  `;
}

function renderQuotesTab(project, quote, quotes) {
  const nextVersion = quotes.length + 1;
  const currentTitle = quote?.title || project.title || '';
  const currentQuoteNumber = quote?.quote_number || '';
  const nextQuoteNumber = currentQuoteNumber
    ? currentQuoteNumber.replace(/V(\d+)$/i, (_, n) => `V${Number(n) + 1}`)
    : '';

  return `
    <section class="section">
      <div class="panel">
        <div class="eyebrow">Quote History</div>
        <div class="table-wrap" style="margin-top:18px;">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Quote #</th>
                <th>Status</th>
                <th>Created</th>
                <th>Document</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${quotes.map((item) => `
                <tr>
                  <td>
                    <div>Version ${escapeHtml(item.version_number)}</div>
                    ${item.is_current ? '<div class="field-help" style="margin-top:4px;">Current client version</div>' : ''}
                  </td>
                  <td>${escapeHtml(item.quote_number || '—')}</td>
                  <td>${renderQuoteStatus(item.status, item.is_current)}</td>
                  <td>${escapeHtml(formatDate(item.created_at))}</td>
                  <td>${item.pdf_file_url ? `<a class="button" href="${escapeHtml(item.pdf_file_url)}" target="_blank" rel="noreferrer">Open PDF</a>` : 'Missing PDF'}</td>
                  <td>${item.is_current ? '<span class="muted">Current</span>' : `<button class="button" data-action="set-current-quote" data-project-id="${escapeHtml(project.id)}" data-quote-id="${escapeHtml(item.id)}">Make current</button>`}</td>
                </tr>
              `).join('') || '<tr><td colspan="6">No quote versions saved yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="panel">
        <div class="eyebrow">Upload New Version</div>
        <div class="field-help" style="margin-top:8px;margin-bottom:18px;">
          上传新报价 PDF 后，客户端将自动显示最新版本。项目信息和客户信息无需重新填写。
        </div>
        <div class="stack">
          <div class="glass-card" style="margin-bottom:8px;">
            <div class="meta-label">当前版本</div>
            <div class="body-copy" style="margin-top:8px;">
              ${quote ? `Version ${escapeHtml(quote.version_number)} · ${escapeHtml(quote.quote_number || '—')} · ` : '尚无报价 · '}
              <span class="status-pill status-success" style="font-size:0.72rem;">${escapeHtml(quote?.status || '—')}</span>
            </div>
            <div class="muted" style="font-size:0.72rem;margin-top:6px;">上传后将自动成为 Version ${nextVersion}</div>
          </div>

          <div class="field-group">
            <label class="field-label" for="admin-quote-number">Quote Number <span class="muted">(可选)</span></label>
            <input id="admin-quote-number" class="field-input" type="text" placeholder="${escapeHtml(nextQuoteNumber || 'e.g. E0026-01-V2')}" value="${escapeHtml(nextQuoteNumber)}">
          </div>

          <div class="field-group">
            <label class="field-label" for="admin-quote-pdf">选择新报价 PDF</label>
            <input id="admin-quote-pdf" class="field-input" type="file" accept="application/pdf">
            <div class="field-help">仅限 PDF。上传后自动保存为下一个版本号。</div>
          </div>

          <label style="display:flex;gap:10px;align-items:center;color:var(--text-soft);font-size:0.82rem;">
            <input id="admin-quote-make-current" type="checkbox" checked>
            上传后立即设为客户端当前版本
          </label>

          <input type="hidden" id="admin-quote-title" value="${escapeHtml(currentTitle)}">
          <input type="hidden" id="admin-quote-status" value="sent">
          <input type="hidden" id="admin-quote-intro" value="">

          <div>
            <button class="button button--primary" data-action="upload-quote-version" data-project-id="${escapeHtml(project.id)}">上传新报价</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAssetsTab(project, assets, nextAssetSortOrder) {
  return `
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Upload Asset</div>
        <div class="stack" style="margin-top:18px;">
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="admin-asset-title">File Title</label>
              <input id="admin-asset-title" class="field-input" type="text" placeholder="e.g. Install elevation">
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-asset-type">File Type</label>
              <select id="admin-asset-type" class="field-select">
                ${renderSelectOptions(ASSET_TYPE_OPTIONS, 'document')}
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="admin-asset-sort-order">Sort Order</label>
              <input id="admin-asset-sort-order" class="field-input" type="number" value="${escapeHtml(nextAssetSortOrder)}">
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-asset-file">Upload File</label>
              <input id="admin-asset-file" class="field-input" type="file">
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-asset-description">Description</label>
            <textarea id="admin-asset-description" class="field-textarea" placeholder="Optional internal note or client-facing context."></textarea>
          </div>
          <label style="display:flex;gap:10px;align-items:center;color:var(--text-soft);font-size:0.82rem;">
            <input id="admin-asset-client-visible" type="checkbox" checked>
            Visible to client in the portal
          </label>
          <div>
            <button class="button button--primary" data-action="upload-project-asset" data-project-id="${escapeHtml(project.id)}">Upload asset</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow">Uploaded Assets</div>
        <div class="table-wrap" style="margin-top:18px;">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Sort</th>
                <th>Client Visible</th>
                <th>Created</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              ${assets.map((asset) => `
                <tr>
                  <td>
                    <div>${escapeHtml(asset.title || 'Untitled asset')}</div>
                    ${asset.description ? `<div class="field-help" style="margin-top:4px;">${escapeHtml(asset.description)}</div>` : ''}
                  </td>
                  <td>${escapeHtml(asset.asset_type || 'document')}</td>
                  <td>${escapeHtml(asset.sort_order ?? 0)}</td>
                  <td>${asset.is_client_visible ? 'Yes' : 'No'}</td>
                  <td>${escapeHtml(formatDate(asset.created_at))}</td>
                  <td>${asset.file_url ? `<a class="button" href="${escapeHtml(asset.file_url)}" target="_blank" rel="noreferrer">Open</a>` : 'Missing file'}</td>
                </tr>
              `).join('') || '<tr><td colspan="6">No assets uploaded yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderSettingsTab(project, contract) {
  return `
    <section class="section">
      <div class="panel">
        <div class="eyebrow">Contract Summary</div>
        ${renderContractSummary(contract)}
      </div>
    </section>
    <section class="section">
      <div class="panel">
        <div class="eyebrow">Danger Zone</div>
        <h2 class="section-heading section-heading--small" style="margin-top:18px;">Project removal</h2>
        <p class="body-copy" style="margin-top:12px;">Archive is the preferred action. Hard delete should only be used for empty setup or test projects with no related quotes, assets, contracts, or signatures.</p>
        <div class="stack" style="margin-top:18px;">
          <div class="message">
            Archive hides the project from active operations while preserving its records.
          </div>
          <div class="message message--error">
            Hard delete is permanent. If related records exist, deletion should be blocked and archive should be used instead.
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button class="button" type="button" data-action="archive-project" data-project-id="${escapeHtml(project.id)}">Archive Project</button>
            <button class="button button--danger" type="button" data-action="delete-project" data-project-id="${escapeHtml(project.id)}">Delete Project Permanently</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderAdminProjectDetail(state) {
  const bundle = state.portalData?.currentProject;
  if (!bundle?.project) {
    return '<div class="empty-state">Project data could not be loaded.</div>';
  }

  const { project, quote, quotes = [], assets = [], contract } = bundle;
  const client = project.clients || null;
  const address = formatAddress(project) || project.location || 'Address pending';
  const nextAssetSortOrder = (assets.length ? Number(assets[assets.length - 1].sort_order || 0) : 0) + 1;
  const activeView = state.projectView || 'overview';

  let viewContent = '';
  if (activeView === 'overview') viewContent = renderOverviewTab(project, quote, client, address);
  else if (activeView === 'quotes')   viewContent = renderQuotesTab(project, quote, quotes);
  else if (activeView === 'assets')   viewContent = renderAssetsTab(project, assets, nextAssetSortOrder);
  else if (activeView === 'settings') viewContent = renderSettingsTab(project, contract);

  return `
    <section class="section">
      <div class="hero-card">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Admin Project</div>
            <h1 class="headline" style="margin-top:22px;">${escapeHtml(project.title)}<br><em>${escapeHtml(project.project_code)}</em></h1>
            <p class="lede">${escapeHtml(project.summary || 'Manage project basics, quotes, assets, and contract readiness from this page.')}</p>
          </div>
          <div class="glass-card">
            <div class="meta-stack">
              <div>
                <div class="meta-label">Client</div>
                <div class="body-copy" style="margin-top:6px;">${escapeHtml(client?.full_name || 'Client not linked')}</div>
                <div class="field-help" style="margin-top:4px;">${escapeHtml(client?.email || client?.primary_phone || 'No client contact recorded')}</div>
              </div>
              <div>
                <div class="meta-label">Project status</div>
                <div style="margin-top:10px;"><span class="status-pill">${escapeHtml(project.status || 'draft')}</span></div>
              </div>
              <div>
                <div class="meta-label">Service address</div>
                <div class="body-copy" style="margin-top:6px;">${escapeHtml(address)}</div>
              </div>
              <div>
                <div class="meta-label">Current quote</div>
                <div class="body-copy" style="margin-top:6px;">${quote ? `Version ${escapeHtml(quote.version_number)} • ${escapeHtml(quote.quote_number || quote.title || 'Quote')}` : 'No quote yet'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      ${renderTabNav(activeView)}
      ${viewContent}
    </section>
  `;
}
