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

// Throttle for inbox dot updates
let inboxDotTimer     = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  if (!document.getElementById('plcrm-sidebar')) {
    injectSidebar();
  }
  checkCurrentThread();
  scheduleInboxDotUpdate();

  // Watch for SPA navigation AND list DOM changes (virtual scroll)
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkCurrentThread();
    }
    // Throttle inbox dot updates — LinkedIn fires many mutations
    clearTimeout(inboxDotTimer);
    inboxDotTimer = setTimeout(updateInboxDots, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Inbox Stage Dots ─────────────────────────────────────────────────────────

const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]));

function scheduleInboxDotUpdate() {
  // Initial paint after LinkedIn fully renders
  setTimeout(updateInboxDots, 1200);
}

function updateInboxDots() {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};

    // Find all conversation list links
    const links = document.querySelectorAll(
      'a[href*="/messaging/thread/"]'
    );

    links.forEach(link => {
      const match = link.href.match(/\/messaging\/thread\/([^/?#]+)/);
      if (!match) return;

      const threadId = match[1];
      const data     = threads[threadId];

      const listItem = link.closest('li') || link.parentElement;

      // Remove any existing dot on this item first
      listItem.querySelectorAll('.plcrm-inbox-dot').forEach(d => d.remove());

      if (!data || !data.stage || data.stage === 'new') return;

      const stage = stageMap[data.stage];
      if (!stage) return;

      const dot = document.createElement('span');
      dot.className = 'plcrm-inbox-dot';
      dot.title     = `Pipeline: ${stage.label}`;
      dot.style.setProperty('--dot-color', stage.color);

      if (getComputedStyle(listItem).position === 'static') {
        listItem.style.position = 'relative';
      }

      const isOverdue = data.followUpDate && (() => {
        const d = new Date(data.followUpDate + 'T00:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        return d < today;
      })();
      dot.classList.toggle('plcrm-dot-overdue', !!isOverdue);

      listItem.appendChild(dot);
    });
  });
}

function refreshInboxDotsAfterSave() {
  setTimeout(updateInboxDots, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 800);
}

// ─── Thread Detection ─────────────────────────────────────────────────────────

function getThreadId() {
  const match = location.pathname.match(/\/messaging\/thread\/([^\/]+)/);
  return match ? match[1] : null;
}

function getContactName() {
  const titleMatch = document.title.match(/^(.+?)\s*[\|\-]\s*(LinkedIn|Messaging)/i);
  if (titleMatch) return titleMatch[1].trim();

  const selectors = [
    '.msg-entity-lockup__entity-title',
    '.msg-thread__link-to-profile',
    'h2.t-16',
    '[data-anonymize="person-name"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return 'This contact';
}

function getContactSubtitle() {
  const selectors = [
    '.msg-entity-lockup__subtitle span',
    '.msg-entity-lockup__subtitle',
    '.t-12.t-black--light.t-normal'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 2) return text;
  }
  return '';
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join('') || '?';
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadThreadData(threadId, callback) {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    callback(threads[threadId] || null);
  });
}

function saveThreadData(threadId, data, callback) {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    threads[threadId] = { ...data, updatedAt: Date.now() };
    chrome.storage.local.set({ threads }, () => {
      if (callback) callback();
    });
  });
}

// ─── Sidebar Injection ────────────────────────────────────────────────────────

function injectSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'plcrm-sidebar';
  sidebar.innerHTML = buildSidebarHTML();
  document.body.appendChild(sidebar);
  attachSidebarEvents();
}

function buildSidebarHTML() {
  const stageButtons = STAGES.map(s => `
    <button class="plcrm-stage-btn" data-stage="${s.id}"
      style="--stage-color:${s.color};--stage-bg:${s.bg}">
      ${s.label}
    </button>
  `).join('');

  return `
    <div id="plcrm-tab" title="Open Pipeline CRM">
      <span class="plcrm-tab-label">CRM</span>
    </div>

    <div id="plcrm-panel">
      <div id="plcrm-header">
        <div id="plcrm-avatar"></div>
        <div id="plcrm-contact-info">
          <div id="plcrm-contact-name">Select a conversation</div>
          <div id="plcrm-contact-title"></div>
        </div>
        <button id="plcrm-close" title="Close">✕</button>
      </div>

      <div id="plcrm-no-thread" class="plcrm-empty-state">
        <div class="plcrm-empty-icon">💬</div>
        <div>Open a conversation<br>to start tracking</div>
      </div>

      <div id="plcrm-content" style="display:none">

        <section class="plcrm-section">
          <div class="plcrm-section-label">Deal stage</div>
          <div id="plcrm-stages">${stageButtons}</div>
        </section>

        <section class="plcrm-section">
          <div class="plcrm-section-label">Notes</div>
          <textarea
            id="plcrm-notes"
            placeholder="What did you discuss?..."
            rows="4"
          ></textarea>
        </section>

        <section class="plcrm-section">
          <div class="plcrm-section-label">Attachments</div>
          <input type="file" id="plcrm-file-input" style="display:none" />
          <button id="plcrm-upload-btn" class="plcrm-action-link">📎 Attach File</button>
          <div id="plcrm-file-list"></div>
        </section>

        <section class="plcrm-section">
          <div class="plcrm-section-label">History</div>
          <div id="plcrm-history-list"></div>
        </section>

        <section class="plcrm-section">
          <div class="plcrm-section-label">Follow-up reminder</div>
          <div id="plcrm-date-row">
            <input type="date" id="plcrm-followup-date" />
            <button id="plcrm-clear-date" title="Clear date">✕</button>
          </div>
          <div id="plcrm-followup-hint"></div>
        </section>

        <div id="plcrm-actions">
          <button id="plcrm-save-btn">Save</button>
          <div id="plcrm-saved-msg"></div>
        </div>

        <div id="plcrm-meta"></div>

      </div>
    </div>
  `;
}

