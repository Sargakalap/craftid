// tamogatas.js – Támogatási pályázatok kezelése
// Backend: Cloudflare Workers + D1

document.addEventListener('DOMContentLoaded', async () => {
  if (isLoggedIn()) {
    await loadMyCompanies();
    await loadMyApplications();
  } else {
    // Ha nincs belépve, elrejtjük a pályázati részt vagy mutatjuk a login figyelmeztetést
    const applyContainer = document.getElementById('eu-apply-container');
    if (applyContainer) applyContainer.classList.add('opacity-50', 'pointer-events-none');
  }
});

async function loadMyCompanies() {
  try {
    const data = await apiCall('/my-companies');
    const select = document.getElementById('ceg_id');
    if (!select) return;

    if (data && data.companies && data.companies.length > 0) {
      select.innerHTML = '<option value="">Válasszon vállalkozást...</option>' + 
        data.companies.map(c => `<option value="${c.id}">${c.ceg_nev} (${c.ugy_szam})</option>`).join('');
    } else {
      select.innerHTML = '<option value="">Nincs jóváhagyott vállalkozása</option>';
      document.getElementById('submit-btn').disabled = true;
    }
  } catch (err) {
    console.error('Cégek betöltése hiba:', err);
  }
}

async function handleGrantSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Feldolgozás...';

  const payload = {
    ceg_id: parseInt(document.getElementById('ceg_id').value),
    project_name: document.getElementById('project_name').value,
    amount: parseFloat(document.getElementById('amount').value),
    description: document.getElementById('description').value
  };

  if (!payload.ceg_id) {
    showToast('Kérjük, válasszon ki egy vállalkozást!');
    btn.disabled = false;
    btn.textContent = 'Pályázat benyújtása';
    return;
  }

  try {
    const res = await apiCall('/eu/apply', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res && res.ugy_szam) {
      showToast(`Pályázat sikeresen benyújtva! Ügyiratszám: ${res.ugy_szam}`);
      document.getElementById('grant-form').reset();
      await loadMyApplications();
    }
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Pályázat benyújtása';
  }
}

async function loadMyApplications() {
  try {
    const data = await apiCall('/eu/my-applications');
    const container = document.getElementById('my-applications-list');
    if (!container) return;

    if (data && data.applications && data.applications.length > 0) {
      document.getElementById('my-apps-section').classList.remove('hidden');
      container.innerHTML = data.applications.map(a => `
        <div class="bg-white border border-[#1a1a18]/10 p-5 shadow-sm">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="font-mono text-[10px] text-[#1a1a18]/40 uppercase">${a.ugy_szam}</div>
              <div class="font-garamond text-lg font-medium">${a.project_name}</div>
              <div class="text-xs text-blue-800 font-medium">${a.ceg_nev}</div>
            </div>
            <span class="badge ${a.status === 'approved' ? 'badge-approved' : a.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}">
              ${a.status === 'approved' ? 'Jóváhagyva' : a.status === 'rejected' ? 'Elutasítva' : 'Folyamatban'}
            </span>
          </div>
          <div class="flex justify-between items-end">
            <div class="font-mono text-sm font-medium">${a.amount} KF</div>
            <div class="text-right">
               <div class="font-mono text-[10px] text-[#1a1a18]/40 mb-1">Haladás: ${a.progress}%</div>
               <div class="w-24 h-1 bg-[#1a1a18]/5 rounded-full overflow-hidden">
                 <div class="h-full bg-blue-600" style="width: ${a.progress}%"></div>
               </div>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Pályázatok betöltése hiba:', err);
  }
}
