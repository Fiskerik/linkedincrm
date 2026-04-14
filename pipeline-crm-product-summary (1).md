# Pipeline CRM — Product Summary

> A Chrome extension that turns LinkedIn's inbox into a lightweight sales pipeline.
> No external CRM required. Everything lives where the conversation happens.

---

## The Problem

LinkedIn is the #1 channel for B2B sales, but its inbox is built for social networking — not selling. Sales reps using LinkedIn daily face the same set of frustrations:

- **Context amnesia** — reopening a thread after 2 weeks with zero memory of where it left off
- **No pipeline visibility** — no way to know which of 80 conversations are hot vs. dead without reading every thread
- **Follow-ups falling through** — reminders live in sticky notes, calendar events, or a rep's head
- **CRM hygiene dread** — copy-pasting LinkedIn activity into Salesforce/HubSpot is so painful most reps skip it
- **Constant tab switching** — moving between LinkedIn, CRM, and notes destroys focus and costs 45+ min/day

---

## The Solution

Pipeline CRM injects a sidebar directly into LinkedIn's messaging inbox. Every conversation becomes a trackable deal — with a stage, persistent notes, and a follow-up reminder — without ever leaving LinkedIn.

---

## USP (Unique Selling Proposition)

> **The only tool that treats a LinkedIn DM thread as a sales deal.**

Existing tools fall into two camps:
- **Inbox organisers** (Kondo, LeadDelta) — label and sort messages, but no deal stages or pipeline logic
- **CRM bridges** (Surfe, Salesflare) — sync LinkedIn data to an external CRM, but require you to already own one

Pipeline CRM owns the gap: a **standalone deal pipeline that lives inside the LinkedIn inbox itself**, works without a CRM, and costs a fraction of the alternatives.

### Competitive Positioning

| Feature | Kondo ($28–36/mo) | Surfe ($30+/mo) | **Pipeline CRM** |
|---|---|---|---|
| Deal pipeline stages | ✗ | ✗ | ✓ Core feature |
| Notes per conversation | ✓ | ✓ | ✓ |
| Context reminder on open | ✗ | ✗ | ✓ Unique |
| Kanban pipeline view | ✗ | ✗ | ✓ Core feature |
| Follow-up reminders | ✓ | ✗ | ✓ |
| Works without a CRM | ✓ | ✗ | ✓ |
| Price | $28–36/mo | $30+/mo | **Free / $12 Pro** |

---

## Target User

**Primary:** SDRs and AEs at SMBs who use LinkedIn as their primary outbound channel and don't have a well-enforced CRM workflow.

**Secondary:** Founders and consultants doing their own outreach who want lightweight deal tracking without a full CRM subscription.

**Not for:** Enterprise teams with RevOps and a mandatory Salesforce process — they need a CRM bridge, not a standalone tool.

---

## MVP (Shipped)

The current build covers the core daily workflow:

### Sidebar (injected into LinkedIn inbox)
- **CRM tab** on the right edge — click to expand/collapse
- **Deal stage selector** — 7 customisable stages: New Lead → Contacted → Interested → Meeting Set → Proposal → Won → Cold
- **Persistent notes** — free-text notes per conversation, shown every time the thread is opened
- **Follow-up date picker** — set a date; browser notification fires at 9am that morning
- **Context on open** — if a thread has saved data, the sidebar auto-opens so the rep sees their notes immediately
- **Save button** — one click to commit changes to local storage

### Pipeline Popup (extension icon)
- All tracked deals grouped by stage
- Overdue follow-ups flagged in red
- Filter by Active / Won / Cold / All
- Click any deal card to jump directly to that LinkedIn thread

### Data & Privacy
- All data stored in `chrome.storage.local` — never leaves the browser
- No account, no login, no server
- Zero third-party data sharing

---

## Full Product Roadmap

### Phase 2 — Power Features (3–6 months)

