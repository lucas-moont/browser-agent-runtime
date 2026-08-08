# Browser Agent Runtime

A Chrome Manifest V3 extension that runs **agents as software systems** — planning, tools, capability detection, policy, validation, and an observable Agent Trace — on the page you are viewing.

This is **not** a prompt wrapper or a chatbot glued to a tab. A Goal becomes a Plan of Tool steps; the runtime executes that Plan under Policy, records Events in a Trace, and returns a structured Result. Chrome Built-in AI stays on-device in the side panel; page extraction goes through a typed Messaging protocol.

## Architecture

```text
Toolbar action → Side panel (runtime host)
                     │
                     ├─ CapabilityRegistry  → readiness strip (detect, don't assume)
                     ├─ AgentRuntime       → Goal → Plan → Workflow → Result
                     │     ├─ Planner
                     │     └─ WorkflowExecutor
                     ├─ ToolRegistry
                     │     ├─ Page tools     (extractPage, inspectPageContext) → Messaging → content script
                     │     └─ Built-in AI tools (detect / translate / summarize / prompt)
                     └─ UI: Goal chips · Capability strip · Agent Trace · Result
```

- **Side panel** hosts the AgentRuntime. Built-in AI APIs must run in an extension page, not the service worker ([Chrome Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview)).
- **Tools** declare required Capabilities and `dataBoundary` (`LOCAL` for on-device AI, `BROWSER` for page extraction).
- **Messaging** is a pure protocol + Zod validation; Chrome `tabs` / `scripting` transport is an adapter ([ADR 0001](docs/adr/0001-messaging-pure-protocol.md)).
- **Trace** shows high-level Events (`goal_received` → `context_collected` → `plan_created` → tool events → `agent_completed` / `agent_failed`), not a chat transcript.

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

Open a real article or docs page, open the side panel, confirm Capabilities, pick a Goal chip, click **Run**, and watch the Trace then the structured Result.

| Goal | What it shows |
| --- | --- |
| **Analyze Page** | Detect language → summarize → (optional) prompt for key concepts; structured analysis Result |
| **Learning Path** | Summarize then Prompt with a learning-path constraint; structured path Result |
| **Summarize in Portuguese** | Foundation summarize, then Translator to `pt` — never Summarizer/`outputLanguage: pt` |

### Language pipeline

Summarizer and Prompt foundation I/O support a small set of **FoundationLanguages** (`en`, `ja`, `es`, `de`, `fr`). Portuguese (`pt`) is a **TranslationLanguage** via Translator, not a foundation I/O language.

Locked pipeline (option 2):

```text
detectLanguage
  → [if not FoundationLanguage] translate → foundation lang (e.g. en)
  → summarize / prompt
  → [optional] translate Result → pt
```

The Portuguese demo is the proof that the runtime encodes that constraint instead of hoping a single prompt “speaks Portuguese.”

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
