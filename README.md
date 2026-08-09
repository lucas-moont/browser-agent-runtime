# Browser Agent Runtime

A Chrome Manifest V3 extension for **conversational, page-aware agents** backed by an explicit runtime: planning, tools, capability detection, policy, validation, and an observable Agent Trace.

Talk to the agent about the page you opened it on. Suggestion chips send the same kind of message as typing in the composer (no special “mode”). Free-form and chip Goals use a conversational Workflow (Prompt reply over page context + conversation history when page-grounded). **Language → Auto** uses Chrome Language Detector on each message to set PreferredLanguage (manual lock still available).

**Session model (Claude-like):** clicking the toolbar icon opens a **tab-scoped** side panel bound to that tab and creates a **new** Agent Workspace tab group (`Browser Agent`) seeded with it. Switch tabs → the panel hides. Open the extension on another tab → a separate Conversation + group. No “Add current tab” step. Chrome Built-in AI stays on-device in the side panel.

## Architecture

```text
Toolbar action on tab T
  → tab-scoped Side panel (?homeTabId=T)     [hidden on other tabs]
  → createSession(T) → new "Browser Agent" group
                     │
                     ├─ Language: Auto (detect from message) or lock → Goal.context.preferredLanguage
                     ├─ Conversation history → Goal.context.conversationHistory
                     ├─ CapabilityRegistry  → compact readiness strip
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result
                     │     ├─ Planner (conversational; intent branches)
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry (page + workspace + Built-in AI tools)
                     └─ UI: session workspace strip · thread · chips · composer · Trace
```

- **Side panel** hosts the AgentRuntime ([Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)); each open is a distinct instance for its home tab ([ADR 0003](docs/adr/0003-tab-scoped-session-workspace.md)).
- **Planner**: every Goal is **conversational**; intent branches (general chat / page-grounded / web research) choose Steps. Chips only supply the instruction string.
- **Messaging**: pure protocol + Zod; Chrome transport is an adapter ([ADR 0001](docs/adr/0001-messaging-pure-protocol.md)).
- **Agent Workspace**: per-open group via `createSession` (ADR 0003 supersedes the reusable-group approach in [ADR 0002](docs/adr/0002-reusable-agent-workspace-group.md)).
- Expand **Runtime Trace** on any assistant turn to see orchestration Events.

Domain language: [`CONTEXT.md`](CONTEXT.md).

## Setup

```bash
npm install
npm run build
```

Load unpacked `dist/` from `chrome://extensions` (Developer mode). Dev: `npm run dev`. Tests: `npm test`.

### Chrome Built-in AI

Requires Summarizer / Translator / Language Detector / Prompt on a supported device:

- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)
- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started)

The Capabilities strip shows `available` / `downloadable` / `downloading` / `unavailable`. Free-form chat needs **Prompt**.

## How to use

1. Open an **http(s)** article/docs page and click the extension icon (tab-scoped panel + new Browser Agent group for that tab).
2. Leave **Language** on **Auto** (detects from your message) or lock a PreferredLanguage.
3. Type freely (“What are the risks?”) or tap a suggestion chip (same as sending that text).
4. Read the reply; expand **Runtime Trace** if you want the Plan/tool trail.
5. Switch tabs to hide this panel; open the extension again on another tab for a **separate** session.

| Suggestion | Sent as |
| --- | --- |
| **Analyze Page** | `Analyze this page.` |
| **Learning Path** | `Turn this page into a learning path.` |
| **Summarize** | `Summarize this page.` |
| *(typed message)* | your text |

### Language pipeline

FoundationLanguages for Summarizer/Prompt: `en`, `ja`, `es`, `de`, `fr`. `pt` and other TranslationLanguages use outbound Translator after foundation work — never `Summarizer(outputLanguage: pt)`.

## TDD seams

`AgentRuntime` · `CapabilityRegistry` · `ToolRegistry` · `Planner` · `WorkflowExecutor` · `Messaging`

## Permissions

`sidePanel`, `scripting`, `tabGroups`, plus `host_permissions` for `http://*/*` and `https://*/*` so page extraction works from side-panel clicks (`activeTab` alone does not apply there). Per-tab side-panel options are synced on tab activate/update; the action click opens that **tab-specific** panel (see [ADR 0003](docs/adr/0003-tab-scoped-session-workspace.md)). Restricted URLs (`chrome://`, Web Store, etc.) cannot seed a workspace.

## Follow-up

**Job Analysis Agent** should consume this AgentRuntime (Conversation + tools + Trace) rather than reimplementing it.

## Docs maintenance

On **major product / UX / architecture** changes, update this README and the local [`LINKEDIN_POST.md`](LINKEDIN_POST.md) (gitignored narrative) in the same change set — not as a follow-up chore.