| Feature | Why it matters |
|---|---|
| **Stage badge on inbox list** | Visual at-a-glance status for every conversation without opening it |
| **Full-page Kanban board** | Drag deals between stages in a dedicated tab, like a Trello for LinkedIn |
| **Weekly stats digest** | Messages sent, follow-ups completed, stage conversion rates — helps reps self-coach |
| **CSV export** | Let reps extract their pipeline data for reporting or import into a CRM |
| **Custom stages** | Let users rename, reorder, and colour-code their own pipeline stages |
| **Search & filter in popup** | Find any contact by name, company, or note keyword |
| **Connection request analytics** | Acceptance rate by template, time of day, persona — helps optimise top-of-funnel |

### Phase 3 — Team & CRM Tier (6–12 months)

| Feature | Why it matters |
|---|---|
| **HubSpot sync** | One-click push of contact + notes + stage to HubSpot deals |
| **Pipedrive sync** | Same for Pipedrive — strong overlap with SMB sales teams |
| **Salesforce sync** | Required for enterprise adoption |
| **Shared team pipeline** | Manager can see rep activity; reps can see each other's accounts to avoid double-outreach |
| **Manager dashboard** | Web app showing team pipeline health, follow-up compliance, stage velocity |
| **Slack notifications** | Alert team when a deal moves to "Meeting Set" or "Proposal" |

### Phase 4 — AI Features (use sparingly, cost-efficiently)

| Feature | AI cost | Why it matters |
|---|---|---|
| **Icebreaker generator** | 1 call per new lead | Writes a personalised first line using prospect's recent posts and job data |
| **Reply suggestions** | 1 call per incoming message | 3 tone options: casual / value-led / meeting-focused |
| **Auto-note from conversation** | 1 call on demand | Summarises the last 10 messages into a 3-bullet deal summary |
| **Prospect research digest** | 1 call per profile | Company funding, news, tech stack, mutual interests in 5 bullets |

---

## Pricing Strategy

| Tier | Price | Who it's for |
|---|---|---|
| **Free** | $0 | Solo reps, early adopters — full sidebar, stages, notes, reminders, local storage only |
| **Pro** | $12/mo | Individual reps who want CRM sync, Kanban board, stats, and CSV export |
| **Team** | $25/user/mo | Sales teams who need shared pipeline, manager dashboard, and Slack alerts |

**Rationale:** Kondo charges $28–36/mo for inbox organisation alone. Undercutting on price while offering more sales-specific value (deal stages, pipeline view) is the acquisition wedge. Free tier drives installs; Pro converts power users.

---

## Key Technical Decisions

- **Manifest V3** — required for Chrome Web Store, future-proofed
- **No build step** — vanilla JS + CSS, zero dependencies, fast iteration
- **`chrome.storage.local`** — offline-first, no login friction on day one
- **`MutationObserver` for SPA navigation** — LinkedIn is a React SPA with no real page loads between threads; URL change detection is the only reliable trigger
- **CSS namespacing (`plcrm-` prefix)** — prevents style conflicts with LinkedIn's own CSS which changes frequently
- **Sidebar appended to `document.body`** — not injected into LinkedIn's DOM tree, so LinkedIn UI updates don't break the extension
- **Page title for contact name extraction** — LinkedIn's DOM class names change often; the browser title (`"Name | LinkedIn"`) is stable

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LinkedIn changes their DOM and breaks selectors | Name extraction has 4 fallback methods; core functionality (save/load by thread ID) works regardless of name extraction |
| LinkedIn bans the extension | Tool is passive — it reads, it doesn't automate. No connection requests, no bulk messaging. Much lower risk than automation tools |
| Kondo copies the deal stage feature | First-mover advantage + pricing + distribution. Also: their product direction is inbox organisation, not sales pipeline |
| Users don't convert from free to Pro | CRM sync is a strong forcing function for any rep on a team — managers will require it |

---

*Built with: Chrome Extensions Manifest V3 · Vanilla JS · CSS · `chrome.storage.local`*
*Data: 100% local, never leaves the browser on Free tier*