// ─── Sidebar Events ───────────────────────────────────────────────────────────

function attachSidebarEvents() {
  document.getElementById('plcrm-tab').addEventListener('click', toggleSidebar);
  document.getElementById('plcrm-close').addEventListener('click', () => setSidebarOpen(false));

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

  document.getElementById('plcrm-clear-date').addEventListener('click', () => {
    document.getElementById('plcrm-followup-date').value = '';
    document.getElementById('plcrm-followup-hint').textContent = '';
    markUnsaved();
  });

  document.getElementById('plcrm-upload-btn').addEventListener('click', () => {
    document.getElementById('plcrm-file-input').click();
  });

  document.getElementById('plcrm-file-input').addEventListener('change', handleFileUpload);

  document.getElementById('plcrm-save-btn').addEventListener('click', saveCurrentThread);
}

// ─── Feature Logic ────────────────────────────────────────────────────────────

function updateLinkedInHeaderBackground(stageId) {
  const stage = stageMap[stageId];
  // Target the LinkedIn message header area
  const header = document.querySelector('.msg-entity-lockup') || 
                 document.querySelector('.msg-thread__topcard');
  
  if (header && stage) {
    header.style.backgroundColor = stage.bg;
    header.style.padding = '8px';
    header.style.borderRadius = '8px';
    header.style.transition = 'background-color 0.3s ease';
  }
}

function renderHistory(history) {
  const list = document.getElementById('plcrm-history-list');
  if (!history || history.length === 0) {
    list.innerHTML = '<div style="color:#94A3B8; font-size:11px;">No progress logged yet.</div>';
    return;
  }
  list.innerHTML = history.slice().reverse().map(item => {
    const date = new Date(item.timestamp).toLocaleDateString();
    return `<div class="plcrm-history-item">
      <strong>${date}</strong>: Stage changed from <em>${item.from}</em> to <em>${item.to}</em>
    </div>`;
  }).join('');
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const fileData = {
      name: file.name,
      content: event.target.result,
      timestamp: Date.now()
    };
    
    loadThreadData(currentThreadId, (data) => {
      const updatedData = data || { history: [], attachments: [] };
      if (!updatedData.attachments) updatedData.attachments = [];
      updatedData.attachments.push(fileData);
      
      saveThreadData(currentThreadId, updatedData, () => {
        renderAttachments(updatedData.attachments);
        document.getElementById('plcrm-save-btn').textContent = 'File Saved ✓';
      });
    });
  };
  reader.readAsDataURL(file);
}

