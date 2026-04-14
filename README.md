# Pipeline CRM — LinkedIn Inbox Extension (MVP)

A lightweight Chrome extension that adds deal stages, notes, and
follow-up reminders directly inside LinkedIn's messaging inbox.

---

## Install (Developer Mode)

1. Clone or unzip this folder somewhere on your machine
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select this folder
5. Navigate to `linkedin.com/messaging/` — the "CRM" tab appears on the right

---

## What it does

### Sidebar (injected into LinkedIn inbox)
- **CRM tab** on the right edge of the screen — click to expand
- **Deal stage** — assign one of 7 pipeline stages to any conversation
- **Notes** — persistent notes per conversation, shown every time you open the thread
- **Follow-up date** — set a reminder; browser notification fires at 9am on that day
- **Auto-opens** when you navigate to a conversation that already has data

### Popup (click the extension icon)
- Pipeline view of all tracked conversations, grouped by stage
- Overdue follow-ups highlighted in red
- Filter by Active / Won / Cold / All
- Click any deal to jump straight to that LinkedIn thread

---

## File Structure

```
pipeline-extension/
├── manifest.json        Chrome MV3 manifest
├── content.js           Sidebar injection + LinkedIn SPA detection
├── sidebar.css          Sidebar styles (namespaced with plcrm-)
├── background.js        Service worker — alarms & notifications
├── popup.html           Extension popup (pipeline view)
├── popup.js             Popup logic
├── popup.css            Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── generate_icons.py    Regenerate icons if needed
```

---

## Data Storage

All data is stored in `chrome.storage.local` — it never leaves your browser.
Each conversation is keyed by LinkedIn's thread ID.

```json
{
  "threads": {
    "2-abc123": {
      "name": "Jane Smith",
      "title": "VP Sales at Acme Corp",
      "stage": "meeting",
      "notes": "Mentioned Q2 budget, re-engage after board meeting",
      "followUpDate": "2026-04-21",
      "updatedAt": 1713000000000
    }
  }
}
```

---

## Known LinkedIn Limitations

LinkedIn is a complex SPA and changes its DOM structure periodically.
If the contact name doesn't appear in the sidebar header, the extension
will fall back to "This contact" but all save/load functionality still
works correctly via the thread ID from the URL.

---

## Roadmap (Post-MVP)

- [ ] CRM sync (HubSpot, Pipedrive, Salesforce)
- [ ] Kanban board as a full browser tab
- [ ] Team shared pipeline (via backend)
- [ ] Stage badge overlaid on LinkedIn's conversation list
- [ ] Weekly stats digest
- [ ] CSV export

---

## Development

No build step required — vanilla JS + CSS.
Edit files, then click **🔄 Reload** on `chrome://extensions/` to apply changes.
