import { API } from './config.js';

async function request(url, { method = 'GET', body, token } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  sendOtp: (phone) => request(API.sendOtp, { method: 'POST', body: { phone } }),
  verifyOtp: (phone, code) => request(API.verifyOtp, { method: 'POST', body: { phone, code } }),
  getSession: (token) => request(API.portalSession, { token }),
  getPortalData: (token, projectId = '') => request(`${API.portalData}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`, { token }),
  approveQuote: (token, projectId, quoteId) => request(API.approveQuote, { method: 'POST', token, body: { projectId, quoteId } }),
  signQuote: (token, payload) => request(API.signQuote, { method: 'POST', token, body: payload }),
  signContract: (token, payload) => request(API.signContract, { method: 'POST', token, body: payload }),
  logAccess: (token, payload) => request(API.logAccess, { method: 'POST', token, body: payload }),
  getAdminDashboard: (token) => request(API.adminDashboard, { token }),
  upsertClient: (token, payload) => request(API.upsertClient, { method: 'POST', token, body: payload }),
  updateClientProfile: (token, payload) => request(API.updateClientProfile, { method: 'POST', token, body: payload }),
  upsertProject: (token, payload) => request(API.upsertProject, { method: 'POST', token, body: payload }),
  updateProjectBasics: (token, payload) => request(API.updateProjectBasics, { method: 'POST', token, body: payload }),
  addQuoteVersion: (token, payload) => request(API.addQuoteVersion, { method: 'POST', token, body: payload }),
  setCurrentQuote: (token, payload) => request(API.setCurrentQuote, { method: 'POST', token, body: payload }),
  addProjectAsset: (token, payload) => request(API.addProjectAsset, { method: 'POST', token, body: payload }),
  archiveProject: (token, payload) => request(API.archiveProject, { method: 'POST', token, body: payload }),
  deleteProject: (token, payload) => request(API.deleteProject, { method: 'POST', token, body: payload }),
  upsertWhitelist: (token, payload) => request(API.upsertWhitelist, { method: 'POST', token, body: payload }),
};
