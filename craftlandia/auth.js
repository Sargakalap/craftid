// auth.js – Craftlandia Discord OAuth + session management
// Backend: Cloudflare Workers + D1

const API_BASE = (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.endsWith('.local')
)
  ? 'http://localhost:8787/api'
  : 'https://ugyfelkapu.craftlandia.gov/api';


// ─── Session ───────────────────────────────────────────────
function getSession() {
  try {
    const s = localStorage.getItem('cl_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function setSession(data) {
  localStorage.setItem('cl_session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('cl_session');
  localStorage.removeItem('cl_pending_redirect');
}

function isLoggedIn() {
  const s = getSession();
  if (!s || !s.token || !s.expires_at) return false;
  return Date.now() < s.expires_at;
}

// ─── Discord OAuth Flow ────────────────────────────────────
function handleDiscordLogin() {
  // Save where user wanted to go
  const redirect = localStorage.getItem('cl_pending_redirect') || window.location.pathname;
  localStorage.setItem('cl_pending_redirect', redirect);

  // Dynamic redirect URI based on environment
  const currentRedirectUri = (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.endsWith('.local')
  )
    ? 'http://localhost:8787/api/auth/discord/callback'
    : 'https://craftlandia-ugyfelkapu.koalabalazsnemeth.workers.dev/api/auth/discord/callback';

  // Discord OAuth2 params – redirect to Worker which handles token exchange
  const params = new URLSearchParams({
    client_id: '1246462744870256731', 
    redirect_uri: currentRedirectUri,
    response_type: 'code',
    scope: 'identify email',
    state: generateState(),
  });

  const oauthUrl = `https://discord.com/api/oauth2/authorize?${params}`;
  console.log('Redirecting to Discord OAuth:', oauthUrl);
  
  window.location.href = oauthUrl;
}

function generateState() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('cl_oauth_state', state);
  return state;
}

function handleLogout() {
  clearSession();
  updateAuthUI();
  showToast('Sikeresen kijelentkezve.');
  setTimeout(() => window.location.href = 'index.html', 800);
}

// ─── Called after OAuth callback redirects back ────────────
function handleOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const userParam = params.get('user');

  if (token && userParam) {
    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      setSession({
        token,
        user,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      window.history.replaceState({}, '', window.location.pathname);
      const redirect = localStorage.getItem('cl_pending_redirect') || 'index.html';
      localStorage.removeItem('cl_pending_redirect');
      window.location.href = redirect;
    } catch (e) {
      console.error('OAuth return parse error', e);
    }
  }
}

// ─── API helper (authenticated) ────────────────────────────
async function apiCall(endpoint, options = {}) {
  const session = getSession();
  if (!session?.token) throw new Error('Nincs bejelentkezve');

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    updateAuthUI();
    showToast('Munkamenet lejárt. Kérjük, jelentkezzen be újra.');
    return null;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Szerverhiba: ${res.status}`);
  }

  return res.json();
}

// ─── Public API (no auth) ──────────────────────────────────
async function publicApiCall(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res.json();
}

// ─── UI helpers ────────────────────────────────────────────
function updateAuthUI() {
  const session = getSession();
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const loginNotice = document.getElementById('login-notice');
  const authGate = document.getElementById('auth-gate');
  const msgContainer = document.getElementById('messages-container');

  if (isLoggedIn() && session?.user) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userInfo) {
      userInfo.classList.remove('hidden');
      userInfo.classList.add('flex');
      const avatar = document.getElementById('user-avatar');
      const name = document.getElementById('user-name');
      if (avatar) {
        const u = session.user;
        avatar.src = u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(u.discriminator || '0') % 5}.png`;
      }
      if (name) name.textContent = session.user.global_name || session.user.username;
    }
    if (loginNotice) loginNotice.classList.add('hidden');
    
    // Üzenetek oldal speciális kezelése
    if (authGate) authGate.classList.add('hidden');
    if (msgContainer) msgContainer.classList.remove('hidden');

    // Show admin section if PM/Admin
    const adminSection = document.getElementById('admin-section');
    if (adminSection && (session.user.role === 'pm' || session.user.role === 'admin')) {
      adminSection.classList.remove('hidden');
    }
    
    // CSAK az üzenetek oldalon indítjuk el a betöltést
    if (window.location.pathname.includes('uzenetek.html')) {
      if (typeof initMessages === 'function') initMessages();
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userInfo) { userInfo.classList.add('hidden'); userInfo.classList.remove('flex'); }
    if (loginNotice) loginNotice.classList.remove('hidden');
    
    // Üzenetek oldal speciális kezelése kijelentkezve
    if (authGate) authGate.classList.remove('hidden');
    if (msgContainer) msgContainer.classList.add('hidden');
  }
}

function requireAuth(redirect) {
  if (isLoggedIn()) {
    window.location.href = redirect;
  } else {
    localStorage.setItem('cl_pending_redirect', redirect);
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
  }
}

function closeModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

// ─── Toast ─────────────────────────────────────────────────
function showToast(msg, duration = 3500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  handleOAuthReturn();
  updateAuthUI();

  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
});