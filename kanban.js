const STAGES = [
  { id: 'new', label: 'New Lead', color: '#94A3B8' },
  { id: 'contacted', label: 'Contacted', color: '#3B82F6' },
  { id: 'interested', label: 'Interested', color: '#8B5CF6' },
  { id: 'meeting', label: 'Meeting Set', color: '#F59E0B' },
  { id: 'proposal', label: 'Proposal', color: '#EF4444' },
  { id: 'won', label: 'Won', color: '#10B981' },
  { id: 'cold', label: 'Cold', color: '#CBD5E1' }
];

function renderBoard() {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    const board = document.getElementById('board');
    board.innerHTML = '';

    STAGES.forEach(stage => {
      const col = document.createElement('div');
      col.className = 'column';
      col.innerHTML = `<div class="column-header">${stage.label}</div><div class="card-list" id="list-${stage.id}"></div>`;
      board.appendChild(col);

      const list = col.querySelector('.card-list');
      Object.entries(threads).filter(([id, data]) => data.stage === stage.id).forEach(([id, data]) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderLeftColor = stage.color;
        card.innerHTML = `
          <div class="card-name">${data.name || 'Unknown'}</div>
          <div class="card-notes">${data.notes || ''}</div>
          <select class="stage-select" data-id="${id}">
            ${STAGES.map(s => `<option value="${s.id}" ${s.id === stage.id ? 'selected' : ''}>Move to: ${s.label}</option>`).join('')}
          </select>
        `;
        
        card.querySelector('.stage-select').addEventListener('change', (e) => {
          updateStage(id, e.target.value);
        });

        card.addEventListener('click', (e) => {
          if (e.target.tagName !== 'SELECT') {
            window.open(`https://www.linkedin.com/messaging/thread/${id}/`, '_blank');
          }
        });
        list.appendChild(card);
      });
    });
  });
}

function updateStage(threadId, newStage) {
  chrome.storage.local.get(['threads'], (result) => {
    const threads = result.threads || {};
    if (threads[threadId]) {
      threads[threadId].stage = newStage;
      chrome.storage.local.set({ threads }, renderBoard);
    }
  });
}

renderBoard();
