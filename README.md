# Browser Agent Runtime

A Chrome Manifest V3 extension for **conversational, page-aware agents** backed by an explicit runtime: planning, tools, capability detection, policy, validation, and an observable Agent Trace.

Talk to the agent about the current page in natural language. Suggestion chips are shortcuts; free-form messages use a conversational Workflow (Prompt reply over page context + conversation history). PreferredLanguage controls how Results are returned. Chrome Built-in AI stays on-device in the side panel.

## Architecture

```text
Toolbar action → Side panel (chat + runtime host)
                     │
                     ├─ PreferredLanguage selector → Goal.context
                     ├─ Conversation history → Goal.context.conversationHistory
                     ├─ CapabilityRegistry  → compact readiness strip
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result
                     │     ├─ Planner (templates OR conversational)
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry (page + Built-in AI tools)
                     └─ UI: thread · suggestion chips · composer · Trace under replies
```

- **Side panel** hosts the AgentRuntime ([Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)).
- **Planner**: known suggestion phrasing maps to templates (Analyze / Learning Path / Summarize); anything else → **conversational** Workflow.
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
2. Pick a **PreferredLanguage**.
3. Type freely (“What are the risks?”) or tap a suggestion chip.
4. Read the reply / structured Result; expand **Runtime Trace** if you want the Plan/tool trail.

| Suggestion | Workflow |
| --- | --- |
| **Analyze Page** | detect → summarize → optional concepts |
| **Learning Path** | detect → summarize → structured learning path |
| **Summarize** | foundation summarize (+ outbound translate if needed) |
| *(anything else)* | **conversational** reply over page summary + history |

### Language pipeline

FoundationLanguages for Summarizer/Prompt: `en`, `ja`, `es`, `de`, `fr`. `pt` and other TranslationLanguages use outbound Translator after foundation work — never `Summarizer(outputLanguage: pt)`.

## TDD seams

`AgentRuntime` · `CapabilityRegistry` · `ToolRegistry` · `Planner` · `WorkflowExecutor` · `Messaging`

## Permissions

`sidePanel`, `activeTab`, `scripting` — least privilege for the active tab.

## Follow-up

**Job Analysis Agent** should consume this AgentRuntime (Conversation + tools + Trace) rather than reimplementing it.
