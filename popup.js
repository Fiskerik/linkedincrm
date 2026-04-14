// Pipeline CRM — Popup Script

const STAGES = [
  { id: 'new',        label: 'New Lead',    color: '#94A3B8', group: 'active' },
  { id: 'contacted',  label: 'Contacted',   color: '#3B82F6', group: 'active' },
  { id: 'interested', label: 'Interested',  color: '#8B5CF6', group: 'active' },
  { id: 'meeting',    label: 'Meeting Set', color: '#F59E0B', group: 'active' },
  { id: 'proposal',   label: 'Proposal',    color: '#EF4444', group: 'active' },
  { id: 'won',        label: 'Won',         color: '#10B981', group: 'won'    },
  { id: 'cold',       label: 'Cold',        color: '#CBD5E1', group: 'cold'   }
];

const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]));

let allThreads = [];
let currentFilter = 'active';

// ── Load Data ─────────────────────────────────────────────────────────────────

function loadData() {
  chrome.storage.local.get(['threads'], (result) => {
    const raw = result.threads || {};
    allThreads = Object.entries(raw)
      .map(([threadId, data]) => ({ threadId, ...data }))
      .filter(t => t.name)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    renderAll();
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAll() {
  updateStats();
  checkOverdue();
  renderList();
}

function filterThreads(filter) {
  if (filter === 'all')    return allThreads;
  if (filter === 'won')    return allThreads.filter(t => t.stage === 'won');
  if (filter === 'cold')   return allThreads.filter(t => t.stage === 'cold');
  if (filter === 'active') return allThreads.filter(t => !['won','cold'].includes(t.stage));
  return allThreads;
}

function renderList() {
  const list    = document.getElementById('pp-list');
  const empty   = document.getElementById('pp-empty');
  const threads = filterThreads(currentFilter);

  if (threads.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  // Group by stage in pipeline order
  const stageOrder = STAGES.map(s => s.id);
  const grouped = {};
  threads.forEach(t => {
    const s = t.stage || 'new';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(t);
  });

  let html = '';
  stageOrder.forEach(stageId => {
    if (!grouped[stageId]) return;
    const stage = stageMap[stageId];
    html += `
      <div class="pp-stage-group">
        <div class="pp-stage-header" style="--sc:${stage.color}">
          <span class="pp-stage-dot"></span>
          ${stage.label}
          <span class="pp-stage-count">${grouped[stageId].length}</span>
        </div>
        ${grouped[stageId].map(t => renderCard(t)).join('')}
      </div>
    `;
  });

  list.innerHTML = html;

  // Attach click-to-open handlers
  list.querySelectorAll('.pp-card').forEach(card => {
    card.addEventListener('click', () => {
      const threadId = card.dataset.threadId;
      chrome.tabs.create({
        url: `https://www.linkedin.com/messaging/thread/${threadId}/`
      });
    });
  });
}

function renderCard(t) {
  const stage    = stageMap[t.stage || 'new'];
  const overdue  = isOverdue(t.followUpDate);
  const dueLabel = getFollowUpLabel(t.followUpDate);

  return `
    <div class="pp-card ${overdue ? 'pp-card-overdue' : ''}" data-thread-id="${t.threadId}">
      <div class="pp-card-top">
        <div class="pp-card-avatar">${getInitials(t.name)}</div>
        <div class="pp-card-info">
          <div class="pp-card-name">${escHtml(t.name)}</div>
          ${t.title ? `<div class="pp-card-title">${escHtml(t.title)}</div>` : ''}
        </div>
        <span class="pp-card-stage-badge" style="--sc:${stage.color}">${stage.label}</span>
      </div>
      ${t.notes ? `<div class="pp-card-notes">${escHtml(truncate(t.notes, 80))}</div>` : ''}
      ${dueLabel ? `<div class="pp-card-due ${overdue ? 'pp-due-overdue' : ''}">${overdue ? '⚠ ' : '🗓 '}${dueLabel}</div>` : ''}
    </div>
  `;
}

// ── Stats & Overdue ────────────────────────────────────────────────────────────

function updateStats() {
  const active = allThreads.filter(t => !['won','cold'].includes(t.stage)).length;
  document.getElementById('pp-total-count').textContent =
    `${active} active deal${active !== 1 ? 's' : ''}`;
}

function checkOverdue() {
  const overdue = allThreads.filter(t =>
    t.followUpDate && isOverdue(t.followUpDate) && !['won','cold'].includes(t.stage)
  );
  const banner = document.getElementById('pp-overdue-banner');
  const text   = document.getElementById('pp-overdue-text');

  if (overdue.length > 0) {
    banner.style.display = 'flex';
    text.textContent = `${overdue.length} overdue follow-up${overdue.length !== 1 ? 's' : ''}`;
  } else {
    banner.style.display = 'none';
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today;
}

function getFollowUpLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)      return `${Math.abs(diff)}d overdue`;
  if (diff === 0)    return 'Today';
  if (diff === 1)    return 'Tomorrow';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join('') || '?';
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Events ────────────────────────────────────────────────────────────────────

document.querySelectorAll('.pp-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pp-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

document.getElementById('pp-open-li').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
});

// ── Init ─────────────────────────────────────────────────────────────────────
loadData();
