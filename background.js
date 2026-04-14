// Pipeline CRM — Background Service Worker
// Handles follow-up alarms and browser notifications

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_KANBAN') {
    chrome.tabs.create({ url: 'kanban.html' });
  }
  if (msg.type === 'SCHEDULE_ALARM') {
    chrome.alarms.create(msg.alarmName, { when: msg.alarmTime });

    // Store alarm metadata so we can read it on fire
    chrome.storage.local.get(['alarmMeta'], (result) => {
      const meta = result.alarmMeta || {};
      meta[msg.alarmName] = {
        contactName: msg.contactName,
        threadId:    msg.threadId
      };
      chrome.storage.local.set({ alarmMeta: meta });
    });

    sendResponse({ ok: true });
  }
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('followup_')) return;

  chrome.storage.local.get(['alarmMeta'], (result) => {
    const meta = (result.alarmMeta || {})[alarm.name];
    const name = meta?.contactName || 'a prospect';

    chrome.notifications.create(alarm.name, {
      type:    'basic',
      iconUrl: 'icons/icon48.png',
      title:   'Follow-up reminder — Pipeline CRM',
      message: `Time to follow up with ${name} on LinkedIn.`,
      buttons: [{ title: 'Open LinkedIn' }],
      priority: 2
    });
  });
});

chrome.notifications.onButtonClicked.addListener((notifId) => {
  chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
});
