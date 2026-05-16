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

const MOCK_FOUNDATIONS = [
  { name: 'Craftlandiai Macskamentők Alapítvány', tax_id: '18273645-1-42' },
  { name: 'InternetÉRT Alapítvány', tax_id: '12105943-2-12' },
  { name: 'Digitális Jövőért Egyesület', tax_id: '11223344-1-01' },
  { name: 'Zöld Világ Alapítvány', tax_id: '99887766-2-05' },
  { name: 'Craftlandia Kultúrájáért Alapítvány', tax_id: '55667788-1-11' },
  { name: 'Segítő Kéz Alapítvány', tax_id: '33445566-1-20' }
];

function searchFoundation(query) {
  const resultsDiv = document.getElementById('foundation-results');
  if (!query || query.length < 2) {
    resultsDiv.classList.add('hidden');
    return;
  }

  const filtered = MOCK_FOUNDATIONS.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
  
  if (filtered.length > 0) {
    resultsDiv.innerHTML = filtered.map(f => `
      <div onclick="selectFoundation('${f.name}', '${f.tax_id}')" class="p-3 hover:bg-blue-50 cursor-pointer border-b border-[#1a1a18]/05 last:border-0">
        <div class="font-medium text-sm">${f.name}</div>
        <div class="font-mono text-[10px] text-[#1a1a18]/40">${f.tax_id}</div>
      </div>
    `).join('');
    resultsDiv.classList.remove('hidden');
  } else {
    resultsDiv.innerHTML = '<div class="p-4 text-xs text-[#1a1a18]/40 text-center font-mono italic">Nincs találat.</div>';
    resultsDiv.classList.remove('hidden');
  }
}

function selectFoundation(name, taxId) {
  document.getElementById('ado1-nev').value = name;
  document.getElementById('ado1-adoszam').value = taxId;
  document.getElementById('foundation-search').value = name;
  document.getElementById('foundation-results').classList.add('hidden');
}

// Close results on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#foundation-search')) {
    document.getElementById('foundation-results')?.classList.add('hidden');
  }
});

async function saveDraft() {
  showToast('Piszkozat elmentve.');
}