// main.js – Craftlandia Ügyfélkapu főoldal logika

document.addEventListener('DOMContentLoaded', async () => {
  loadStats();
  if (isLoggedIn()) {
    loadUnreadCount();
  }
});

async function loadUnreadCount() {
  try {
    const res = await apiCall('/uzenetek');
    if (res && Array.isArray(res.messages)) {
      const unread = res.messages.filter(m => !m.read).length;
      const badge = document.getElementById('msg-badge');
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    }
  } catch (e) {}
}

// ─── Publikus statisztikák ────────────────────────────────
async function loadStats() {
  // Demo/fallback adatok – valóságban publicApiCall('/stats')
  const stats = await fetchStats();
  animateCount('stat-ceged', stats.companies, '');
  animateCount('stat-polgar', stats.citizens, '');
  animateCount('stat-eu', stats.eu_funds, ' KF');
  animateCount('stat-ugy', stats.cases_handled, '');
}

async function fetchStats() {
  try {
    const data = await publicApiCall('/stats');
    if (data && !data.error) return data;
  } catch (_) {}
  // Mock fallback
  return { companies: 142, citizens: 1287, eu_funds: 4850000, cases_handled: 3941 };
}

function animateCount(id, target, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1200;
  const start = Date.now();
  const formatted = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return Math.round(n).toString();
  };
  const tick = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatted(target * ease) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatted(target) + suffix;
  };
  requestAnimationFrame(tick);
}

// ─── Admin Funkciók ───────────────────────────────────────
async function submitCandidate() {
  const discord_id = document.getElementById('admin-cand-discord').value;
  const name = document.getElementById('admin-cand-name').value;
  const party = document.getElementById('admin-cand-party').value;

  if (!discord_id || !name) {
    showToast('Discord ID és Név megadása kötelező.');
    return;
  }

  try {
    const res = await apiCall('/admin/candidate', {
      method: 'POST',
      body: JSON.stringify({ discord_id, name, party })
    });

    if (res && !res.error) {
      showToast('Jelölt sikeresen rögzítve.');
      document.getElementById('admin-cand-discord').value = '';
      document.getElementById('admin-cand-name').value = '';
      document.getElementById('admin-cand-party').value = '';
    } else {
      showToast('Hiba: ' + (res?.error || 'Ismeretlen hiba'));
    }
  } catch (e) {
    showToast('Hiba a küldés során.');
  }
}

async function injectFunds() {
  const amount = parseFloat(document.getElementById('admin-fund-amount').value);
  const source = document.getElementById('admin-fund-source').value;
  const reason = document.getElementById('admin-fund-reason').value;

  if (isNaN(amount) || amount <= 0 || !source) {
    showToast('Érvényes összeg és forrás megadása kötelező.');
    return;
  }

  try {
    const res = await apiCall('/admin/inject-funds', {
      method: 'POST',
      body: JSON.stringify({ amount, source, reason })
    });

    if (res && !res.error) {
      showToast('Forrás sikeresen lehívva és jóváírva.');
      loadStats();
      document.getElementById('admin-fund-amount').value = '';
      document.getElementById('admin-fund-source').value = '';
      document.getElementById('admin-fund-reason').value = '';
    } else {
      showToast('Hiba: ' + (res?.error || 'Ismeretlen hiba'));
    }
  } catch (e) {
    showToast('Hiba a küldés során.');
  }
}