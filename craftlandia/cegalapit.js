// cegalapit.js

let currentStep = 1;
let selectedForma = null;

document.addEventListener('DOMContentLoaded', () => {
  // Auth check
  if (!isLoggedIn()) {
    document.getElementById('auth-gate').classList.remove('hidden');
    document.getElementById('form-container').classList.add('opacity-40', 'pointer-events-none');
  } else {
    // Pre-fill discord id
    const session = getSession();
    if (session?.user) {
      const el = document.getElementById('alapito-discord');
      if (el) el.value = session.user.username || session.user.id;
      const nev = document.getElementById('alapito-nev');
      if (nev) nev.value = session.user.global_name || session.user.username || '';
    }
  }

  document.getElementById('tearor')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('tearor-egyeb-wrap');
    if (wrap) wrap.classList.toggle('hidden', e.target.value !== 'egyeb');
  });
});

function selectForma(el, value) {
  document.querySelectorAll('.forma-option').forEach(o => {
    o.classList.remove('border-[#1a1a18]', 'bg-[#1a1a18]/02');
    o.querySelector('.forma-check').innerHTML = '';
  });
  el.classList.add('border-[#1a1a18]', 'bg-[#1a1a18]/02');
  el.querySelector('.forma-check').innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
  selectedForma = value;
  document.getElementById('tarsasagi-forma').value = value;
}

function nextStep(n) {
  if (!validateStep(currentStep)) return;
  goToStep(n);
  if (n === 4) buildSummary();
}

function prevStep(n) { goToStep(n); }

function goToStep(n) {
  document.getElementById(`step-${currentStep}`).classList.add('hidden');
  document.getElementById(`step-${n}`).classList.remove('hidden');

  // Update dots
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`step-${i}-dot`);
    dot.classList.remove('active', 'done');
    if (i < n) dot.classList.add('done');
    else if (i === n) dot.classList.add('active');
  }
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const nev = document.getElementById('ceg-nev').value.trim();
    const alapito = document.getElementById('alapito-nev').value.trim();
    const tearor = document.getElementById('tearor').value;
    const alaptoke = document.getElementById('alaptoke').value;
    if (!nev) { showToast('Adja meg a vállalkozás nevét!'); return false; }
    if (!alapito) { showToast('Adja meg az alapító nevét!'); return false; }
    if (!tearor) { showToast('Válasszon tevékenységi kört!'); return false; }
    if (!alaptoke || Number(alaptoke) < 0) { showToast('Adja meg az alaptőkét!'); return false; }
  }
  if (step === 2) {
    if (!selectedForma) { showToast('Válasszon társasági formát!'); return false; }
    // Alaptőke min check
    const alaptoke = Number(document.getElementById('alaptoke').value);
    if (selectedForma === 'kft' && alaptoke < 64) { showToast('Kft. esetén minimális alaptőke 64 KF!'); return false; }
    if (selectedForma === 'rt' && alaptoke < 100) { showToast('Rt. esetén minimális alaptőke 100 KF!'); return false; }
    if (selectedForma === 'bt' && alaptoke < 1) { showToast('Bt. esetén minimális alaptőke 1 KF!'); return false; }
  }
  if (step === 3) {
    const tel = document.getElementById('telepules').value;
    const utca = document.getElementById('utca').value.trim();
    const irsz = document.getElementById('irsz').value.trim();
    if (!tel) { showToast('Válasszon települést!'); return false; }
    if (!utca) { showToast('Adja meg az utca, házszám adatokat!'); return false; }
    if (!irsz) { showToast('Adja meg az irányítószámot!'); return false; }
  }
  return true;
}

const FORMA_LABELS = { bt: 'Betéti Társaság (Bt.)', kft: 'Korlátolt Felelősségű Társaság (Kft.)', rt: 'Részvénytársaság (Rt.)', ev: 'Egyéni Vállalkozás (Ev.)' };
const TELEPULES_LABELS = { 
  bazsi_city: 'Bazsi City', 
  vasfalu: 'Vasfalu', 
  palotas: 'Palotás', 
  rozsaváros: 'Rózsaváros' 
};

function buildSummary() {
  const rows = [
    ['Vállalkozás neve', document.getElementById('ceg-nev').value],
    ['Alapító', document.getElementById('alapito-nev').value],
    ['Társasági forma', FORMA_LABELS[selectedForma] || selectedForma],
    ['Alaptőke', Number(document.getElementById('alaptoke').value).toLocaleString('hu-HU') + ' KF'],
    ['Székhely', `${TELEPULES_LABELS[document.getElementById('telepules').value] || ''}, ${document.getElementById('utca').value}`],
    ['Irányítószám', document.getElementById('irsz').value],
  ];
  document.getElementById('summary-content').innerHTML = rows.map(([k, v]) => `
    <div class="flex items-start justify-between py-3 border-b border-[#1a1a18]/08 last:border-0">
      <span class="font-mono text-xs text-[#1a1a18]/45 uppercase tracking-wide w-40 flex-shrink-0">${k}</span>
      <span class="text-sm font-medium text-right">${v || '—'}</span>
    </div>
  `).join('');
}

async function submitForm() {
  if (!document.getElementById('nyilatkozat').checked) {
    showToast('Kérjük, fogadja el a nyilatkozatot!');
    return;
  }
  if (!isLoggedIn()) { handleDiscordLogin(); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Benyújtás...';

  const payload = {
    ceg_nev: document.getElementById('ceg-nev').value,
    alapito_nev: document.getElementById('alapito-nev').value,
    tarsasagi_forma: selectedForma,
    alaptoke: Number(document.getElementById('alaptoke').value),
    tearor: document.getElementById('tearor').value,
    telepules: document.getElementById('telepules').value,
    utca: document.getElementById('utca').value,
    irsz: document.getElementById('irsz').value,
    emelet: document.getElementById('emelet').value,
    megjegyzes: document.getElementById('megjegyzes').value,
  };

  try {
    const res = await apiCall('/ceg/alapit', { method: 'POST', body: JSON.stringify(payload) });
    if (res && !res.error) {
      const ugyNum = res.ugy_szam;
      document.getElementById(`step-${currentStep}`).classList.add('hidden');
      document.getElementById('success-panel').classList.remove('hidden');
      document.getElementById('ugy-szam').textContent = ugyNum;
      // Mark steps done
      for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`step-${i}-dot`);
        dot.classList.remove('active');
        dot.classList.add('done');
      }
    } else {
      showToast('Hiba: ' + (res?.error || 'Nem sikerült a mentés.'));
      btn.disabled = false;
      btn.textContent = 'Benyújtás';
    }
  } catch (e) {
    showToast('Hálózati hiba: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Benyújtás';
  }
}