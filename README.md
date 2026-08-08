# Browser Agent Runtime

A Chrome Manifest V3 extension that runs **agents as software systems** — planning, tools, capability detection, policy, validation, and an observable Agent Trace — on the page you are viewing.

This is **not** a prompt wrapper. A Goal becomes a Plan of Tool steps; the runtime executes that Plan under Policy, records Events in a Trace, and returns a structured Result. The side panel presents a chat-style Conversation (Goals in, Results out) while keeping a collapsible **Runtime Trace** as proof of orchestration. Chrome Built-in AI stays on-device in the side panel; page extraction goes through a typed Messaging protocol.

## Architecture

```text
Toolbar action → Side panel (runtime host)
                     │
                     ├─ PreferredLanguage selector → Goal.context
                     ├─ CapabilityRegistry  → compact readiness strip
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result
                     │     ├─ Planner
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry
                     │     ├─ Page tools     (extractPage, inspectPageContext) → Messaging → content script
                     │     └─ Built-in AI tools (detect / translate / summarize / prompt)
                     └─ UI: Conversation thread · suggestion chips · composer · Trace under Results
```

- **Side panel** hosts the AgentRuntime. Built-in AI APIs must run in an extension page, not the service worker ([Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)).
- **Tools** declare required Capabilities and `dataBoundary` (`LOCAL` for on-device AI, `BROWSER` for page extraction).
- **Messaging** is a pure protocol + Zod validation; Chrome `tabs` / `scripting` transport is an adapter ([ADR 0001](docs/adr/0001-messaging-pure-protocol.md)).
- **Conversation** shows user Goals and assistant Results; each Result can expand its **Runtime Trace** (`goal_received` → `context_collected` → `plan_created` → tool events → `agent_completed` / `agent_failed`).

Domain language lives in [`CONTEXT.md`](CONTEXT.md).

## Setup

```bash
npm install
npm run build
```

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** and select this repo’s `dist/` folder.
4. Pin the extension and open the side panel from the toolbar action.

Development: `npm run dev`, then reload the unpacked extension when CRXJS updates output. Tests: `npm test`.

### Chrome Built-in AI

Demo Goals that call Summarizer / Translator / Language Detector / Prompt need Chrome Built-in AI on a supported device. Follow the official overview and get-started guidance:

- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)
- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started)

Models download on first use. The side-panel **Capabilities** strip probes readiness (`available` / `downloadable` / `downloading` / `unavailable`) instead of assuming APIs exist. If a required Capability is missing, the run fails with an explicit unsupported-capability error.

## Demo the three Goals

Open a real article or docs page, open the side panel, confirm Capabilities, pick a preferred response language, send a Goal (chip or composer), and inspect the Result plus its Runtime Trace.

| Goal | What it shows |
| --- | --- |
| **Analyze Page** | Detect language → summarize → (optional) prompt for key concepts; structured analysis Result |
| **Learning Path** | Summarize then Prompt with a learning-path constraint; structured path Result |
| **Summarize** | Foundation summarize; outbound Translator only when PreferredLanguage is outside FoundationLanguage (e.g. `pt`) |

### Language pipeline

Summarizer and Prompt foundation I/O support a small set of **FoundationLanguages** (`en`, `ja`, `es`, `de`, `fr`). Portuguese (`pt`) is a **TranslationLanguage** via Translator, not a foundation I/O language.

**PreferredLanguage** (header selector) is attached to each Goal as `context.preferredLanguage`. When preferred is a FoundationLanguage, summarize/prompt work in that language and skip outbound translate. When preferred is a TranslationLanguage such as `pt`, the runtime keeps foundation I/O in a working FoundationLanguage (default `en`) and translates Result prose outbound — never `Summarizer(outputLanguage: pt)`.

```text
detectLanguage
  → [if not FoundationLanguage] translate → working foundation (e.g. en)
  → summarize / prompt (foundation I/O)
  → [if PreferredLanguage needs outbound] translate Result prose → preferred
```

## TDD seams

Unit tests target six seams only — Chrome globals sit behind adapters:

1. `AgentRuntime`
2. `CapabilityRegistry`
3. `ToolRegistry`
4. `Planner`
5. `WorkflowExecutor`
6. `Messaging` (pure protocol; fake transport in Vitest)

See [ADR 0001](docs/adr/0001-messaging-pure-protocol.md) for Messaging vs Chrome transport.

## Permissions

Manifest permissions are least privilege for the MVP: `sidePanel`, `activeTab`, and `scripting`. No broad host access; page tools act on the active tab after the user opens the extension.

## Follow-up

This runtime is infrastructure for a second application: **Job Analysis Agent**. That project should consume or adapt this AgentRuntime rather than reimplement planning, tools, capabilities, and Trace.
