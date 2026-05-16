// eu-forrasok.js – EU forráskövetés oldal logikája

const MOCK_PROJECTS = [
  { id: 'EU-2025-001', name: 'Bazsi City Főtér Felújítás', municipality: 'Bazsi City', category: 'infrastructure', amount: 85.5, status: 'paid', date: '2025-03-15', desc: 'A főtér teljes infrastrukturális megújítása és sétálóövezet kialakítása.', progress: 100 },
  { id: 'EU-2025-002', name: 'Vasfalu Általános Iskola Bővítés', municipality: 'Vasfalu', category: 'education', amount: 120.0, status: 'paid', date: '2025-04-01', desc: '8 új tanterem és sportcsarnok építése az általános iskola mellé.', progress: 100 },
  { id: 'EU-2025-003', name: 'Zöld Energia Program – Napelemes Park', municipality: 'Bazsi City', category: 'environment', amount: 240.0, status: 'processing', date: '2025-06-20', desc: '500 kW kapacitású napelemes kiserőmű létesítése a város szélén.', progress: 65 },
  { id: 'EU-2025-004', name: 'Helyi Piac Fejlesztés', municipality: 'Palotás', category: 'economy', amount: 45.2, status: 'approved', date: '2025-07-10', desc: 'A heti piac területének lefedése és modern árusítóhelyek kialakítása.', progress: 20 },
  { id: 'EU-2025-005', name: 'Egészségügyi Centrum Modernizáció', municipality: 'Rózsaváros', category: 'health', amount: 180.0, status: 'processing', date: '2025-05-05', desc: 'Modern alapellátási centrum és sürgősségi pont kialakítása.', progress: 48 },
  { id: 'EU-2025-006', name: 'Kerékpárút Hálózat Kiépítés', municipality: 'Vasfalu', category: 'infrastructure', amount: 32.8, status: 'paid', date: '2025-02-28', desc: '12 km hosszú kerékpárút hálózat a főbb lakóterületek összekapcsolásával.', progress: 100 },
  { id: 'EU-2025-007', name: 'Digitális Oktatási Platform', municipality: 'Bazsi City', category: 'education', amount: 12.5, status: 'approved', date: '2025-08-01', desc: 'Egységes online tanulási keretrendszer bevezetése a közoktatásban.', progress: 10 },
  { id: 'EU-2025-008', name: 'Vízgazdálkodási Projekt', municipality: 'Palotás', category: 'environment', amount: 75.0, status: 'processing', date: '2025-06-01', desc: 'Esővíz-gyűjtő és szikkasztó rendszer kiépítése a lakótelepeken.', progress: 35 },
  { id: 'EU-2025-009', name: 'Startup Inkubátor Ház', municipality: 'Bazsi City', category: 'economy', amount: 40.0, status: 'approved', date: '2025-09-15', desc: 'Vállalkozásfejlesztési központ és coworking iroda fiataloknak.', progress: 5 },
  { id: 'EU-2025-010', name: 'Falusi Rendelő Felújítás', municipality: 'Rózsaváros', category: 'health', amount: 15.4, status: 'paid', date: '2025-01-20', desc: 'A település orvosi rendelőjének teljes körű belső felújítása.', progress: 100 },
  { id: 'EU-2025-011', name: 'Ipari Park Infrastruktúra', municipality: 'Palotás', category: 'economy', amount: 150.0, status: 'rejected', date: '2025-04-30', desc: 'Elutasítva: a kérelem nem tartalmazott megfelelő hatástanulmányt.', progress: 0 },
  { id: 'EU-2025-012', name: 'Hulladékgazdálkodási Fejlesztés', municipality: 'Vasfalu', category: 'environment', amount: 65.5, status: 'processing', date: '2025-07-25', desc: 'Szelektív hulladékgyűjtési pontok és komposztáló telep létesítése.', progress: 55 },
];

const CATEGORIES = {
  infrastructure: { label: 'Infrastruktúra', color: '#3B82F6' },
  education: { label: 'Oktatás', color: '#8B5CF6' },
  environment: { label: 'Környezetvédelem', color: '#10B981' },
  economy: { label: 'Gazdaságfejlesztés', color: '#F59E0B' },
  health: { label: 'Egészségügy', color: '#EF4444' },
};

const STATUS_MAP = {
  paid: { label: 'Kifizetett', cls: 'badge-approved' },
  processing: { label: 'Folyamatban', cls: 'badge-processing' },
  approved: { label: 'Jóváhagyott', cls: 'badge-pending' },
  rejected: { label: 'Elutasított', cls: 'badge-rejected' },
};

