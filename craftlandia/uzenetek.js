// uzenetek.js

const MOCK_MESSAGES = [
  { id: 1, from_name: 'Automatikus üzenet (RENDSZER)', subject: 'Üdvözöljük az Ügyfélkapun!', category: 'ertasites', created_at: '2026-05-14', read: false, body: 'Köszöntjük az Ügyfélkapun! Ügyeit elektronikusan rendezheti el a digitális hivatali portálon! Köszönjük hogy a Craftlandiai digitális hivatali portált használja! Craftlandia Kormánya' }
];

let messages = [];
let activeId = null;

// Azonnal meghívjuk a betöltést
document.addEventListener('DOMContentLoaded', () => {
  initMessages();
});

async function initMessages() {
  await loadMessages();
  // Ha van üzenet, válasszuk ki az elsőt automatikusan
  if (messages.length > 0) {
    selectMsg(messages[0].id);
  }
}

async function loadMessages() {
  try {
    const res = await apiCall('/uzenetek');
    if (res && Array.isArray(res.messages)) {
      messages = res.messages;
    } else {
      messages = [...MOCK_MESSAGES];
    }
  } catch (e) {
    console.warn('API hiba, mock adatok betöltése...', e);
    messages = [...MOCK_MESSAGES];
  }
  renderList();
  renderUnreadCount();
}

function renderUnreadCount() {
  const unread = messages.filter(m => !m.read).length;
  const badge = document.getElementById('msg-badge');
  const unreadSpan = document.getElementById('unread-count');
  
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  
  if (unreadSpan) {
    unreadSpan.textContent = unread;
  }
}

