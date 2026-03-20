import { escapeHtml, formatDate, slugPath } from '../lib/format.js';

function renderClientOptions(clients = []) {
  return clients.map((client) => `
    <option value="${escapeHtml(client.id)}">
      ${escapeHtml(client.full_name)} - ${escapeHtml(client.primary_phone || 'No phone')} - ID ${escapeHtml(client.id)}
    </option>
  `).join('');
}

function renderEditClientModal(client) {
  if (!client) return '';

  return `
    <div class="modal-backdrop" data-action="close-edit-client-modal">
      <div class="modal-card panel" role="dialog" aria-modal="true" aria-labelledby="edit-client-title" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div class="eyebrow">Edit Client</div>
            <h2 id="edit-client-title" class="section-heading section-heading--small" style="margin-top:16px;">${escapeHtml(client.full_name || 'Client profile')}</h2>
          </div>
          <button class="button" type="button" data-action="close-edit-client-modal">Close</button>
        </div>
        <div class="stack" style="margin-top:22px;">
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="edit-client-id">Client ID</label>
              <input id="edit-client-id" class="field-input" type="text" value="${escapeHtml(client.id)}" readonly>
            </div>
            <div class="field-group">
              <label class="field-label" for="edit-client-primary-phone">Primary Phone</label>
              <input id="edit-client-primary-phone" class="field-input" type="text" value="${escapeHtml(client.primary_phone || '')}" readonly>
            </div>
          </div>
          <div class="field-help">Primary phone is used as the portal login identifier and cannot be changed here.</div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="edit-client-name">Client Name</label>
              <input id="edit-client-name" class="field-input" type="text" value="${escapeHtml(client.full_name || '')}" placeholder="e.g. Sarah Johnson">
            </div>
            <div class="field-group">
              <label class="field-label" for="edit-client-email">Email</label>
              <input id="edit-client-email" class="field-input" type="email" value="${escapeHtml(client.email || '')}" placeholder="e.g. sarah@example.com">
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="edit-client-secondary-phone">Secondary Phone</label>
              <input id="edit-client-secondary-phone" class="field-input" type="tel" inputmode="tel" value="${escapeHtml(client.secondary_phone || '')}" placeholder="Optional">
            </div>
            <div class="field-group">
              <label class="field-label" for="edit-client-status">Status</label>
              <input id="edit-client-status" class="field-input" type="text" value="${escapeHtml(client.status || 'active')}" placeholder="active">
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="edit-client-notes">Notes</label>
            <textarea id="edit-client-notes" class="field-textarea" placeholder="Client profile notes">${escapeHtml(client.notes || '')}</textarea>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;">
            <button class="button" type="button" data-action="close-edit-client-modal">Cancel</button>
            <button class="button button--primary" type="button" data-action="update-client-profile">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTabNav(activeView, stats) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients',  label: `Clients${stats?.clients ? ` (${stats.clients})` : ''}` },
    { id: 'projects', label: `Projects${stats?.projects ? ` (${stats.projects})` : ''}` },
    { id: 'access',   label: `Access${stats?.whitelists ? ` (${stats.whitelists})` : ''}` },
  ];

  return `
    <nav class="admin-tab-nav" style="display:flex;gap:8px;flex-wrap:wrap;padding:0 0 24px 0;border-bottom:1px solid var(--border,rgba(255,255,255,0.1));margin-bottom:32px;">
      ${tabs.map((tab) => `
        <button
          class="button${activeView === tab.id ? ' button--primary' : ''}"
          type="button"
          data-action="set-admin-view"
          data-view="${tab.id}"
          style="${activeView === tab.id ? '' : 'opacity:0.6;'}"
        >${tab.label}</button>
      `).join('')}
    </nav>
  `;
}

function renderOverview(admin) {
  return `
    <section class="section">
      <div class="hero-card">
        <div class="admin-grid">
          <div>
            <div class="eyebrow">Admin Console</div>
            <h1 class="headline" style="margin-top:22px;">Client portal operations<br><em>across projects, quotes, and access.</em></h1>
            <p class="lede">Create the client, attach the project site, upload the current quote PDF, and keep the latest version clear for the client portal.</p>
          </div>
          <div class="panel-grid">
            <div class="glass-card" style="cursor:pointer;" data-action="set-admin-view" data-view="clients">
              <div class="meta-label">Clients</div>
              <div class="stat-value" style="margin-top:10px;">${String(admin?.stats?.clients || 0).padStart(2, '0')}</div>
            </div>
            <div class="glass-card" style="cursor:pointer;" data-action="set-admin-view" data-view="projects">
              <div class="meta-label">Projects</div>
              <div class="stat-value" style="margin-top:10px;">${String(admin?.stats?.projects || 0).padStart(2, '0')}</div>
            </div>
            <div class="glass-card" style="cursor:pointer;" data-action="set-admin-view" data-view="access">
              <div class="meta-label">Whitelist entries</div>
              <div class="stat-value" style="margin-top:10px;">${String(admin?.stats?.whitelists || 0).padStart(2, '0')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="panel">
        <div class="eyebrow">Quick actions</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;">
          <button class="button button--primary" type="button" data-action="set-admin-view" data-view="clients">+ Add client</button>
          <button class="button button--primary" type="button" data-action="set-admin-view" data-view="projects">+ Create project</button>
          <button class="button button--primary" type="button" data-action="set-admin-view" data-view="access">+ Add access</button>
        </div>
      </div>
    </section>
  `;
}

function renderClientsView(admin) {
  const editingClient = null; // modal handled separately at top level
  return `
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Add Client</div>
        <div class="stack" style="margin-top:18px;">
          <div class="field-group">
            <label class="field-label" for="client-name">Client Name</label>
            <input id="client-name" class="field-input" type="text" placeholder="e.g. Sarah Johnson">
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="client-email">Email</label>
              <input id="client-email" class="field-input" type="email" placeholder="e.g. sarah@example.com">
            </div>
            <div class="field-group">
              <label class="field-label" for="client-phone">Phone</label>
              <input id="client-phone" class="field-input" type="tel" inputmode="tel" placeholder="e.g. +17786838780">
              <div class="field-help">Use full number with country code.</div>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="client-notes">Notes</label>
            <textarea id="client-notes" class="field-textarea" placeholder="e.g. Living room feature wall inquiry"></textarea>
          </div>
          <button class="button button--primary" data-action="save-client">Save client</button>
        </div>
      </div>
      <div class="panel">
        <div class="eyebrow">Recent Clients</div>
        <div class="stack" style="margin-top:18px;">
          ${(admin?.clients || []).slice(0, 6).map((client) => `
            <div class="glass-card">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">
                <div class="meta-label">${escapeHtml(client.status)}</div>
                <button class="button" type="button" data-action="edit-client" data-client-id="${escapeHtml(client.id)}">Edit</button>
              </div>
              <h3 class="section-heading section-heading--small" style="margin-top:10px;">${escapeHtml(client.full_name)}</h3>
              <div class="body-copy" style="margin-top:10px;">${escapeHtml(client.primary_phone || 'No phone saved')}</div>
              ${client.secondary_phone ? `<div class="muted" style="font-size:0.72rem;margin-top:6px;">Secondary ${escapeHtml(client.secondary_phone)}</div>` : ''}
              ${client.email ? `<div class="muted" style="font-size:0.72rem;margin-top:6px;">${escapeHtml(client.email)}</div>` : ''}
              <div class="muted" style="font-size:0.72rem;margin-top:10px;">Client ID ${escapeHtml(client.id)}</div>
            </div>
          `).join('') || '<div class="empty-state">No clients yet.</div>'}
        </div>
      </div>
    </section>
  `;
}

function generateProjectCode(city, allProjects) {
  const prefix = city === 'Calgary' ? 'C' : 'E';
  const year = new Date().getFullYear();
  const yearStr = String(year);
  const existing = (allProjects || []).filter((p) => {
    return p.project_code && p.project_code.startsWith(prefix + yearStr);
  });
  const nextNum = String(existing.length + 1).padStart(2, '0');
  return `${prefix}${yearStr}-${nextNum}`;
}

function renderProjectsView(admin, projectFilter) {
  const allProjects = admin?.projects || [];
  const filteredProjects = allProjects.filter((project) => {
    if (projectFilter === 'archived') return project.status === 'archived';
    if (projectFilter === 'all') return true;
    return project.status !== 'archived';
  });
  const archivedCount = allProjects.filter((project) => project.status === 'archived').length;
  const clients = admin?.clients || [];

  // Pre-generate project code for Edmonton (default)
  const defaultCode = generateProjectCode('Edmonton', allProjects);
  const calgaryCode = generateProjectCode('Calgary', allProjects);

  const clientOptions = clients.map((c) => `
    <option value="${escapeHtml(c.id)}" data-phone="${escapeHtml(c.primary_phone || '')}" data-city="${escapeHtml(c.city || '')}" data-province="${escapeHtml(c.province || '')}">
      ${escapeHtml(c.full_name)} · ${escapeHtml(c.primary_phone || 'No phone')}
    </option>
  `).join('');

  return `
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Create Project</div>
        <div class="stack" style="margin-top:18px;">

          <div class="field-group">
            <label class="field-label" for="project-client-id">Client</label>
            <select id="project-client-id" class="field-select" data-action="project-client-change">
              <option value="">— Select client —</option>
              ${clientOptions}
            </select>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="project-city-select">City</label>
              <select id="project-city-select" class="field-select" data-action="project-city-change">
                <option value="Edmonton">Edmonton</option>
                <option value="Calgary">Calgary</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="project-code">Project Code</label>
              <input id="project-code" class="field-input" type="text" value="${escapeHtml(defaultCode)}" readonly style="opacity:0.7;cursor:default;">
              <div class="field-help">自动生成，无需填写。</div>
            </div>
          </div>

          <input type="hidden" id="project-city" value="Edmonton">
          <input type="hidden" id="project-province" value="AB">

          <div class="field-group">
            <label class="field-label" for="project-title">Project Title</label>
            <input id="project-title" class="field-input" type="text" placeholder="e.g. Fireplace Feature Wall">
          </div>

          <div class="field-group">
            <label class="field-label" for="project-summary">Project Summary</label>
            <textarea id="project-summary" class="field-textarea" placeholder="e.g. Venetian plaster fireplace with soft movement and polished finish"></textarea>
          </div>

          <div class="field-group">
            <label class="field-label" for="service-address">Service Address</label>
            <input id="service-address" class="field-input" type="text" placeholder="e.g. 1234 Valley Ridge Drive">
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="project-postal">Postal Code</label>
              <input id="project-postal" class="field-input" type="text" placeholder="e.g. T5A 0A1">
            </div>
            <div class="field-group">
              <label class="field-label" for="project-status">Status</label>
              <select id="project-status" class="field-select">
                <option value="proposal_sent">Proposal Sent</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="signed">Signed</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="quote-number">Quote Number <span class="muted">(可选)</span></label>
              <input id="quote-number" class="field-input" type="text" placeholder="e.g. E2026-01-V1">
              <div class="field-help">留空则自动使用 Project Code + V1。</div>
            </div>
            <div class="field-group">
              <label class="field-label" for="quote-pdf">Upload Quote PDF</label>
              <input id="quote-pdf" class="field-input" type="file" accept="application/pdf">
              <div class="field-help">PDF only. This becomes version 1.</div>
            </div>
          </div>

          <div style="border-top:1px solid var(--border,rgba(0,0,0,0.08));margin-top:8px;padding-top:20px;">
            <div class="eyebrow" style="margin-bottom:12px;">Grant Portal Access</div>
            <div class="field-help" style="margin-bottom:14px;">保存项目后同时开通客户端访问权限。留空则稍后在 Access tab 手动添加。</div>
            <div class="field-row">
              <div class="field-group">
                <label class="field-label" for="project-access-phone">Access Phone <span class="muted">(可选)</span></label>
                <input id="project-access-phone" class="field-input" type="tel" inputmode="tel" placeholder="自动从客户资料带入">
                <div class="field-help">留空则不开通访问。</div>
              </div>
              <div class="field-group">
                <label class="field-label" for="project-access-expiry">Expires At <span class="muted">(可选)</span></label>
                <input id="project-access-expiry" class="field-input" type="datetime-local">
                <div class="field-help">留空表示永不过期。</div>
              </div>
            </div>
          </div>

          <button class="button button--primary" data-action="save-project">Save project & grant access</button>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow">Projects</div>
        <div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
          <div class="field-help">Default view shows active projects only.</div>
          <div class="field-group" style="min-width:220px;">
            <label class="field-label" for="admin-project-filter">Filter</label>
            <select id="admin-project-filter" class="field-select">
              <option value="active" ${projectFilter === 'active' ? 'selected' : ''}>Active projects</option>
              <option value="all" ${projectFilter === 'all' ? 'selected' : ''}>All projects</option>
              <option value="archived" ${projectFilter === 'archived' ? 'selected' : ''}>Archived (${archivedCount})</option>
            </select>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:18px;">
          <table>
            <thead><tr><th>Project</th><th>Status</th><th>Client</th><th>Quote</th></tr></thead>
            <tbody>
              ${filteredProjects.map((project) => `
                <tr>
                  <td>
                    <div>${escapeHtml(project.title)}</div>
                    <div class="muted" style="font-size:0.72rem;margin-top:4px;">${escapeHtml(project.project_code)}</div>
                    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                      <a class="button" href="${slugPath(`admin/projects/${project.id}`)}">Manage</a>
                      ${project.status === 'archived' ? '' : `<button class="button" type="button" data-action="archive-project" data-project-id="${escapeHtml(project.id)}">Archive</button>`}
                    </div>
                  </td>
                  <td>${escapeHtml(project.status)}</td>
                  <td>${escapeHtml(project.clients?.full_name || 'Unassigned')}</td>
                  <td>${project.current_quote_version ? `v${escapeHtml(project.current_quote_version)}` : 'None yet'}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No projects match this filter.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderAccessView(admin) {
  const clients = admin?.clients || [];
  const allProjects = admin?.projects || [];

  const clientOptions = clients.map((c) => `
    <option value="${escapeHtml(c.id)}" data-phone="${escapeHtml(c.primary_phone || '')}">
      ${escapeHtml(c.full_name)} · ${escapeHtml(c.primary_phone || 'No phone')}
    </option>
  `).join('');

  // Project options grouped: will be filtered client-side via JS
  const projectOptions = allProjects.map((p) => `
    <option value="${escapeHtml(p.id)}" data-client-id="${escapeHtml(p.client_id || '')}">
      ${escapeHtml(p.project_code)} · ${escapeHtml(p.title)} · ${escapeHtml(p.clients?.full_name || 'Unassigned')}
    </option>
  `).join('');

  return `
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Whitelist Access</div>
        <div class="stack" style="margin-top:18px;">

          <div class="field-group">
            <label class="field-label" for="whitelist-client-select">Client</label>
            <select id="whitelist-client-select" class="field-select" data-action="whitelist-client-change">
              <option value="">— Select client —</option>
              ${clientOptions}
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="whitelist-project-id">Project</label>
            <select id="whitelist-project-id" class="field-select" data-action="whitelist-project-change">
              <option value="">— Select project —</option>
              ${projectOptions}
            </select>
            <div class="field-help">选择客户后自动过滤该客户的项目。</div>
          </div>

          <input type="hidden" id="whitelist-client-id" value="">

          <div class="field-group">
            <label class="field-label" for="whitelist-phone">Phone</label>
            <input id="whitelist-phone" class="field-input" type="tel" inputmode="tel" placeholder="自动从客户资料带入，可修改">
            <div class="field-help">选择客户后自动填入主要电话号码。</div>
          </div>

          <div class="field-group">
            <label class="field-label" for="whitelist-expiry">Expires At <span class="muted">(可选)</span></label>
            <input id="whitelist-expiry" class="field-input" type="datetime-local">
            <div class="field-help">留空表示永不过期。</div>
          </div>

          <button class="button button--primary" data-action="save-whitelist">Save whitelist entry</button>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow">Whitelist & Logs</div>
        <div class="table-wrap" style="margin-top:18px;">
          <table>
            <thead><tr><th>Phone</th><th>Project</th><th>Status</th></tr></thead>
            <tbody>
              ${(admin?.whitelists || []).slice(0, 8).map((item) => `
                <tr>
                  <td>${escapeHtml(item.phone)}</td>
                  <td>${escapeHtml(item.projects?.title || 'Unassigned')}</td>
                  <td>${item.is_active ? '<span class="status-pill status-success">active</span>' : '<span class="status-pill status-danger">revoked</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-wrap" style="margin-top:18px;">
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Phone</th></tr></thead>
            <tbody>
              ${(admin?.logs || []).slice(0, 8).map((log) => `
                <tr>
                  <td>${formatDate(log.timestamp)}</td>
                  <td>${escapeHtml(log.action)}</td>
                  <td>${escapeHtml(log.phone || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

export function renderAdminDashboard(state) {
  const admin = state.adminData;
  const activeView = state.adminView || 'overview';
  const projectFilter = state.adminProjectFilter || 'active';
  const editingClient = (admin?.clients || []).find((client) => String(client.id) === String(state.editingClientId));

  let viewContent = '';
  if (activeView === 'overview') viewContent = renderOverview(admin);
  else if (activeView === 'clients') viewContent = renderClientsView(admin);
  else if (activeView === 'projects') viewContent = renderProjectsView(admin, projectFilter);
  else if (activeView === 'access') viewContent = renderAccessView(admin);

  return `
    <section class="section">
      ${renderTabNav(activeView, admin?.stats)}
      ${viewContent}
    </section>
    ${renderEditClientModal(editingClient)}
  `;
}
