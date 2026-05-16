// adobevaltas.js

document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  kalkulal();
});

function updateBevallasTipus() {
  const t = document.getElementById('bev-tipus').value;
  document.getElementById('negyed-wrap').classList.toggle('hidden', t !== 'negyed');
  document.getElementById('ho-wrap').classList.toggle('hidden', t !== 'ho');
}

function kalkulal() {
  const bevetel = parseFloat(document.getElementById('bevetel').value) || 0;
  const koltseg = parseFloat(document.getElementById('koltseg').value) || 0;
  const levon = parseFloat(document.getElementById('levon').value) || 0;
  const kedv = parseFloat(document.getElementById('kedv').value) || 0;

  const adoalap = Math.max(0, bevetel - koltseg - levon);
  const kulcs = adoalap > 500000 ? 0.20 : adoalap > 100000 ? 0.18 : 0.15;
  const szamitott = adoalap * kulcs;
  const fizetendo = Math.max(0, szamitott - kedv);

  const fmt = n => Math.round(n).toLocaleString('hu-HU') + ' KF';

  document.getElementById('calc-adoalap').textContent = fmt(adoalap);
  document.getElementById('calc-kulcs').textContent = (kulcs * 100).toFixed(0) + '%';
  document.getElementById('calc-szamitott').textContent = fmt(szamitott);
  document.getElementById('calc-kedv').textContent = '− ' + fmt(kedv);
  document.getElementById('calc-fizetendo').textContent = fmt(fizetendo);
}

function showFile(input) {
  const el = document.getElementById('file-name');
  if (input.files[0]) {
    el.textContent = '📎 ' + input.files[0].name;
    el.classList.remove('hidden');
  }
}

async function submitBevallas() {
  if (!isLoggedIn()) { handleDiscordLogin(); return; }
  if (!document.getElementById('ado-nyilatkozat').checked) {
    showToast('Kérjük, fogadja el a nyilatkozatot!'); return;
  }
  if (!document.getElementById('adoszam').value.trim()) {
    showToast('Adja meg az adóazonosítóját!'); return;
  }
  if (!document.getElementById('bevetel').value) {
    showToast('Adja meg az összes bevételt!'); return;
  }

  const btn = document.getElementById('bev-submit');
  btn.disabled = true; btn.textContent = 'Benyújtás...';

  try {
    const res = await apiCall('/ado/bevallas', {
      method: 'POST',
      body: JSON.stringify({
        tipus: document.getElementById('bev-tipus').value,
        adoev: document.getElementById('adoev').value,
        adoszam: document.getElementById('adoszam').value,
        bevetel: parseFloat(document.getElementById('bevetel').value) || 0,
        koltseg: parseFloat(document.getElementById('koltseg').value) || 0,
      })
    });
    if (res && !res.error) {
      showSuccess(res.hivatkozas);
    } else {
      showToast('Hiba: ' + (res?.error || 'Nem sikerült a mentés.'));
      btn.disabled = false; btn.textContent = 'Benyújtás';
    }
  } catch (e) {
    showToast('Hálózati hiba: ' + e.message);
    btn.disabled = false; btn.textContent = 'Benyújtás';
  }
}

function showSuccess(ref) {
  document.querySelectorAll('main > div:not(#bev-success)').forEach(el => el.classList.add('hidden'));
  document.getElementById('bev-success').classList.remove('hidden');
  document.getElementById('bev-ref').textContent = ref;
}

async function saveDraft() {
  showToast('Piszkozat elmentve.');
}