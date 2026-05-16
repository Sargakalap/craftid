// okmanyok.js

const OKMANY_DATA = {
  szemelyi:  { label: 'Személyi igazolvány', dij: 500 },
  lakcim:    { label: 'Lakcímkártya', dij: 200 },
  utlevel:   { label: 'Útlevél', dij: 2000 },
  adoig:     { label: 'Adóigazolás', dij: 300 },
  anyakönyv: { label: 'Anyakönyvi kivonat', dij: 400 },
  erkölcsi:  { label: 'Erkölcsi bizonyítvány', dij: 1000 },
};

let selectedType = null;

document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  document.getElementById('ok-kezb')?.addEventListener('change', updateDij);
});

function selectOkmany(type, el) {
  if (!isLoggedIn()) { requireAuth('okmanyok.html'); return; }

  selectedType = type;
  document.querySelectorAll('.okmany-card').forEach(c => c.classList.remove('border-[#1a1a18]', 'bg-[#1a1a18]/02'));
  el.classList.add('border-[#1a1a18]', 'bg-[#1a1a18]/02');

  const data = OKMANY_DATA[type];
  document.getElementById('form-title').textContent = data.label + ' – Kérelem';
  document.getElementById('okmany-form').classList.remove('hidden');
  document.getElementById('ok-success').classList.add('hidden');
  updateDij();

  document.getElementById('okmany-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateDij() {
  if (!selectedType) return;
  const base = OKMANY_DATA[selectedType].dij;
  const posta = document.getElementById('ok-kezb').value === 'posta' ? 100 : 0;
  document.getElementById('ok-dij').textContent = (base + posta).toLocaleString('hu-HU') + ' KF';
  document.getElementById('ok-cim-wrap').style.display = posta ? 'block' : 'none';
}

function cancelOkmany() {
  selectedType = null;
  document.getElementById('okmany-form').classList.add('hidden');
  document.querySelectorAll('.okmany-card').forEach(c => c.classList.remove('border-[#1a1a18]', 'bg-[#1a1a18]/02'));
}

async function submitOkmany() {
  if (!isLoggedIn()) { handleDiscordLogin(); return; }
  if (!selectedType) return;
  if (!document.getElementById('ok-nyilatkozat').checked) { showToast('Kérjük, fogadja el a nyilatkozatot!'); return; }
  if (!document.getElementById('ok-nev').value.trim()) { showToast('Adja meg a nevét!'); return; }
  if (!document.getElementById('ok-szuldat').value) { showToast('Adja meg a születési dátumot!'); return; }

  const btn = document.getElementById('ok-submit');
  btn.disabled = true; btn.textContent = 'Benyújtás...';

  try {
    const res = await apiCall('/okmany/igenyel', {
      method: 'POST',
      body: JSON.stringify({ tipus: selectedType, nev: document.getElementById('ok-nev').value })
    });
    if (res && !res.error) {
      document.getElementById('okmany-form').classList.add('hidden');
      document.getElementById('ok-success').classList.remove('hidden');
      document.getElementById('ok-ugy').textContent = res.ugy_szam;
    } else {
      showToast('Hiba: ' + (res?.error || 'Nem sikerült a mentés.'));
      btn.disabled = false; btn.textContent = 'Benyújtás';
    }
  } catch (e) {
    showToast('Hálózati hiba: ' + e.message);
    btn.disabled = false; btn.textContent = 'Benyújtás';
  }
}