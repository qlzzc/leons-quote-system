import { renderShell, showToast } from '../components/shell.js';
import { api } from './api.js';
import { formatDate } from './format.js';
import { clearSession, parseRoute, restoreSessionToken, setFeedback, setSessionToken, state } from './state.js';
import { renderAdminDashboard } from '../pages/admin-dashboard.js';
import { renderAdminProjectDetail } from '../pages/admin-project-detail.js';
import { mountContractView, renderContractView } from '../pages/contract-view.js';
import { mountLogin, renderLogin } from '../pages/login.js';
import { renderPortalHome } from '../pages/portal-home.js';
import { renderProjectDetail } from '../pages/project-detail.js';
import { renderQuoteView } from '../pages/quote-view.js';
import { mountQuoteSigning } from '../pages/quote-signing.js';

const app = document.getElementById('app');

async function boot() {
  restoreSessionToken();
  if (state.sessionToken) {
    try {
      const sessionData = await api.getSession(state.sessionToken);
      state.viewer = sessionData.session;
      await loadRouteData();
    } catch {
      clearSession();
    }
  }
  renderApp();
}

async function loadRouteData() {
  const route = parseRoute();
  if (!state.viewer) return;

  if (state.viewer.isAdmin && route.name === 'admin') {
    state.adminData = await api.getAdminDashboard(state.sessionToken);
    return;
  }

  if (state.viewer.isAdmin && route.name === 'admin-project') {
    state.portalData = await api.getPortalData(state.sessionToken, route.projectId || '');
    return;
  }

  if (!state.viewer.isAdmin) {
    const portalData = await api.getPortalData(state.sessionToken, route.projectId || '');
    state.portalData = portalData;
    state.viewer = {
      ...state.viewer,
      clientLabel: portalData.client?.full_name || '',
    };
    const projectId = portalData?.currentProject?.project?.id || route.projectId || '';
    if (projectId && state.quoteSigning.projectId !== projectId) {
      state.quoteSigning = {
        projectId,
        signerName: portalData.client?.full_name || '',
        agreementAccepted: false,
        signatureData: '',
        submitting: false,
      };
    }
    // Auto-redirect if client has exactly one project and is on portal home
    const projects = portalData?.projects || [];
    if (projects.length === 1 && route.name === 'portal-home') {
      window.location.hash = `#/projects/${projects[0].id}`;
      return;
    }
  }
}

function renderApp() {
  const route = parseRoute();
  if (!state.viewer) {
    app.innerHTML = renderLogin(state);
    mountLogin({
      state,
      onSendOtp: handleSendOtp,
      onVerifyOtp: handleVerifyOtp,
      onResendOtp: handleResendOtp,
      onChangeNumber: handleChangeNumber,
      onOtpInput: handleOtpInput,
    });
    return;
  }

  if (state.viewer.isAdmin && route.name === 'admin') {
    app.innerHTML = renderShell({
      title: 'Admin operations',
      subtitle: 'Portal management',
      body: renderAdminDashboard(state),
      viewer: state.viewer,
      routeName: route.name,
    });
    mountShell();
    mountAdmin();
    return;
  }

  if (state.viewer.isAdmin && route.name === 'admin-project') {
    const project = state.portalData?.currentProject?.project;
    app.innerHTML = renderShell({
      title: project?.title || 'Project Detail',
      subtitle: project?.project_code || 'Admin project',
      body: renderAdminProjectDetail(state),
      viewer: state.viewer,
      routeName: route.name,
    });
    mountShell();
    mountAdminProject();
    return;
  }

  const pageBody = route.name === 'project'
    ? renderProjectDetail(state)
    : route.name === 'quote'
      ? renderQuoteView(state)
      : route.name === 'contract'
        ? renderContractView(state)
        : renderPortalHome(state);

  app.innerHTML = renderShell({
    title: '',
    subtitle: '',
    body: pageBody,
    viewer: state.viewer,
    routeName: route.name,
  });
  mountShell();

  if (route.name === 'quote') {
    document.querySelector('[data-action="approve-quote"]')?.addEventListener('click', handleApproveQuote);
    mountQuoteSigning({ state, onSubmit: handleSignQuote });
  }
  if (route.name === 'contract') {
    mountContractView(handleSignContract);
  }
}

