import { escapeHtml, formatDate } from '../lib/format.js';

export function renderContractView(state) {
  const bundle = state.portalData?.currentProject;
  const project = bundle?.project;
  const contract = bundle?.contract;
  if (!project || !contract) return `<div class="empty-state">No contract has been issued for this project yet.</div>`;

  const clientSignature = (contract.signatures || []).find(signature => signature.signer_role === 'client');

  return `
    <section class="section">
      <div class="hero-card">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Contract & Signing</div>
            <h1 class="headline" style="margin-top:22px;">${escapeHtml(contract.title)}<br><em>${escapeHtml(project.title)}</em></h1>
            <p class="lede">${escapeHtml(contract.body_markdown || 'Contract terms are shown below for review and signing.')}</p>
          </div>
          <div class="glass-card">
            <div class="meta-stack">
              <div><div class="meta-label">Version</div><div class="body-copy" style="margin-top:6px;">v${escapeHtml(contract.version)}</div></div>
              <div><div class="meta-label">Status</div><div style="margin-top:10px;"><span class="status-pill ${contract.status === 'signed' ? 'status-success' : ''}">${escapeHtml(contract.status)}</span></div></div>
              <div><div class="meta-label">Last updated</div><div class="body-copy" style="margin-top:6px;">${formatDate(contract.updated_at)}</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="section split-grid">
      <div class="panel">
        <div class="eyebrow">Agreement</div>
        <div class="body-copy" style="margin-top:18px;white-space:pre-wrap;">${escapeHtml(contract.body_markdown || 'No contract body has been provided yet.')}</div>
      </div>
      <div class="panel">
        <div class="eyebrow">Client Signature</div>
        ${clientSignature ? `
          <div class="message message--success" style="margin-top:18px;">Signed by ${escapeHtml(clientSignature.signer_name)} on ${formatDate(clientSignature.signed_at)}.</div>
        ` : `
          <div class="stack" style="margin-top:18px;">
            <div class="field-group">
              <label class="field-label" for="signer-name">Signer name</label>
              <input id="signer-name" class="field-input" type="text" placeholder="Full legal name">
            </div>
            <div class="field-group">
              <label class="field-label" for="consent-text">Consent statement</label>
              <textarea id="consent-text" class="field-textarea">I confirm that I have reviewed the agreement and agree to proceed with this contract electronically.</textarea>
            </div>
            <div class="signature-pad">
              <canvas id="signature-canvas"></canvas>
              <div class="signature-pad__placeholder" id="signature-placeholder">Draw signature here</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <button class="button" type="button" data-action="clear-signature">Clear signature</button>
              <button class="button button--primary" type="button" data-action="submit-contract-signature">Sign contract</button>
            </div>
          </div>
        `}
      </div>
    </section>
  `;
}

export function mountContractView(onSign) {
  const canvas = document.getElementById('signature-canvas');
  if (!canvas) return;
  const placeholder = document.getElementById('signature-placeholder');
  const ctx = canvas.getContext('2d');
  let drawing = false;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#565954';
  }
  resizeCanvas();

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }
  function start(event) {
    drawing = true;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    placeholder.style.display = 'none';
    event.preventDefault();
  }
  function move(event) {
    if (!drawing) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    event.preventDefault();
  }
  function stop() {
    drawing = false;
    ctx.beginPath();
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);

  document.querySelector('[data-action="clear-signature"]')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    placeholder.style.display = 'grid';
  });

  document.querySelector('[data-action="submit-contract-signature"]')?.addEventListener('click', () => {
    onSign({
      signerName: document.getElementById('signer-name')?.value || '',
      consentText: document.getElementById('consent-text')?.value || '',
      signatureData: canvas.toDataURL('image/png'),
    });
  });
}