let allProjects = [];
let filteredProjects = [];
let currentPage = 1;
const PAGE_SIZE = 8;

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('last-updated').textContent = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });

  allProjects = await loadProjects();
  filteredProjects = [...allProjects];

  renderSummary();
  renderTable();
  renderCategoryCards();
  
  // Pool logic
  updatePoolStatus();
  
  if (isLoggedIn()) {
    loadMyApplications();
  }

  // Live search
  document.getElementById('search-input').addEventListener('input', () => {
    currentPage = 1;
    applyFilters();
  });

  // Apply form submit
  document.getElementById('apply-form')?.addEventListener('submit', handleApplySubmit);
});

async function loadProjects() {
  try {
    const data = await publicApiCall('/eu-projects');
    if (data && Array.isArray(data.projects)) return data.projects;
  } catch (_) {}
  return MOCK_PROJECTS;
}

// ─── Pool Status (250 KF) ──────────────────────────────────
async function updatePoolStatus() {
  const POOL_TOTAL = 250;
  let spent = allProjects.filter(p => p.category === 'economy' && p.status !== 'rejected').reduce((s, p) => s + p.amount, 0);
  
  if (spent < 40) spent = 42.5; 

  const remaining = Math.max(0, POOL_TOTAL - spent);
  const pct = Math.round((remaining / POOL_TOTAL) * 100);

  const poolEl = document.getElementById('pool-remaining');
  if (poolEl) poolEl.textContent = remaining.toFixed(1) + ' KF';
  
  const barEl = document.getElementById('pool-bar');
  if (barEl) barEl.style.width = pct + '%';
}

function scrollToMyApps() {
  const el = document.getElementById('my-apps-section');
  if (el.classList.contains('hidden')) {
    showToast('Még nincs benyújtott pályázata.');
  } else {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

// ─── Summary ───────────────────────────────────────────────
function renderSummary() {
  const total = allProjects.reduce((s, p) => s + p.amount, 0);
  const paid = allProjects.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = allProjects.filter(p => p.status === 'processing' || p.status === 'approved').reduce((s, p) => s + p.amount, 0);

  setAnimated('total-budget', total);
  setAnimated('total-paid', paid);
  setAnimated('total-pending', pending);
  setAnimated('total-projects', allProjects.length, '', false);

  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  document.getElementById('usage-pct').textContent = pct + '%';
  document.getElementById('budget-label').textContent = formatKF(total) + ' KF';
  setTimeout(() => {
    document.getElementById('usage-bar').style.width = pct + '%';
  }, 300);
}

function setAnimated(id, val, suffix = ' KF', format = true) {
  const el = document.getElementById(id);
  if (!el) return;
  const display = format ? formatKF(val) + suffix : val.toString();
  // Quick count-up
  const start = Date.now();
  const tick = () => {
    const p = Math.min((Date.now() - start) / 900, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = format ? formatKF(Math.round(val * e)) + suffix : Math.round(val * e).toString();
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = display;
  };
  requestAnimationFrame(tick);
}

function formatKF(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString('hu-HU');
}

// ─── Filters ───────────────────────────────────────────────
function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category').value;

  filteredProjects = allProjects.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search) ||
      p.municipality.toLowerCase().includes(search) ||
      p.id.toLowerCase().includes(search);
    const matchStatus = !status || p.status === status;
    const matchCat = !category || p.category === category;
    return matchSearch && matchStatus && matchCat;
  });

  currentPage = 1;
  renderTable();
}

function resetFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-category').value = '';
  filteredProjects = [...allProjects];
  currentPage = 1;
  renderTable();
}