function mountShell() {
  document.querySelector('[data-action="sign-out"]')?.addEventListener('click', () => {
    clearSession();
    window.location.hash = '#/';
    renderApp();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the selected PDF.'));
    reader.readAsDataURL(file);
  });
}

async function handleSendOtp(phone) {
  state.loading = true;
  setFeedback();
  renderApp();
  try {
    await api.sendOtp(phone);
    state.pendingPhone = phone;
    state.otpCode = '';
    state.otpSent = true;
    showToast(`A verification code was sent to ${phone}.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.loading = false;
    renderApp();
  }
}

async function handleVerifyOtp(code) {
  if (String(code).length < 6) {
    setFeedback({ error: 'Enter the 6-digit verification code.' });
    renderApp();
    return;
  }
  state.otpCode = String(code).slice(0, 6);
  state.loading = true;
  setFeedback();
  renderApp();
  try {
    const data = await api.verifyOtp(state.pendingPhone, code);
    setSessionToken(data.token);
    const sessionData = await api.getSession(data.token);
    state.viewer = sessionData.session;
    state.otpCode = '';
    state.otpSent = false;
    window.location.hash = data.isAdmin ? '#/admin' : '#/';
    await loadRouteData();
  } catch (error) {
    state.viewer = null;
    state.portalData = null;
    state.adminData = null;
    setSessionToken('');
    state.otpSent = true;
    showToast(error.message, 'error');
  } finally {
    state.loading = false;
    renderApp();
  }
}

function handleChangeNumber() {
  state.otpCode = '';
  state.otpSent = false;
  setFeedback();
  renderApp();
}

async function handleResendOtp() {
  if (!state.pendingPhone) return;
  await handleSendOtp(state.pendingPhone);
}

function handleOtpInput(code) {
  state.otpCode = String(code || '').replace(/\D/g, '').slice(0, 6);
}

async function handleApproveQuote() {
  const bundle = state.portalData?.currentProject;
  if (!bundle?.project?.id || !bundle?.quote?.id) return;
  try {
    await api.approveQuote(state.sessionToken, bundle.project.id, bundle.quote.id);
    state.portalData = await api.getPortalData(state.sessionToken, bundle.project.id);
    showToast('Proposal approved. The sign step is now ready.', 'success');
    renderApp();
  } catch (error) {
    showToast(error.message, 'error');
    renderApp();
  }
}

async function handleSignQuote({ signerName, agreementAccepted, signatureData }) {
  const bundle = state.portalData?.currentProject;
  if (!bundle?.project?.id || !bundle?.quote?.id) return;
  if (!signerName.trim()) return showToast('Signer full name is required.', 'error');
  if (!agreementAccepted) return showToast('You must confirm the agreement before signing.', 'error');
  if (!signatureData || signatureData.length < 2000) return showToast('Please draw your signature before continuing.', 'error');

  state.quoteSigning = {
    ...state.quoteSigning,
    signerName,
    agreementAccepted,
    signatureData,
    submitting: true,
  };
  renderApp();

  try {
    const response = await api.signQuote(state.sessionToken, {
      projectId: bundle.project.id,
      quoteId: bundle.quote.id,
      signerName,
      agreementAccepted,
      signatureData,
    });
    state.portalData = await api.getPortalData(state.sessionToken, bundle.project.id);
    state.quoteSigning = {
      projectId: bundle.project.id,
      signerName: '',
      agreementAccepted: false,
      signatureData: '',
      submitting: false,
    };
    showToast(`Quote signed on ${formatDate(response.signedAt)}.`, 'success');
    renderApp();
  } catch (error) {
    state.quoteSigning = {
      ...state.quoteSigning,
      submitting: false,
    };
    showToast(error.message, 'error');
    renderApp();
  }
}

async function handleSignContract({ signerName, consentText, signatureData }) {
  const bundle = state.portalData?.currentProject;
  if (!bundle?.project?.id || !bundle?.contract?.id) return;
  if (!signerName.trim()) return showToast('Signer name is required.', 'error');
  if (!signatureData || signatureData.length < 2000) return showToast('Please draw your signature before continuing.', 'error');
  try {
    await api.signContract(state.sessionToken, {
      projectId: bundle.project.id,
      contractId: bundle.contract.id,
      signerName,
      consentText,
      signatureData,
    });
    state.portalData = await api.getPortalData(state.sessionToken, bundle.project.id);
    showToast(`Contract signed on ${formatDate(new Date().toISOString())}.`, 'success');
    renderApp();
  } catch (error) {
    showToast(error.message, 'error');
    renderApp();
  }
}

function mountAdmin() {
  // ── Tab navigation ──────────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="set-admin-view"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.adminView = button.getAttribute('data-view') || 'overview';
      renderApp();
    });
  });

  // ── Project client select → auto-fill access phone ────────────────────────
  document.querySelector('[data-action="project-client-change"]')?.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const phone = selectedOption?.dataset?.phone || '';
    const accessPhoneInput = document.getElementById('project-access-phone');
    if (accessPhoneInput && !accessPhoneInput.value) accessPhoneInput.value = phone;
  });

  // ── Project city → auto-update project code ────────────────────────────────
  document.querySelector('[data-action="project-city-change"]')?.addEventListener('change', (e) => {
    const city = e.target.value;
    const allProjects = state.adminData?.projects || [];
    const prefix = city === 'Calgary' ? 'C' : 'E';
    const year = new Date().getFullYear();
    const existing = allProjects.filter((p) => p.project_code?.startsWith(prefix + String(year)));
    const nextNum = String(existing.length + 1).padStart(2, '0');
    const newCode = `${prefix}${year}-${nextNum}`;
    const codeInput = document.getElementById('project-code');
    const cityHidden = document.getElementById('project-city');
    if (codeInput) codeInput.value = newCode;
    if (cityHidden) cityHidden.value = city;
  });

  // ── Whitelist: select client → filter projects + auto-fill phone ────────────
  document.querySelector('[data-action="whitelist-client-change"]')?.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const clientId = e.target.value;
    const phone = selectedOption?.dataset?.phone || '';

    const phoneInput = document.getElementById('whitelist-phone');
    if (phoneInput) phoneInput.value = phone;

    const clientIdHidden = document.getElementById('whitelist-client-id');
    if (clientIdHidden) clientIdHidden.value = clientId;

    const projectSelect = document.getElementById('whitelist-project-id');
    if (projectSelect) {
      Array.from(projectSelect.querySelectorAll('option')).forEach((opt) => {
        if (!opt.value) return;
        opt.hidden = clientId ? opt.dataset.clientId !== clientId : false;
      });
      projectSelect.value = '';
    }
  });

  // ── Edit client modal ───────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="edit-client"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingClientId = button.getAttribute('data-client-id') || '';
      renderApp();
    });
  });

  document.querySelectorAll('[data-action="close-edit-client-modal"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingClientId = '';
      renderApp();
    });
  });

  document.querySelector('[data-action="update-client-profile"]')?.addEventListener('click', async () => {
    try {
      await api.updateClientProfile(state.sessionToken, {
        client_id: document.getElementById('edit-client-id').value,
        full_name: document.getElementById('edit-client-name').value,
        email: document.getElementById('edit-client-email').value,
        secondary_phone: document.getElementById('edit-client-secondary-phone').value,
        status: document.getElementById('edit-client-status').value,
        notes: document.getElementById('edit-client-notes').value,
      });
      state.adminData = await api.getAdminDashboard(state.sessionToken);
      state.editingClientId = '';
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // ── Save client ─────────────────────────────────────────────────────────────
  document.querySelector('[data-action="save-client"]')?.addEventListener('click', async () => {
    try {
      await api.upsertClient(state.sessionToken, {
        full_name: document.getElementById('client-name').value,
        email: document.getElementById('client-email').value,
        primary_phone: document.getElementById('client-phone').value,
        notes: document.getElementById('client-notes').value,
      });
      state.adminData = await api.getAdminDashboard(state.sessionToken);
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // ── Save project ────────────────────────────────────────────────────────────
  document.querySelector('[data-action="save-project"]')?.addEventListener('click', async () => {
    try {
      const pdfFile = document.getElementById('quote-pdf').files?.[0];
      if (!pdfFile) throw new Error('Upload the first quote PDF before saving the project.');

      const quotePdfDataUrl = await readFileAsDataUrl(pdfFile);
      const payload = {
        client_id: document.getElementById('project-client-id').value,
        project_code: document.getElementById('project-code').value,
        title: document.getElementById('project-title').value,
        summary: document.getElementById('project-summary').value,
        service_address: document.getElementById('service-address').value,
        city: document.getElementById('project-city').value,
        province: document.getElementById('project-province').value,
        postal_code: document.getElementById('project-postal').value,
        status: document.getElementById('project-status').value,
        quote_number: document.getElementById('quote-number').value,
        quotePdf: {
          dataUrl: quotePdfDataUrl,
          fileName: pdfFile.name,
        },
      };

      const result = await api.upsertProject(state.sessionToken, payload);

      // Grant portal access if phone provided
      const accessPhone = document.getElementById('project-access-phone')?.value?.trim();
      if (accessPhone && result.project?.id && result.project?.client_id) {
        try {
          await api.upsertWhitelist(state.sessionToken, {
            client_id: result.project.client_id,
            project_id: result.project.id,
            phone: accessPhone,
            expires_at: document.getElementById('project-access-expiry')?.value || null,
          });
          showToast('Project saved and portal access granted.', 'success');
        } catch {
          showToast('Project saved, but access grant failed — add manually in Access tab.', 'error', 6000);
        }
      } else {
        showToast('Project saved.', 'success');
      }

      state.adminData = await api.getAdminDashboard(state.sessionToken);
      window.location.hash = `#/admin/projects/${result.project.id}`;
      await loadRouteData();
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // ── Save whitelist ──────────────────────────────────────────────────────────
  document.querySelector('[data-action="save-whitelist"]')?.addEventListener('click', async () => {
    try {
      await api.upsertWhitelist(state.sessionToken, {
        client_id: document.getElementById('whitelist-client-id').value || null,
        project_id: document.getElementById('whitelist-project-id').value || null,
        phone: document.getElementById('whitelist-phone').value,
        expires_at: document.getElementById('whitelist-expiry').value || null,
      });
      state.adminData = await api.getAdminDashboard(state.sessionToken);
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // ── Archive project ─────────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="archive-project"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const projectId = button.getAttribute('data-project-id');
        await api.archiveProject(state.sessionToken, { projectId });
        state.adminData = await api.getAdminDashboard(state.sessionToken);
        showToast('Project archived.', 'success');
        renderApp();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });

  // ── Project filter ──────────────────────────────────────────────────────────
  document.getElementById('admin-project-filter')?.addEventListener('change', (event) => {
    state.adminProjectFilter = event.currentTarget.value || 'active';
    renderApp();
  });
}

function mountAdminProject() {
  // ── Tab navigation ──────────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="set-project-view"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.projectView = button.getAttribute('data-view') || 'overview';
      renderApp();
    });
  });

  // ── Archive project ─────────────────────────────────────────────────────────
  document.querySelector('[data-action="archive-project"]')?.addEventListener('click', async (event) => {
    try {
      const projectId = event.currentTarget.getAttribute('data-project-id');
      await api.archiveProject(state.sessionToken, { projectId });
      state.portalData = await api.getPortalData(state.sessionToken, projectId);
      showToast('Project archived.', 'success');
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.querySelector('[data-action="delete-project"]')?.addEventListener('click', async (event) => {
    try {
      const projectId = event.currentTarget.getAttribute('data-project-id');
      const confirmationText = window.prompt('Type DELETE to permanently remove this project. This only works for empty projects.');
      if (confirmationText === null) return;

      await api.deleteProject(state.sessionToken, { projectId, confirmationText });
      showToast('Project permanently deleted.', 'success');
      window.location.hash = '#/admin';
      state.portalData = null;
      state.adminData = await api.getAdminDashboard(state.sessionToken);
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.querySelector('[data-action="save-project-basics"]')?.addEventListener('click', async (event) => {
    try {
      const projectId = event.currentTarget.getAttribute('data-project-id');
      await api.updateProjectBasics(state.sessionToken, {
        projectId,
        title: document.getElementById('admin-project-title').value,
        summary: document.getElementById('admin-project-summary').value,
        status: document.getElementById('admin-project-status').value,
        phase_label: document.getElementById('admin-project-phase-label').value,
        service_address: document.getElementById('admin-project-service-address').value,
        city: document.getElementById('admin-project-city').value,
        province: document.getElementById('admin-project-province').value,
        postal_code: document.getElementById('admin-project-postal-code').value,
        internal_notes: document.getElementById('admin-project-internal-notes').value,
      });
      state.portalData = await api.getPortalData(state.sessionToken, projectId);
      showToast('Project basics updated.', 'success');
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.querySelector('[data-action="upload-quote-version"]')?.addEventListener('click', async (event) => {
    try {
      const projectId = event.currentTarget.getAttribute('data-project-id');
      const pdfFile = document.getElementById('admin-quote-pdf').files?.[0];
      if (!pdfFile) throw new Error('Select a quote PDF before uploading a revised version.');

      const quotePdfDataUrl = await readFileAsDataUrl(pdfFile);
      await api.addQuoteVersion(state.sessionToken, {
        projectId,
        quote_number: document.getElementById('admin-quote-number').value,
        quote_title: document.getElementById('admin-quote-title').value,
        quote_intro: document.getElementById('admin-quote-intro').value,
        quote_status: document.getElementById('admin-quote-status').value,
        makeCurrent: document.getElementById('admin-quote-make-current').checked,
        quotePdf: {
          dataUrl: quotePdfDataUrl,
          fileName: pdfFile.name,
        },
      });
      state.portalData = await api.getPortalData(state.sessionToken, projectId);
      showToast('Quote version uploaded.', 'success');
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.querySelectorAll('[data-action="set-current-quote"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const projectId = button.getAttribute('data-project-id');
        const quoteId = button.getAttribute('data-quote-id');
        await api.setCurrentQuote(state.sessionToken, { projectId, quoteId });
        state.portalData = await api.getPortalData(state.sessionToken, projectId);
        showToast('Current quote updated.', 'success');
        renderApp();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });

  document.querySelector('[data-action="upload-project-asset"]')?.addEventListener('click', async (event) => {
    try {
      const projectId = event.currentTarget.getAttribute('data-project-id');
      const assetFile = document.getElementById('admin-asset-file').files?.[0];
      if (!assetFile) throw new Error('Select a file before uploading a project asset.');

      const assetDataUrl = await readFileAsDataUrl(assetFile);
      await api.addProjectAsset(state.sessionToken, {
        projectId,
        title: document.getElementById('admin-asset-title').value,
        file_type: document.getElementById('admin-asset-type').value,
        sort_order: document.getElementById('admin-asset-sort-order').value,
        description: document.getElementById('admin-asset-description').value,
        is_client_visible: document.getElementById('admin-asset-client-visible').checked,
        assetFile: {
          dataUrl: assetDataUrl,
          fileName: assetFile.name,
        },
      });
      state.portalData = await api.getPortalData(state.sessionToken, projectId);
      showToast('Project asset uploaded.', 'success');
      renderApp();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

window.addEventListener('hashchange', async () => {
  state.projectView = 'overview';
  try {
    if (state.viewer) await loadRouteData();
  } catch (error) {
    showToast(error.message, 'error');
  }
  renderApp();
});

boot();
