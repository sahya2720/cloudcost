/* ═══════════════════════════════════════════════════
   OptiCloud API Service — /services/api.js
   All backend communication centralised here.
   Base URL: http://localhost:8000
   ═══════════════════════════════════════════════════ */

const BASE = import.meta.env.VITE_API_URL || 'https://cloudcost-1.onrender.com';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) { /* ignore parse error */ }
    throw new Error(detail);
  }
  return res.json();
}

/* ── POST /api/upload ──────────────────────────────── */
export async function uploadCSV(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request('/api/upload', { method: 'POST', body: fd });
}

/* ── POST /api/process ─────────────────────────────── */
export async function processData() {
  return request('/api/process', { method: 'POST' });
}

/* ── GET /api/dashboard ────────────────────────────── */
export async function fetchDashboard() {
  return request('/api/dashboard');
}

/* ── GET /api/recommendations ──────────────────────── */
export async function fetchRecommendations() {
  return request('/api/recommendations');
}

/* ── GET /api/resources ────────────────────────────── */
export async function fetchResources() {
  return request('/api/resources');
}

/* ── GET /health ───────────────────────────────────── */
export async function checkHealth() {
  return request('/health');
}

/* ── GET /api/anomalies ────────────────────────────── */
export async function fetchAnomalies() {
  return request('/api/anomalies');
}

/* ── GET /api/cost-overview ────────────────────────── */
export async function fetchCostOverview() {
  return request('/api/cost-overview');
}

/* ── GET /api/report ───────────────────────────────── */
export async function fetchReport() {
  return request('/api/report');
}

/* ── POST /api/logout ──────────────────────────────── */
export async function postLogout() {
  return request('/api/logout', { method: 'POST' });
}
