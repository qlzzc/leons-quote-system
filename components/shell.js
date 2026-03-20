import { escapeHtml } from '../lib/format.js';

export function renderShell({ title = '', subtitle = '', body = '', viewer = null, routeName = '' }) {
  const isAdmin = Boolean(viewer?.isAdmin);
  const nav = [
    { href: '#/', label: 'Portal Home', active: routeName === 'portal-home' || routeName === 'project' || routeName === 'quote' || routeName === 'contract' },
    ...(isAdmin ? [{ href: '#/admin', label: 'Admin', active: routeName === 'admin' || routeName === 'admin-project' }] : []),
  ];

  return `
    <div class="app-shell">
      <header class="portal-header">
        <div class="portal-header__inner">
          <a class="brand-mark" href="#/">
            <div class="brand-mark__seal">L</div>
            <div class="brand-mark__copy">
              <strong>Leon Zhang's Venetian Plaster</strong>
              <span>Client Portal</span>
            </div>
          </a>
          <nav class="portal-nav">
            ${nav.map((item) => `<a class="nav-link ${item.active ? 'is-active' : ''}" href="${item.href}">${escapeHtml(item.label)}</a>`).join('')}
            ${viewer ? '<button class="chip-link" data-action="sign-out" type="button">Sign Out</button>' : ''}
          </nav>
        </div>
      </header>
      <main class="page-shell">
        ${title ? `
          <section class="hero-card">
            <div class="hero-grid">
              <div>
                <div class="eyebrow">${escapeHtml(subtitle || 'Client Portal')}</div>
                <h1 class="headline" style="margin-top:22px;">${title}</h1>
              </div>
              ${viewer ? `
                <div class="meta-stack">
                  <div class="meta-label">Verified access</div>
                  <div class="stat-value">${escapeHtml(viewer.isAdmin ? 'Admin' : 'Client')}</div>
                  <div class="body-copy">Authenticated for ${escapeHtml(viewer.phone || '')}${viewer.clientLabel ? ` | ${escapeHtml(viewer.clientLabel)}` : ''}</div>
                </div>
              ` : ''}
            </div>
          </section>
        ` : ''}
        ${body}
      </main>
    </div>

    <!-- Toast container -->
    <div id="toast-container" style="
      position:fixed;
      bottom:28px;
      right:28px;
      z-index:9999;
      display:flex;
      flex-direction:column;
      gap:10px;
      pointer-events:none;
    "></div>

    <style>
      .toast {
        pointer-events:auto;
        min-width:260px;
        max-width:380px;
        padding:14px 18px;
        border-radius:10px;
        font-size:0.85rem;
        line-height:1.5;
        display:flex;
        align-items:flex-start;
        gap:12px;
        box-shadow:0 4px 24px rgba(0,0,0,0.18);
        animation: toast-in 0.22s ease;
        background:var(--surface, #1a1a1a);
        color:var(--text, #f0f0f0);
        border:1px solid rgba(255,255,255,0.08);
      }
      .toast--success { border-left:3px solid #5cb87a; }
      .toast--error   { border-left:3px solid #e05555; }
      .toast--info    { border-left:3px solid #5b9bd5; }
      .toast__icon { font-size:1rem; margin-top:1px; flex-shrink:0; }
      .toast__body { flex:1; }
      .toast__close {
        background:none;border:none;cursor:pointer;
        color:var(--text-soft,#888);font-size:1rem;padding:0;flex-shrink:0;
        line-height:1;
      }
      .toast--out { animation: toast-out 0.2s ease forwards; }
      @keyframes toast-in  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      @keyframes toast-out { from { opacity:1; transform:translateY(0); }   to { opacity:0; transform:translateY(8px); } }
    </style>
  `;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  ms before auto-dismiss (0 = sticky)
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.id = id;
  el.innerHTML = `
    <span class="toast__icon">${icons[type] || 'ℹ'}</span>
    <span class="toast__body">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Dismiss">×</button>
  `;

  const dismiss = () => {
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 220);
  };

  el.querySelector('.toast__close').addEventListener('click', dismiss);
  container.appendChild(el);

  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}
