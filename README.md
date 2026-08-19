# Browser Agent Runtime

A Chrome Manifest V3 extension for **conversational, page-aware agents** — backed by an explicit runtime (planning, tools, capability detection, policy, validation) and an inspectable **Agent Trace**.

Talk to the agent about the page you opened it on. Suggestion chips send the same kind of message as typing (no special “mode”). Free-form and chip Goals share one conversational Workflow. **Language → Auto** detects PreferredLanguage from each message; you can still lock a language manually.

Chrome Built-in AI stays **on-device** in the side panel.

## Session model

Click the toolbar icon on an **http(s)** tab → a **tab-scoped** side panel opens for that tab and a new **Agent Workspace** group (`Browser Agent`) is seeded with it.

- Switch tabs → the panel hides.
- Open the extension on another tab → a separate Conversation + group.
- Close the panel → session tabs **ungroup** (they stay open). Reopen = fresh Conversation (no persistence).
- No “Add current tab” step — opening the extension *is* the session link.

## Architecture

```text
Toolbar action on tab T
  → tab-scoped Side panel (?homeTabId=T)     [hidden on other tabs]
  → createSession(T) → new "Browser Agent" group
                     │
                     ├─ Language: Auto or lock → Goal.context.preferredLanguage
                     ├─ Conversation history → Goal.context.conversationHistory
                     ├─ CapabilityRegistry  → strip + Download CTA when needed
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result (AbortSignal / Stop)
                     │     ├─ Planner (chat / page-grounded / web research)
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry (page + workspace + Built-in AI)
                     └─ UI: workspace strip · thread · chips · Stop · Trace
  → panel close → endSession → ungroup (tabs remain)
```

- **Planner** branches intent inside one conversational Workflow. Research **rewrites** a concise search query, **fetches** SERP HTML in the background (DuckDuckGo; Google tab only as fallback), and answers **strictly from that evidence**.
- **Side panel** hosts the runtime ([Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in/overview)) — one instance per home tab ([ADR 0003](docs/adr/0003-tab-scoped-session-workspace.md)).
- Expand **Runtime Trace** under a reply to see Plan / tool Events. Use **Stop** to abort in-flight work.

## Setup

```bash
npm install
npm run build
```

Load unpacked `dist/` from `chrome://extensions` (Developer mode). Dev: `npm run dev`. Tests: `npm test`.

Shareable zip (version **1.0.0**):

```bash
npm run pack
```

### Chrome Built-in AI

Needs Summarizer, Translator, Language Detector, and Prompt on a supported device:

- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)
- [Get started](https://developer.chrome.com/docs/ai/get-started)

The Capabilities strip shows readiness. Free-form chat needs **Prompt** `available`. When models are downloadable, use **Download models** before sending.

## How to use

1. Open an **http(s)** article or docs page and click the extension icon.
2. If Prompt is downloadable, click **Download models** and wait until Capabilities show available.
3. Leave **Language** on **Auto**, or lock a PreferredLanguage.
4. Type freely or tap a suggestion chip.
5. While Running, use **Stop** to cancel — or read the reply and expand **Runtime Trace**.
6. Close the panel to ungroup session tabs (they stay open). Reopen for a fresh Conversation.
7. Switch tabs to hide this panel; open again on another tab for a separate session.

| Suggestion | Sent as |
| --- | --- |
| **Analyze Page** | `Analyze this page.` |
| **Learning Path** | `Turn this page into a learning path.` |
| **Summarize** | `Summarize this page.` |
| *(typed message)* | your text |

Summarizer/Prompt foundation languages: `en`, `ja`, `es`, `de`, `fr`. Other languages (e.g. `pt`) use Translator after foundation work.

## Permissions

`sidePanel`, `scripting`, `tabGroups`, plus `host_permissions` for `http://*/*` and `https://*/*` (side-panel clicks do not get `activeTab`). Restricted URLs (`chrome://`, Web Store, etc.) cannot seed a workspace.

## What’s next

A **Job Analysis Agent** should consume this runtime (Conversation + workspace + tools + Trace) rather than reimplementing it.
