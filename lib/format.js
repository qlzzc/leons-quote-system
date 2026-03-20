export function formatCurrency(value, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugPath(route) {
  return `#/${route}`;
}