function renderList() {
  const list = document.getElementById('msg-list');
  if (!list) return;

  if (messages.length === 0) {
    list.innerHTML = '<div class="p-8 text-center text-[#1a1a18]/30 font-garamond italic">Nincsenek üzenetek</div>';
    return;
  }

  list.innerHTML = messages.map(m => `
    <div class="msg-item p-5 border-b border-[#1a1a18]/05 cursor-pointer hover:bg-[#F5F3EE] transition-all ${m.id === activeId ? 'bg-white shadow-sm border-l-4 border-l-[#1a1a18]' : 'bg-transparent'}" onclick="selectMsg(${m.id})">
      <div class="flex items-start gap-3">
        ${!m.read ? '<div class="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5 shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>' : '<div class="w-2 h-2 flex-shrink-0"></div>'}
        <div class="flex-1 min-w-0">
          <div class="font-mono text-[10px] text-[#1a1a18]/40 uppercase tracking-widest mb-1">${m.from_name}</div>
          <div class="text-[15px] ${!m.read ? 'font-bold' : 'font-medium'} text-[#1a1a18] leading-tight mb-2 truncate">${m.subject}</div>
          <div class="font-mono text-[10px] text-[#1a1a18]/30">${m.created_at ? m.created_at.split(' ')[0] : ''}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function selectMsg(id) {
  activeId = id;
  const m = messages.find(msg => msg.id === id);
  if (!m) return;

  if (!m.read) {
    m.read = true;
    renderUnreadCount();
    // Nem várjuk meg az API hívást, hogy ne legyen lassú a UI
    apiCall('/uzenetek/' + id, { method: 'POST' }).catch(() => {});
  }

  renderList();
  renderDetail(m);
}

function renderDetail(m) {
  const detail = document.getElementById('msg-detail');
  if (!detail) return;

  detail.innerHTML = `
    <div class="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="mb-10">
        <div class="flex items-center justify-between mb-6">
           <span class="badge ${getCategoryClass(m.category)} px-3 py-1 text-[10px] uppercase tracking-widest font-bold">${getCategoryLabel(m.category)}</span>
           <span class="font-mono text-[11px] text-[#1a1a18]/40">${m.created_at}</span>
        </div>
        <div class="font-mono text-[10px] text-[#1a1a18]/40 uppercase tracking-widest mb-2">Hivatalos Küldemény</div>
        <h2 class="font-garamond text-4xl font-medium text-[#1a1a18] leading-tight">${m.subject}</h2>
      </div>

      <div class="flex items-center gap-4 mb-10 pb-10 border-b border-[#1a1a18]/05">
        <div class="w-12 h-12 bg-[#1a1a18] flex items-center justify-center">
          <span class="text-white font-mono text-sm">${m.from_name.charAt(0)}</span>
        </div>
        <div>
          <div class="text-xs font-mono text-[#1a1a18]/40 uppercase mb-0.5">Feladó Intézmény</div>
          <div class="font-medium text-sm text-[#1a1a18]">${m.from_name}</div>
        </div>
      </div>

      <div class="prose prose-stone max-w-none">
        <div class="font-garamond text-xl leading-relaxed text-[#1a1a18]/80 whitespace-pre-wrap">${m.body}</div>
      </div>

      <div class="mt-16 flex gap-4 pt-10 border-t border-[#1a1a18]/10">
        <button onclick="replyMsg(${m.id})" class="px-8 py-3 bg-[#1a1a18] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#2d2d2b] transition-all">Válaszküldés</button>
        <button onclick="deleteMsg(${m.id})" class="px-8 py-3 border border-red-200 text-red-800 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-all">Üzenet Törlése</button>
      </div>
    </div>
  `;
}

function getCategoryLabel(cat) {
  const labels = { ado: 'Adóügy', ceg: 'Cégügy', ertesites: 'Kormányzati Értesítés', hatarozat: 'Hivatalos Határozat' };
  return labels[cat] || 'Általános';
}

function filterMsg(category, btn) {
  // Gombok stílusának frissítése
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active', 'bg-[#1a1a18]', 'text-[#F5F3EE]');
    b.classList.add('border-[#1a1a18]/20');
  });
  btn.classList.add('active', 'bg-[#1a1a18]', 'text-[#F5F3EE]');
  btn.classList.remove('border-[#1a1a18]/20');

  const list = document.getElementById('msg-list');
  let filtered = messages;

  if (category === 'unread') {
    filtered = messages.filter(m => !m.read);
  } else if (category !== 'all') {
    filtered = messages.filter(m => m.category === category);
  }

  renderFilteredList(filtered);
}

function renderFilteredList(items) {
  const list = document.getElementById('msg-list');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = '<div class="p-8 text-center text-[#1a1a18]/30 font-garamond italic">Nincs ilyen üzenet</div>';
    return;
  }

  list.innerHTML = items.map(m => `
    <div class="msg-item p-5 border-b border-[#1a1a18]/05 cursor-pointer hover:bg-[#F5F3EE] transition-all ${m.id === activeId ? 'bg-white shadow-sm border-l-4 border-l-[#1a1a18]' : 'bg-transparent'}" onclick="selectMsg(${m.id})">
      <div class="flex items-start gap-3">
        ${!m.read ? '<div class="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5 shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>' : '<div class="w-2 h-2 flex-shrink-0"></div>'}
        <div class="flex-1 min-w-0">
          <div class="font-mono text-[10px] text-[#1a1a18]/40 uppercase tracking-widest mb-1">${m.from_name}</div>
          <div class="text-[15px] ${!m.read ? 'font-bold' : 'font-medium'} text-[#1a1a18] leading-tight mb-2 truncate">${m.subject}</div>
          <div class="font-mono text-[10px] text-[#1a1a18]/30">${m.created_at ? m.created_at.split(' ')[0] : ''}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function getCategoryClass(cat) {
  const classes = { ado: 'bg-blue-50 text-blue-800 border border-blue-100', ceg: 'bg-green-50 text-green-800 border border-green-100', ertesites: 'bg-gray-100 text-gray-800 border border-gray-200', hatarozat: 'bg-red-50 text-red-800 border border-red-100' };
  return classes[cat] || 'bg-gray-100 text-gray-800';
}

async function markAllRead() {
  if (!confirm('Biztosan az összes üzenetet olvasottnak jelöli?')) return;
  
  try {
    const res = await apiCall('/uzenetek/read-all', { method: 'POST' });
    if (res && res.ok) {
      messages.forEach(m => m.read = true);
      renderUnreadCount();
      renderList();
      showToast('Összes üzenet olvasottnak jelölve.');
    }
  } catch (e) {
    showToast('Hiba a művelet során.');
  }
}

function replyMsg(id) {
  showToast('A válaszfunkció jelenleg karbantartás alatt.');
}

async function deleteMsg(id) {
  if (!confirm('Véglegesen törölni szeretné ezt a kormányzati küldeményt?')) return;

  try {
    const res = await apiCall('/uzenetek/' + id, { method: 'DELETE' });
    if (res && res.ok) {
      messages = messages.filter(m => m.id !== id);
      activeId = null;
      renderUnreadCount();
      renderList();
      const detail = document.getElementById('msg-detail');
      if (detail) detail.innerHTML = `<div class="h-full flex items-center justify-center animate-pulse"><p class="font-garamond text-2xl text-[#1a1a18]/20 italic">Üzenet törölve</p></div>`;
      showToast('Üzenet sikeresen törölve.');
      
      // Ha maradt még üzenet, válasszuk ki a következőt
      if (messages.length > 0) {
        setTimeout(() => selectMsg(messages[0].id), 500);
      }
    }
  } catch (e) {
    showToast('Szerverhiba a törlés során.');
  }
}