// Pipeline CRM — Content Script
// Injects a deal-management sidebar into LinkedIn's messaging inbox

const STAGES = [
  { id: 'new',       label: 'New Lead',      color: '#94A3B8', bg: '#F1F5F9' },
  { id: 'contacted', label: 'Contacted',     color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'interested',label: 'Interested',    color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'meeting',   label: 'Meeting Set',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'proposal',  label: 'Proposal',      color: '#EF4444', bg: '#FEF2F2' },
  { id: 'won',       label: 'Won',           color: '#10B981', bg: '#ECFDF5' },
  { id: 'cold',      label: 'Cold',          color: '#CBD5E1', bg: '#F8FAFC' }
];

let currentThreadId   = null;
let lastUrl           = location.href;
let unsavedChanges    = false;
let inboxUpdateTimer  = null;

const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]));

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  if (!document.getElementById('plcrm-sidebar')) {
    injectSidebar();
  }
  checkCurrentThread();
  scheduleInboxUpdate();

  // Watch for SPA navigation and list changes
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkCurrentThread();
    }
    clearTimeout(inboxUpdateTimer);
    inboxUpdateTimer = setTimeout(updateInboxUI, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Inbox UI (Dots & Row Highlights) ────────────────────────────────────────

function scheduleInboxUpdate() {
  setTimeout(updateInboxUI, 1200);
}

function updateInboxUI() {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    const links = document.querySelectorAll('a[href*="/messaging/thread/"]');

    links.forEach(link => {
      const match = link.href.match(/\/messaging\/thread\/([^/?#]+)/);
      if (!match) return;

      const threadId = match[1];
      const data     = threads[threadId];
      const listItem = link.closest('li') || link.parentElement;

      // Reset existing styles and clean dots
      listItem.querySelectorAll('.plcrm-inbox-dot').forEach(d => d.remove());
      
      const titleRow = link.querySelector('.msg-conversation-card__row.msg-conversation-card__title-row');
      if (titleRow) {
        titleRow.style.backgroundColor = 'transparent';
        titleRow.style.border = 'none';
        titleRow.style.padding = '0';
      }

      if (!data || !data.stage) return;
      const stage = stageMap[data.stage];
      if (!stage) return;

      // 1. Add Stage Dot (Overdue pulsing logic included)
      if (data.stage !== 'new') {
        const dot = document.createElement('span');
        dot.className = 'plcrm-inbox-dot';
        dot.style.setProperty('--dot-color', stage.color);
        
        const isOverdue = data.followUpDate && (() => {
          const d = new Date(data.followUpDate + 'T00:00:00');
          const today = new Date(); today.setHours(0,0,0,0);
          return d < today;
        })();
        dot.classList.toggle('plcrm-dot-overdue', !!isOverdue);
        listItem.appendChild(dot);
      }

      // 2. Highlight the Full Title Row
      if (titleRow && data.stage !== 'new') {
        titleRow.style.backgroundColor = stage.bg;
        titleRow.style.padding = '2px 8px';
        titleRow.style.borderRadius = '4px';
        titleRow.style.border = `1px solid ${stage.color}`;
        titleRow.style.margin = '2px 0';
      }
    });
  });
}

// ─── Thread Detection ─────────────────────────────────────────────────────────

function getThreadId() {
  const match = location.pathname.match(/\/messaging\/thread\/([^\/]+)/);
  return match ? match[1] : null;
}

function getContactName() {
  const titleMatch = document.title.match(/^(.+?)\s*[\|\-]\s*(LinkedIn|Messaging)/i);
  if (titleMatch) return titleMatch[1].trim();
  const selectors = ['.msg-entity-lockup__entity-title', '.msg-thread__link-to-profile', 'h2.t-16'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return 'This contact';
}

function getContactSubtitle() {
  const selectors = ['.msg-entity-lockup__subtitle span', '.msg-entity-lockup__subtitle'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return '';
}

function updateLinkedInHeaderBackground(stageId) {
  const stage = stageMap[stageId];
  const headerName = document.querySelector('.msg-entity-lockup__entity-title') || document.querySelector('.msg-thread__topcard h2');
  
  if (headerName && stage) {
    headerName.style.backgroundColor = stage.bg;
    headerName.style.padding = '2px 8px';
    headerName.style.borderRadius = '4px';
    headerName.style.border = stageId === 'new' ? 'none' : `1px solid ${stage.color}`;
  }
}

// ─── Sidebar Logic ───────────────────────────────────────────────────────────

function injectSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'plcrm-sidebar';
  sidebar.innerHTML = buildSidebarHTML();
  document.body.appendChild(sidebar);
  attachSidebarEvents();
}

function buildSidebarHTML() {
  const stageButtons = STAGES.map(s => `
    <button class="plcrm-stage-btn" data-stage="${s.id}" style="--stage-color:${s.color};--stage-bg:${s.bg}">${s.label}</button>
  `).join('');

  return `
    <div id="plcrm-tab" title="Open Pipeline CRM"><span class="plcrm-tab-label">CRM</span></div>
    <div id="plcrm-panel">
      <div id="plcrm-header">
        <div id="plcrm-avatar"></div>
        <div id="plcrm-contact-info">
          <div id="plcrm-contact-name">Select a conversation</div>
          <div id="plcrm-contact-title"></div>
        </div>
        <button id="plcrm-close">✕</button>
      </div>
      <div id="plcrm-no-thread" class="plcrm-empty-state">💬<br>Open a conversation</div>
      <div id="plcrm-content" style="display:none">
        <section class="plcrm-section"><div class="plcrm-section-label">Deal stage</div><div id="plcrm-stages">${stageButtons}</div></section>
        <section class="plcrm-section"><div class="plcrm-section-label">Notes</div><textarea id="plcrm-notes" rows="4"></textarea></section>
        <section class="plcrm-section">
          <div class="plcrm-section-label">Attachments</div>
          <input type="file" id="plcrm-file-input" style="display:none" />
          <button id="plcrm-upload-btn" class="plcrm-action-link">📎 Attach File</button>
          <div id="plcrm-file-list"></div>
        </section>
        <section class="plcrm-section"><div class="plcrm-section-label">History</div><div id="plcrm-history-list"></div></section>
        <section class="plcrm-section">
          <div class="plcrm-section-label">Follow-up reminder</div>
          <div id="plcrm-date-row"><input type="date" id="plcrm-followup-date" /><button id="plcrm-clear-date">✕</button></div>
          <div id="plcrm-followup-hint"></div>
        </section>
        <div id="plcrm-actions"><button id="plcrm-save-btn">Save</button></div>
        <div style="padding:10px; border-top:1px solid #eee;"><button id="plcrm-open-kanban" class="plcrm-action-link" style="width:100%">Open Full Kanban Board 📋</button></div>
        <div id="plcrm-meta"></div>
      </div>
    </div>
  `;
}

function attachSidebarEvents() {
  document.getElementById('plcrm-tab').addEventListener('click', () => document.getElementById('plcrm-sidebar').classList.toggle('plcrm-open'));
  document.getElementById('plcrm-close').addEventListener('click', () => document.getElementById('plcrm-sidebar').classList.remove('plcrm-open'));
  
  document.getElementById('plcrm-stages').addEventListener('click', (e) => {
    const btn = e.target.closest('.plcrm-stage-btn');
    if (!btn) return;
    selectStage(btn.dataset.stage);
    updateLinkedInHeaderBackground(btn.dataset.stage);
    markUnsaved();
  });

  document.getElementById('plcrm-notes').addEventListener('input', markUnsaved);
  document.getElementById('plcrm-followup-date').addEventListener('change', (e) => {
    updateFollowupHint(e.target.value);
    markUnsaved();
  });

  document.getElementById('plcrm-upload-btn').addEventListener('click', () => document.getElementById('plcrm-file-input').click());
  document.getElementById('plcrm-file-input').addEventListener('change', handleFileUpload);
  document.getElementById('plcrm-save-btn').addEventListener('click', saveCurrentThread);
  document.getElementById('plcrm-open-kanban').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_KANBAN' }));
}

// ─── Data Persistence ────────────────────────────────────────────────────────

function loadAndPopulateSidebar(threadId) {
  chrome.storage.local.get(['threads'], (result) => {
    const data = (result.threads || {})[threadId];
    document.getElementById('plcrm-no-thread').style.display = 'none';
    document.getElementById('plcrm-content').style.display = 'flex';

    if (data) {
      selectStage(data.stage || 'new');
      document.getElementById('plcrm-notes').value = data.notes || '';
      document.getElementById('plcrm-followup-date').value = data.followUpDate || '';
      updateFollowupHint(data.followUpDate || '');
      renderHistory(data.history);
      renderAttachments(data.attachments);
      updateLinkedInHeaderBackground(data.stage || 'new');
      if (data.stage !== 'new') document.getElementById('plcrm-sidebar').classList.add('plcrm-open');
    } else {
      resetSidebar();
    }
    unsavedChanges = false;
  });
}

function saveCurrentThread() {
  if (!currentThreadId) return;
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    const existingData = threads[currentThreadId];
    const activeStage = document.querySelector('.plcrm-stage-btn.plcrm-stage-active').dataset.stage;
    
    const history = existingData?.history || [];
    if (existingData && existingData.stage !== activeStage) {
      history.push({ from: existingData.stage, to: activeStage, timestamp: Date.now() });
    }

    threads[currentThreadId] = {
      ...existingData,
      name: getContactName(),
      title: getContactSubtitle(),
      stage: activeStage,
      notes: document.getElementById('plcrm-notes').value,
      followUpDate: document.getElementById('plcrm-followup-date').value,
      history,
      updatedAt: Date.now()
    };

    chrome.storage.local.set({ threads }, () => {
      document.getElementById('plcrm-save-btn').textContent = 'Saved ✓';
      updateInboxUI();
    });
  });
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    chrome.storage.local.get(['threads'], (result) => {
      const threads = result.threads || {};
      if (!threads[currentThreadId].attachments) threads[currentThreadId].attachments = [];
      threads[currentThreadId].attachments.push({ name: file.name, content: event.target.result, timestamp: Date.now() });
      chrome.storage.local.set({ threads }, () => renderAttachments(threads[currentThreadId].attachments));
    });
  };
  reader.readAsDataURL(file);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function selectStage(stageId) {
  document.querySelectorAll('.plcrm-stage-btn').forEach(btn => btn.classList.toggle('plcrm-stage-active', btn.dataset.stage === stageId));
}

function markUnsaved() {
  unsavedChanges = true;
  document.getElementById('plcrm-save-btn').textContent = 'Save';
}

function renderHistory(history) {
  const list = document.getElementById('plcrm-history-list');
  list.innerHTML = (history || []).slice().reverse().map(i => `<div class="plcrm-history-item"><strong>${new Date(i.timestamp).toLocaleDateString()}</strong>: ${i.from} → ${i.to}</div>`).join('') || 'No history.';
}

function renderAttachments(files) {
  const list = document.getElementById('plcrm-file-list');
  list.innerHTML = (files || []).map(f => `<div class="plcrm-file-item"><a href="${f.content}" download="${f.name}" class="plcrm-action-link">📄 ${f.name}</a></div>`).join('');
}

function updateFollowupHint(dateStr) {
  const hint = document.getElementById('plcrm-followup-hint');
  if (!dateStr) { hint.textContent = ''; return; }
  const diff = Math.round((new Date(dateStr + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
  hint.textContent = diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : `In ${diff} days`;
}

function checkCurrentThread() {
  const id = getThreadId();
  if (id && id !== currentThreadId) {
    currentThreadId = id;
    loadAndPopulateSidebar(id);
    updateContactHeader(getContactName(), getContactSubtitle());
  }
}

function updateContactHeader(n, s) {
  document.getElementById('plcrm-contact-name').textContent = n;
  document.getElementById('plcrm-contact-title').textContent = s;
  document.getElementById('plcrm-avatar').textContent = n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2);
}

function resetSidebar() {
  selectStage('new');
  document.getElementById('plcrm-notes').value = '';
  document.getElementById('plcrm-followup-date').value = '';
  renderHistory([]);
  renderAttachments([]);
  updateLinkedInHeaderBackground('new');
}

init();
