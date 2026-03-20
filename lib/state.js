import { STORAGE_KEY } from './config.js';
export const state = {
  sessionToken: '',
  viewer: null,
  portalData: null,
  adminData: null,
  adminProjectFilter: 'active',
  adminView: 'overview',
  projectView: 'overview',
  editingClientId: '',
  pendingPhone: '',
  otpCode: '',
  otpSent: false,
  quoteSigning: {
    projectId: '',
    signerName: '',
    agreementAccepted: false,
    signatureData: '',
    submitting: false,
  },
  message: '',
  error: '',
  loading: false,
};
export function setSessionToken(token) {
  state.sessionToken = token || '';
  if (state.sessionToken) localStorage.setItem(STORAGE_KEY, state.sessionToken);
  else localStorage.removeItem(STORAGE_KEY);
}
export function restoreSessionToken() {
  state.sessionToken = localStorage.getItem(STORAGE_KEY) || '';
  return state.sessionToken;
}
export function clearSession() {
  state.viewer = null;
  state.portalData = null;
  state.adminData = null;
  state.adminProjectFilter = 'active';
  state.adminView = 'overview';
  state.projectView = 'overview';
  state.editingClientId = '';
  state.pendingPhone = '';
  state.otpCode = '';
  state.otpSent = false;
  state.quoteSigning = {
    projectId: '',
    signerName: '',
    agreementAccepted: false,
    signatureData: '',
    submitting: false,
  };
  state.message = '';
  state.error = '';
  setSessionToken('');
}
export function setFeedback({ message = '', error = '' } = {}) {
  state.message = message;
  state.error = error;
}
export function parseRoute(hash = window.location.hash) {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return { name: 'portal-home' };
  const parts = clean.split('/');
  if (parts[0] === 'admin' && parts[1] === 'projects' && parts[2]) {
    return { name: 'admin-project', projectId: parts[2] };
  }
  if (parts[0] === 'admin') return { name: 'admin' };
  if (parts[0] === 'projects' && parts[1] && parts[2] === 'quote') return { name: 'quote', projectId: parts[1] };
  if (parts[0] === 'projects' && parts[1] && parts[2] === 'contract') return { name: 'contract', projectId: parts[1] };
  if (parts[0] === 'projects' && parts[1]) return { name: 'project', projectId: parts[1] };
  return { name: 'portal-home' };
}