// ─── Table ─────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('projects-table');
  const total = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filteredProjects.slice(start, start + PAGE_SIZE);

  document.getElementById('table-count').textContent = `${total} projekt`;
  document.getElementById('page-info').textContent = `${currentPage} / ${totalPages}`;
  document.getElementById('prev-btn').disabled = currentPage <= 1;
  document.getElementById('next-btn').disabled = currentPage >= totalPages;

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-[#1a1a18]/30 font-mono text-sm">Nincs találat a megadott szűrőkre.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(p => {
    const s = STATUS_MAP[p.status] || { label: p.status, cls: '' };
    const cat = CATEGORIES[p.category] || { label: p.category };
    return `
      <tr>
        <td class="font-mono text-xs text-[#1a1a18]/50">${p.id}</td>
        <td class="font-medium max-w-xs">${p.name}</td>
        <td class="text-[#1a1a18]/60">${p.municipality}</td>
        <td>
          <span style="color:${cat.color}" class="font-mono text-xs">${cat.label}</span>
        </td>
        <td class="font-mono text-sm font-medium">${formatKF(p.amount)} KF</td>
        <td><span class="badge ${s.cls}">${s.label}</span></td>
        <td class="font-mono text-xs text-[#1a1a18]/40">${p.date}</td>
        <td>
          <button onclick="showDetail('${p.id}')" class="text-xs font-mono text-[#1a1a18]/40 hover:text-[#1a1a18] transition-colors whitespace-nowrap">Részletek →</button>
        </td>
      </tr>
    `;
  }).join('');
}

function prevPage() { if (currentPage > 1) { currentPage--; renderTable(); } }
function nextPage() {
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  if (currentPage < totalPages) { currentPage++; renderTable(); }
}

// ─── Category cards ────────────────────────────────────────
function renderCategoryCards() {
  const container = document.getElementById('category-cards');
  const catStats = {};
  allProjects.forEach(p => {
    if (!catStats[p.category]) catStats[p.category] = { count: 0, amount: 0, paid: 0 };
    catStats[p.category].count++;
    catStats[p.category].amount += p.amount;
    if (p.status === 'paid') catStats[p.category].paid += p.amount;
  });

  container.innerHTML = Object.entries(catStats).map(([key, s]) => {
    const cat = CATEGORIES[key] || { label: key, color: '#888' };
    const pct = s.amount > 0 ? Math.round((s.paid / s.amount) * 100) : 0;
    return `
      <div class="bg-white border border-[#1a1a18]/10 p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full" style="background:${cat.color}"></div>
          <span class="font-mono text-xs tracking-wide uppercase text-[#1a1a18]/50">${cat.label}</span>
        </div>
        <div class="font-garamond text-2xl font-medium mb-1">${formatKF(s.amount)} KF</div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-3">${s.count} projekt</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%; background:${cat.color}"></div>
        </div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mt-1">${pct}% kifizetett</div>
      </div>
    `;
  }).join('');
}

// ─── Detail modal ──────────────────────────────────────────
function showDetail(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  const s = STATUS_MAP[p.status] || { label: p.status, cls: '' };
  const cat = CATEGORIES[p.category] || { label: p.category, color: '#888' };

  document.getElementById('detail-content').innerHTML = `
    <div class="space-y-5">
      <div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Azonosító</div>
        <div class="font-mono text-sm">${p.id}</div>
      </div>
      <div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Projekt neve</div>
        <div class="font-garamond text-xl font-medium">${p.name}</div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Önkormányzat</div>
          <div class="text-sm font-medium">${p.municipality}</div>
        </div>
        <div>
          <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Kategória</div>
          <div class="text-sm font-medium" style="color:${cat.color}">${cat.label}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Összeg</div>
          <div class="font-garamond text-2xl font-medium">${formatKF(p.amount)} KF</div>
        </div>
        <div>
          <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Állapot</div>
          <div class="mt-1"><span class="badge ${s.cls}">${s.label}</span></div>
        </div>
      </div>
      <div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-2">Végrehajtás</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${p.progress}%; background:${cat.color}"></div>
        </div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mt-1">${p.progress}% kész</div>
      </div>
      <div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Leírás</div>
        <div class="text-sm text-[#1a1a18]/60 leading-relaxed">${p.desc}</div>
      </div>
      <div>
        <div class="font-mono text-xs text-[#1a1a18]/40 mb-1">Jóváhagyás dátuma</div>
        <div class="font-mono text-sm">${p.date}</div>
      </div>
    </div>
  `;
  document.getElementById('detail-modal').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}

document.getElementById('detail-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('detail-modal')) closeDetailModal();
});

// ─── CSV Export ────────────────────────────────────────────
function exportCSV() {
  const headers = ['Azonosító', 'Projekt neve', 'Önkormányzat', 'Kategória', 'Összeg (KF)', 'Állapot', 'Dátum'];
  const rows = filteredProjects.map(p => [
    p.id, `"${p.name}"`, p.municipality,
    CATEGORIES[p.category]?.label || p.category,
    p.amount, STATUS_MAP[p.status]?.label || p.status, p.date
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'craftlandia-eu-forrasok.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV fájl letöltve.');
}