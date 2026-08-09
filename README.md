# Browser Agent Runtime

A Chrome Manifest V3 extension for **conversational, page-aware agents** backed by an explicit runtime: planning, tools, capability detection, policy, validation, and an observable Agent Trace.

Talk to the agent about the current page in natural language. Suggestion chips send the same kind of message as typing in the composer (no special “mode”). Free-form and chip Goals use a conversational Workflow (Prompt reply over page context + conversation history when page-grounded). **Language → Auto** uses Chrome Language Detector on each message to set PreferredLanguage (manual lock still available). An **Agent Workspace** Chrome tab group (`Browser Agent`) scopes which tabs are extracted (multi-tab). Chrome Built-in AI stays on-device in the side panel.

## Architecture

```text
Toolbar action → Side panel (chat + runtime host)
                     │
                     ├─ Language: Auto (detect from message) or lock → Goal.context.preferredLanguage
                     ├─ Conversation history → Goal.context.conversationHistory
                     ├─ CapabilityRegistry  → compact readiness strip
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result
                     │     ├─ Planner (conversational; intent branches)
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry (page + Built-in AI tools)
                     └─ UI: thread · suggestion chips · composer · Trace under replies
```

- **Side panel** hosts the AgentRuntime ([Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)).
- **Planner**: every Goal is **conversational**; intent branches (general chat / page-grounded / web research) choose Steps. Chips only supply the instruction string.
- **Messaging**: pure protocol + Zod; Chrome transport is an adapter ([ADR 0001](docs/adr/0001-messaging-pure-protocol.md)).
- Expand **Runtime Trace** on any assistant turn to see orchestration Events.

Domain language: [`CONTEXT.md`](CONTEXT.md). Product direction: [`02-browser-agent-runtime-product.md`](02-browser-agent-runtime-product.md).

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

1. Open an article/docs page and the side panel.
2. Leave **Language** on **Auto** (detects from your message) or lock a PreferredLanguage.
3. Type freely (“What are the risks?”) or tap a suggestion chip (same as sending that text).
4. Read the reply; expand **Runtime Trace** if you want the Plan/tool trail.

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

`sidePanel`, `scripting`, `tabGroups`, plus `host_permissions` for `http://*/*` and `https://*/*` so page extraction works from side-panel clicks (`activeTab` alone does not apply there). Restricted URLs (`chrome://`, Web Store, etc.) cannot be extracted.

## Follow-up

**Job Analysis Agent** should consume this AgentRuntime (Conversation + tools + Trace) rather than reimplementing it.
