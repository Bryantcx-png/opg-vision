// ─── CONFIG ───────────────────────────────────────────────
const API_BASE = 'http://localhost/dentage-ai/backend'; // XAMPP

// ─── TOKEN STORAGE ────────────────────────────────────────
function saveSession(token, user) {
  localStorage.setItem('opg_token', token);
  localStorage.setItem('opg_user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('opg_token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('opg_user') || 'null');
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('opg_token');
  localStorage.removeItem('opg_user');
}

function isLoggedIn() {
  return !!getToken();
}

// ─── AUTH HEADERS ─────────────────────────────────────────
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── GUARDS ───────────────────────────────────────────────
// Call at top of protected pages (dashboard, analyse)
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

const PAID_PLANS = ['starter', 'pro', 'professional', 'enterprise'];

// Call after requireAuth() on dashboard/analyse to enforce plan selection
function requirePlan() {
  const user = getUser();
  if (!user || !PAID_PLANS.includes(user.plan)) {
    window.location.href = 'pricing.html?upgrade=1';
    return false;
  }
  return true;
}

// Call at top of auth pages (login, register) to skip if already logged in
function redirectIfAuth(dest = 'dashboard.html') {
  if (isLoggedIn()) {
    window.location.href = dest;
    return true;
  }
  return false;
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

// ─── API HELPERS ──────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path + '.php', {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = 'login.html';
    return null;
  }
  return res;
}

// ─── POPULATE USER UI ─────────────────────────────────────
// Call after requireAuth() on protected pages to fill in name/email from stored session
function populateUserUI() {
  const user = getUser();
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name || '—'; });
  document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = user.email || '—'; });
  document.querySelectorAll('[data-user-plan]').forEach(el => { el.textContent = user.plan || 'free'; });
  document.querySelectorAll('[data-user-initials]').forEach(el => {
    el.textContent = (user.name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  });
}
