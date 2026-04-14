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

      // IMPORTANT: use raw (non-decoded) thread ID — storage keys are
      // also saved raw, so decoding here would cause a mismatch
      const threadId = match[1];
      const data     = threads[threadId];

      // Climb up to the <li> list item — it won't have overflow:hidden
      // like the avatar image wrapper does, so the dot won't get clipped
      const listItem = link.closest('li') || link.parentElement;

      // Remove any existing dot on this item first (clean slate)
      listItem.querySelectorAll('.plcrm-inbox-dot').forEach(d => d.remove());

      if (!data || !data.stage || data.stage === 'new') return;

      const stage = stageMap[data.stage];
      if (!stage) return;

      // Create the dot and attach to the list item
      const dot = document.createElement('span');
      dot.className = 'plcrm-inbox-dot';
      dot.title     = `Pipeline: ${stage.label}`;
      dot.style.setProperty('--dot-color', stage.color);

      // The li needs relative positioning for our absolute dot to anchor to
      if (getComputedStyle(listItem).position === 'static') {
        listItem.style.position = 'relative';
      }

      // Overdue follow-up? Add a pulse ring
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

// Call updateInboxDots after every save so dots refresh immediately
function refreshInboxDotsAfterSave() {
  setTimeout(updateInboxDots, 100);
}

// Wait for the page to be ready then init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // Small delay to let LinkedIn's SPA fully render
  setTimeout(init, 800);
}

// ─── Thread Detection ─────────────────────────────────────────────────────────

function getThreadId() {
  const match = location.pathname.match(/\/messaging\/thread\/([^\/]+)/);
  return match ? match[1] : null;
}

function getContactName() {
  // Page title is the most reliable: "Name | LinkedIn"
  const titleMatch = document.title.match(/^(.+?)\s*[\|\-]\s*(LinkedIn|Messaging)/i);
  if (titleMatch) return titleMatch[1].trim();

  // DOM fallbacks
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
            placeholder="What did you discuss? Key objections, budget signals, next steps…"
            rows="4"
          ></textarea>
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
  // Toggle open/close
  document.getElementById('plcrm-tab').addEventListener('click', toggleSidebar);
  document.getElementById('plcrm-close').addEventListener('click', () => setSidebarOpen(false));

  // Stage selection
  document.getElementById('plcrm-stages').addEventListener('click', (e) => {
    const btn = e.target.closest('.plcrm-stage-btn');
    if (!btn) return;
    selectStage(btn.dataset.stage);
    markUnsaved();
  });

  // Notes change
  document.getElementById('plcrm-notes').addEventListener('input', markUnsaved);

  // Date change
  document.getElementById('plcrm-followup-date').addEventListener('change', (e) => {
    updateFollowupHint(e.target.value);
    markUnsaved();
  });

  document.getElementById('plcrm-clear-date').addEventListener('click', () => {
    document.getElementById('plcrm-followup-date').value = '';
    document.getElementById('plcrm-followup-hint').textContent = '';
    markUnsaved();
  });

  // Save
  document.getElementById('plcrm-save-btn').addEventListener('click', saveCurrentThread);
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

    // Update contact info immediately
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
    const contentEl = document.getElementById('plcrm-content');
    const noThreadEl = document.getElementById('plcrm-no-thread');
    
    noThreadEl.style.display = 'none';
    contentEl.style.display   = 'flex';

    if (data) {
      selectStage(data.stage || 'new');
      document.getElementById('plcrm-notes').value = data.notes || '';
      document.getElementById('plcrm-followup-date').value = data.followUpDate || '';
      updateFollowupHint(data.followUpDate || '');
      updateMeta(data.updatedAt);
      
      // NEW: Update LinkedIn UI background
      updateLinkedInHeaderBackground(data.stage);

      setSidebarOpen(true);
    } else {
      selectStage('new');
      updateLinkedInHeaderBackground('new');

    }

    document.getElementById('plcrm-saved-msg').textContent = '';
    document.getElementById('plcrm-save-btn').textContent   = 'Save';
    document.getElementById('plcrm-save-btn').classList.remove('plcrm-saved');
    unsavedChanges = false;
  });
}

// Helper function to find and color the LinkedIn header
function updateLinkedInHeaderBackground(stageId) {
  const stage = stageMap[stageId];
  // Selects the header area of the active conversation
  const header = document.querySelector('.msg-entity-lockup') || 
                 document.querySelector('.msg-thread__topcard');
  
  if (header && stage) {
    header.style.backgroundColor = stage.bg;
    header.style.padding = '8px';
    header.style.borderRadius = '8px';
  }
}

function saveCurrentThread() {
  if (!currentThreadId) return;

  const activeStageBtn = document.querySelector('.plcrm-stage-btn.plcrm-stage-active');
  const stage          = activeStageBtn ? activeStageBtn.dataset.stage : 'new';
  const notes          = document.getElementById('plcrm-notes').value.trim();
  const followUpDate   = document.getElementById('plcrm-followup-date').value;
  const name           = document.getElementById('plcrm-contact-name').textContent;
  const title          = document.getElementById('plcrm-contact-title').textContent;

  const data = { name, title, stage, notes, followUpDate };

  saveThreadData(currentThreadId, data, () => {
    unsavedChanges = false;
    updateMeta(Date.now());

    const saveBtn = document.getElementById('plcrm-save-btn');
    saveBtn.textContent = 'Saved ✓';
    saveBtn.classList.add('plcrm-saved');

    // Refresh inbox dots immediately after save
    refreshInboxDotsAfterSave();

    // Schedule follow-up alarm if date is set
    if (followUpDate) {
      scheduleFollowUpAlarm(currentThreadId, name, followUpDate);
    }
  });
}

function updateMeta(timestamp) {
  const meta = document.getElementById('plcrm-meta');
  if (!timestamp) { meta.textContent = ''; return; }
  const d = new Date(timestamp);
  meta.textContent = `Last saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Follow-up Alarms ─────────────────────────────────────────────────────────

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
