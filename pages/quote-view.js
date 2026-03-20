import { escapeHtml, formatDate } from '../lib/format.js';

function getClientStatusLabel(status) {
  if (status === 'signed') return 'Signed \u2713';
  if (status === 'approved') return 'Approved';
  return 'Awaiting review';
}

function renderSigningState({ quote, quoteSignature, state }) {
  const signingState = state.quoteSigning || {};
  const locked = signingState.submitting;
  const signedAt = quoteSignature?.signed_at || null;

  if (quoteSignature?.status === 'signed') {
    return `
      <div class="message message--success" style="margin-top:18px;">
        Signed by ${escapeHtml(quoteSignature.signer_name)} on ${escapeHtml(formatDate(signedAt))}. A signed snapshot has been archived for this quote.
      </div>
    `;
  }

  if (quote.status !== 'approved') {
    return `
      <div class="message" style="margin-top:18px;">
        Review the current quote first. Signing unlocks after it has been approved.
      </div>
    `;
  }

  return `
    <div class="stack quote-signing-stack" style="margin-top:18px;">
      <div class="field-group">
        <label class="field-label" for="quote-signer-name">Signer Full Name</label>
        <input id="quote-signer-name" class="field-input" type="text" value="${escapeHtml(signingState.signerName || '')}" placeholder="Full legal name" ${locked ? 'disabled' : ''}>
      </div>
      <div class="field-group">
        <label class="field-label" for="quote-signing-date">Signing Date</label>
        <input id="quote-signing-date" class="field-input" type="text" value="${escapeHtml(formatDate(new Date().toISOString()))}" readonly>
      </div>
      <div class="field-group">
        <label class="field-label">Signature</label>
        <div class="signature-pad ${locked ? 'signature-pad--locked' : ''}">
          <canvas id="quote-signature-canvas"></canvas>
          <div class="signature-pad__placeholder" id="quote-signature-placeholder">Draw signature here</div>
        </div>
      </div>
      <label class="checkbox-row">
        <input id="quote-agreement-checkbox" type="checkbox" ${signingState.agreementAccepted ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span>I confirm that I have reviewed this quote and agree to proceed electronically.</span>
      </label>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="button" type="button" data-action="clear-quote-signature" ${locked ? 'disabled' : ''}>Clear signature</button>
        <button class="button button--primary" type="button" data-action="submit-quote-signature" ${locked ? 'disabled' : ''}>${locked ? 'Submitting signature...' : 'Submit signature'}</button>
      </div>
      ${locked ? '<div class="message">Submitting and verifying your signature. Please keep this page open.</div>' : ''}
    </div>
  `;
}

export function renderQuoteView(state) {
  const bundle = state.portalData?.currentProject;
  const project = bundle?.project;
  const quote = bundle?.quote;
  const quoteSignature = bundle?.quoteSignature;
  if (!project || !quote) return '<div class="empty-state">A quote has not been attached to this project yet.</div>';

  const statusLabel = getClientStatusLabel(quote.status);
  const nextStep = quoteSignature?.status === 'signed'
    ? 'This quote has already been signed.'
    : quote.status === 'approved' || quote.status === 'signed'
      ? 'This quote is approved and ready to sign.'
      : 'Review the current quote and approve it when you are ready.';

  return `
    <section class="section">
      <div class="panel">
        <div class="viewer-header">
          <div class="eyebrow">Current Quote</div>
          <div class="viewer-meta-row" style="margin-top:18px;">
            <span class="status-pill">${escapeHtml(project.project_code)}</span>
            <span class="status-pill ${statusLabel === 'Signed \u2713' ? 'status-success' : ''}">${escapeHtml(statusLabel)}</span>
          </div>
          <h2 class="section-heading section-heading--small" style="margin-top:20px;">${escapeHtml(quote.title || `${project.title} Proposal`)}</h2>
          <p class="body-copy" style="margin-top:14px;">${escapeHtml(quote.intro || 'This is the current formal quote document for your project.')}</p>
        </div>
        <div style="margin-top:24px;">
          ${quote.pdf_file_url ? `
            <div class="pdf-frame">
              <iframe src="${escapeHtml(quote.pdf_file_url)}#view=FitH" title="Current Quote PDF"></iframe>
            </div>
          ` : '<div class="empty-state">The current quote PDF is not available yet.</div>'}
        </div>
        <div class="viewer-secondary-meta">
          <div><span class="meta-label">Quote number</span><span class="viewer-secondary-value">${escapeHtml(quote.quote_number || 'Pending')}</span></div>
          <div><span class="meta-label">Project</span><span class="viewer-secondary-value">${escapeHtml(project.title)}</span></div>
          <div><span class="meta-label">Next step</span><span class="viewer-secondary-value">${escapeHtml(nextStep)}</span></div>
        </div>
        ${quoteSignature?.status === 'signed'
          ? '<div class="message message--success" style="margin-top:18px;">This quote has been signed and archived.</div>'
          : quote.status === 'approved' || quote.status === 'signed'
          ? '<div class="message message--success" style="margin-top:18px;">This quote has been approved and is ready for signing.</div>'
          : '<div style="margin-top:18px;"><button class="button" data-action="approve-quote">Approve quote</button></div>'}
      </div>
    </section>
    <section class="section">
      <div class="panel">
        <div class="eyebrow">Sign Step</div>
        <h2 class="section-heading section-heading--small" style="margin-top:18px;">Sign the current quote</h2>
        <p class="body-copy" style="margin-top:12px;">Your signature is attached to the current quote and archived for future reference.</p>
        ${renderSigningState({ quote, quoteSignature, state })}
      </div>
    </section>
  `;
}