function renderAttachments(files) {
  const list = document.getElementById('plcrm-file-list');
  if (!files || files.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = files.map(f => `
    <div class="plcrm-file-item">
      <a href="${f.content}" download="${f.name}" class="plcrm-action-link">📄 ${f.name}</a>
    </div>
  `).join('');
}

// ─── Sidebar State ────────────────────────────────────────────────────────────

function toggleSidebar() {
  const isOpen = document.getElementById('plcrm-sidebar').classList.contains('plcrm-open');
  setSidebarOpen(!isOpen);
}

function setSidebarOpen(open) {
  document.getElementById('plcrm-sidebar').classList.toggle('plcrm-open', open);
}

function selectStage(stageId) {
  document.querySelectorAll('.plcrm-stage-btn').forEach(btn => {
    btn.classList.toggle('plcrm-stage-active', btn.dataset.stage === stageId);
  });
}

function markUnsaved() {
  unsavedChanges = true;
  document.getElementById('plcrm-saved-msg').textContent = '';
  document.getElementById('plcrm-save-btn').textContent = 'Save';
  document.getElementById('plcrm-save-btn').classList.remove('plcrm-saved');
}

function updateFollowupHint(dateStr) {
  const hint = document.getElementById('plcrm-followup-hint');
  if (!dateStr) { hint.textContent = ''; return; }

  const today    = new Date(); today.setHours(0,0,0,0);
  const selected = new Date(dateStr + 'T00:00:00');
  const diff     = Math.round((selected - today) / 86400000);

  if (diff < 0)      hint.textContent = `${Math.abs(diff)} day${Math.abs(diff)!==1?'s':''} overdue`;
  else if (diff === 0) hint.textContent = 'Today';
  else if (diff === 1) hint.textContent = 'Tomorrow';
  else                hint.textContent = `In ${diff} days`;

  hint.className = diff < 0 ? 'plcrm-hint-overdue' : diff <= 1 ? 'plcrm-hint-soon' : 'plcrm-hint-future';
}

// ─── Thread Load & Save ────────────────────────────────────────────────────────

function checkCurrentThread() {
  const threadId = getThreadId();

  if (!threadId) {
    currentThreadId = null;
    showNoThread();
    return;
  }

  if (threadId !== currentThreadId) {
    currentThreadId = threadId;
    unsavedChanges = false;

    setTimeout(() => {
      const name     = getContactName();
      const subtitle = getContactSubtitle();
      updateContactHeader(name, subtitle);
      loadAndPopulateSidebar(threadId);
    }, 400);
  }
}

function showNoThread() {
  document.getElementById('plcrm-no-thread').style.display  = 'flex';
  document.getElementById('plcrm-content').style.display    = 'none';
  document.getElementById('plcrm-contact-name').textContent = 'Select a conversation';
  document.getElementById('plcrm-contact-title').textContent = '';
  document.getElementById('plcrm-avatar').textContent       = '?';
}

function updateContactHeader(name, subtitle) {
  document.getElementById('plcrm-contact-name').textContent  = name;
  document.getElementById('plcrm-contact-title').textContent = subtitle;
  document.getElementById('plcrm-avatar').textContent        = getInitials(name);
}

function loadAndPopulateSidebar(threadId) {
  loadThreadData(threadId, (data) => {
    document.getElementById('plcrm-no-thread').style.display = 'none';
    document.getElementById('plcrm-content').style.display   = 'flex';

    if (data) {
      selectStage(data.stage || 'new');
      document.getElementById('plcrm-notes').value = data.notes || '';
      document.getElementById('plcrm-followup-date').value = data.followUpDate || '';
      updateFollowupHint(data.followUpDate || '');
      updateMeta(data.updatedAt);
      renderHistory(data.history);
      renderAttachments(data.attachments);
      updateLinkedInHeaderBackground(data.stage || 'new');

      setSidebarOpen(true);
    } else {
      selectStage('new');
      document.getElementById('plcrm-notes').value = '';
      document.getElementById('plcrm-followup-date').value = '';
      document.getElementById('plcrm-followup-hint').textContent = '';
      updateMeta(null);
      renderHistory([]);
      renderAttachments([]);
      updateLinkedInHeaderBackground('new');
    }

    document.getElementById('plcrm-saved-msg').textContent = '';
    document.getElementById('plcrm-save-btn').textContent   = 'Save';
    document.getElementById('plcrm-save-btn').classList.remove('plcrm-saved');
    unsavedChanges = false;
  });
}

function saveCurrentThread() {
  if (!currentThreadId) return;

  loadThreadData(currentThreadId, (existingData) => {
    const activeStageBtn = document.querySelector('.plcrm-stage-btn.plcrm-stage-active');
    const newStage = activeStageBtn ? activeStageBtn.dataset.stage : 'new';
    const notes = document.getElementById('plcrm-notes').value.trim();
    const followUpDate = document.getElementById('plcrm-followup-date').value;
    const name = document.getElementById('plcrm-contact-name').textContent;
    const title = document.getElementById('plcrm-contact-title').textContent;

    const history = existingData?.history || [];
    if (existingData && existingData.stage !== newStage) {
      history.push({
        from: existingData.stage,
        to: newStage,
        timestamp: Date.now()
      });
    }

    const data = { 
      ...existingData,
      name, 
      title, 
      stage: newStage, 
      notes, 
      followUpDate,
      history
    };

    saveThreadData(currentThreadId, data, () => {
      unsavedChanges = false;
      updateMeta(Date.now());
      renderHistory(history);

      const saveBtn = document.getElementById('plcrm-save-btn');
      saveBtn.textContent = 'Saved ✓';
      saveBtn.classList.add('plcrm-saved');
      refreshInboxDotsAfterSave();

      if (followUpDate) {
        scheduleFollowUpAlarm(currentThreadId, name, followUpDate);
      }
    });
  });
}

function updateMeta(timestamp) {
  const meta = document.getElementById('plcrm-meta');
  if (!timestamp) { meta.textContent = ''; return; }
  const d = new Date(timestamp);
  meta.textContent = `Last saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function scheduleFollowUpAlarm(threadId, contactName, dateStr) {
  const alarmTime = new Date(dateStr + 'T09:00:00').getTime();
  if (alarmTime <= Date.now()) return;

  chrome.runtime.sendMessage({
    type:        'SCHEDULE_ALARM',
    alarmName:   `followup_${threadId}`,
    alarmTime,
    contactName,
    threadId
  });
}
