# Product Vision Spec — Browser Agent Runtime
## From Weekend Prototype to Product

> Status: Living product direction (updated to match the conversational + workspace product we are shipping)
> Audience: AI coding agents performing discovery, architecture, and product decomposition
> Relationship: Evolves the weekend Browser Agent Runtime into a reusable agent platform.
> Domain language: [`CONTEXT.md`](CONTEXT.md) · Weekend MVP: [`01-browser-agent-runtime-weekend.md`](01-browser-agent-runtime-weekend.md)

## 1. Product Thesis

Turn Chrome Built-in AI capabilities and browser context into a reusable, observable agent runtime for **browser-native conversation** — not a single prompt, and not a cloud chatbot wrapper.

The product should make it easy to define:

- goals
- tools
- capabilities
- workflows / plans
- policies
- state
- validation
- fallbacks

without coupling the application to a single model or a single AI API.

The long-term abstraction is:

```text
Goal
 ↓
Context (page + AgentWorkspace + conversation history)
 ↓
Planner (intent → Plan)
 ↓
Policy
 ↓
Tool Selection
 ↓
Execution
 ↓
Validation
 ↓
Memory / State
 ↓
Result (conversational reply by default)
```

### What changed from the original vision

Early drafts centered on **deterministic demo Workflow templates** (Analyze / Learning Path / Summarize) as the main product surface, with chat as an add-on.

What we are building now centers on:

1. **Conversation first** — every user turn is a Goal; the default Workflow is conversational.
2. **Chips are messages** — suggestion chips send ordinary instruction text (GPT-style), not modes or locked templates.
3. **Agent Workspace** — a reusable Chrome tab group (`Browser Agent`) is the browsing scope, not “whatever tab happens to be active.”
4. **Intent-branched planning** inside one conversational Workflow (general chat / page-grounded / web research), instead of routing phrases into separate template Workflow ids.
5. **Language Auto** — PreferredLanguage can follow the user’s message via Language Detector, with an optional manual lock.

Deterministic templates, workflow studio, and named Skills remain valid **later** platform ideas. They are no longer the primary UX story.

## 2. Product Positioning

Primary experience: a **conversational side panel** over an **Agent Workspace** — users ask for what they want in natural language, in their PreferredLanguage, across multiple turns and tabs.

The differentiator is still the **runtime architecture** under that chat surface: Goals become Plans over Tools, Capabilities are detected (not assumed), Results are validated, and a Runtime Trace remains inspectable.

Positioning:

> A browser-native conversational agent powered by an observable local runtime — Chrome Built-in AI + page/workspace tools, not a cloud chatbot wrapper.

And:

> Chat when you want answers; expand the Trace when you want to see the system.

And:

> The workspace is where the agent reads and gathers pages; the conversation is where you steer it.

## 3. Target Users

Primary:

- frontend engineers experimenting with browser AI
- AI engineers building lightweight agents
- developer-tool builders
- teams building privacy-sensitive browser workflows

Secondary:

- power users doing research / learning on the open web
- researchers
- internal enterprise tooling teams

## 4. Core Product Concepts

Align names with [`CONTEXT.md`](CONTEXT.md).

### Agent

A goal-oriented execution unit that obtains context, forms a Plan, and runs Tools under Policy.

### Goal

The user’s natural-language instruction for the current turn — typed or sent via a suggestion chip (same path).

### Tool

A typed capability an agent can invoke (page extract, workspace ops, Built-in AI, search, …).

### Capability

A runtime-detectable feature such as Summarizer, Translator, Prompt, Language Detector, or a browser API.

### Workflow / Plan

A sequence of Steps realizing a Goal. **Today the shipped default is always conversational**, with intent selecting Steps. Named deterministic Workflows remain a platform option, not the chat UX.

### Policy

Rules controlling what an agent is allowed to execute.

### Context

Page content (and multi-tab workspace extracts), selected text, metadata, user-provided input, conversation history, and application state.

### Conversation

Multi-turn side-panel dialogue. Each user message is a Goal; prior turns travel as `conversationHistory`. Clearing Conversation does not destroy the Agent Workspace.

### Agent Workspace

The agent-linked Chrome tab group and its membership — the browsing scope the Agent may manage (list / open / navigate / close) and extract PageContext from. See [ADR 0002](docs/adr/0002-reusable-agent-workspace-group.md).

### Memory

Persistent state intentionally retained between tasks (beyond in-session conversation history).

### Trace

An observable record of execution events under each assistant turn.

### Validator

A component that checks whether an output satisfies the expected contract.

### PreferredLanguage

Language for Result prose. Auto (detect from message) or locked. Non-foundation languages use outbound Translator after foundation Summarizer/Prompt work.

## 5. Tool System

The product should eventually support a typed tool contract:

```ts
interface AgentTool<TInput, TOutput> {
  name: string
  description: string
  inputSchema: Schema<TInput>
  outputSchema: Schema<TOutput>
  capabilities: Capability[]
  dataBoundary: 'LOCAL' | 'BROWSER' | 'EXTERNAL'
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
```

Tool categories that matter for the current product shape:

- page extraction (single tab)
- workspace multi-page extraction
- workspace tab management (list / open / navigate / close)
- language detection
- summarization
- translation
- prompt / structured reply
- web search (open SERP in workspace; Built-in AI has **no** native web grounding)

Later categories:

- DOM inspection
- rewriting / classification
- document generation / export
- user confirmation
- storage
- external APIs (explicit EXTERNAL boundary)

## 6. Planning Modes

Support multiple planning strategies over time:

### Conversational intent planning (shipped direction)

One conversational Workflow. Heuristics (and later model-assisted routing) choose a Plan branch:

| Intent | Typical Plan shape |
| --- | --- |
| General chat | detect → Prompt reply (no page summarize) |
| Page-grounded | detect → summarize PageContext → Prompt reply |
| Web research | `searchWeb` → extract SERP → Prompt over truncated raw results |

Suggestion chips do **not** select a planning mode; they only supply Goal text. Page-ish chip phrasing (“Summarize this page.”) naturally hits the page-grounded branch.

### Deterministic workflows (platform, not primary UX)

Known Workflow ids, predictable structured Results — useful for Skills, Job Agent pipelines, and evaluation fixtures. Not how chat suggestions work.

### LLM-assisted planning

Model proposes a plan from available tools (future).

### Hybrid planning

Deterministic guardrails + model-selected steps (future).

### Human-in-the-loop

Agent pauses for user approval before sensitive actions (future).

Favor predictable, inspectable execution when possible. Prefer **reply quality and honesty** (especially for research: use SERP text; do not invent citations) over template theater.

## 7. Capability-Aware Execution

Every Plan should be evaluated against current capabilities.

Example:

```text
Required:
- summarize
- translate
- prompt

Available:
- summarize ✓
- translate ✓
- prompt ✓

Plan accepted.
```

If capabilities are missing:

```text
Primary plan unavailable.

Surface a clear failure (or a degraded alternative when one exists).
```

The runtime should make capability degradation explicit in the UI strip and Trace — never silently pretend Prompt or Summarizer ran.

## 8. Validation

Agent outputs should not automatically be considered correct.

Introduce validators for:

- schema compliance (e.g. conversational `{ reply }`)
- required fields
- content completeness
- confidence thresholds
- safety/policy requirements
- deterministic business rules

Example:

```text
Agent output
    ↓
Schema Validator
    ↓
Content Validator
    ↓
Policy Validator
    ↓
Accepted / Retry / Escalate
```

## 9. Human-in-the-Loop

Allow workflows to pause:

```text
Agent
 ↓
Proposed action
 ↓
User approval
 ↓
Tool execution
```

Examples:

- exporting a document
- modifying page content
- sending external data
- calling an external service
- applying generated changes
- closing many workspace tabs

## 10. Memory

Start with explicit, inspectable memory rather than opaque autonomous memory.

Near-term layers (some already present):

- conversation history (in-session)
- Agent Workspace tab membership (browsing scope across Goals)
- PreferredLanguage Auto vs lock + last detected language

Later layers:

- task state
- user preferences
- reusable skill / workflow state

Memory should be scoped and deletable. Conversation clear ≠ workspace destroy.

## 11. Observability

The Agent Trace should evolve into a developer-grade observability system.

Potential event model:

```text
agent.started
planner.completed
tool.started
tool.completed
validator.failed
retry.started
human.approval_requested
agent.completed
```

For each event, capture safe metadata:

- duration
- tool name
- status
- capability
- token/model metadata where available
- input/output size
- error category

Never expose private chain-of-thought. The chat bubble shows the Result; Trace shows the system.

## 12. Evaluation

Introduce repeatable evaluation datasets.

For each intent / skill:

```text
Input Goal (+ optional page/SERP fixture)
Expected structure (usually reply)
Expected behavior (page-grounded vs research vs chat)
Actual result
Validation score
Latency
Failure mode
```

This enables comparison between:

- local model execution
- cloud fallback
- different prompt strategies
- different Plan branches
- single-tab vs multi-tab workspace context

## 13. Hybrid AI

A production-oriented architecture may use local Built-in AI as the first execution path and an optional cloud fallback when the user explicitly permits it.

```text
Request
 ↓
Capability Check
 ↓
Local AI available?
 ├─ yes → local execution
 └─ no → policy check
           ↓
      optional cloud fallback
```

Cloud fallback must never be introduced as an invisible behavior.

The user should understand where content is processed.

## 14. Privacy Model

Privacy should be a first-class product concern.

Every tool should declare its data boundary:

```text
LOCAL
BROWSER
EXTERNAL
```

The UI should be able to explain:

> This operation is running locally in Chrome.

or:

> This operation requires sending page content to an external service.

Web search that opens a SERP in the browser remains **BROWSER**-mediated gathering for a **LOCAL** Prompt step — still not silent cloud LLM grounding unless the user opts into EXTERNAL.

## 15. Workflow Builder

A mature product could provide a visual workflow editor for **Skills** and deterministic pipelines:

```text
[Workspace pages]
   ↓
[Detect Language]
   ↓
[Summarize]
   ↓
[Prompt / structured extract]
   ↓
[Validate]
   ↓
[User Approval]
   ↓
[Export]
```

Developers could export workflows as TypeScript definitions.

This complements conversation; it does not replace the side-panel chat as the default UX.

## 16. Agent Skills

Introduce reusable skills as higher-level compositions of tools — inspectable Plans, not hidden “modes.”

Examples:

- Research Topic (workspace search + SERP-grounded reply)
- Summarize Workspace Pages
- Analyze Job Posting
- Create Technical Report
- Translate + Summarize
- Compare Two Workspace Tabs
- Extract Structured Data

Until Skills exist as first-class objects, **suggestion chips are only preset Goal strings**. A chip must never lock the Conversation into a special mode.

## 17. Security and Trust

The product should assume web content (and SERP text) can be adversarial.

Long-term requirements:

- prompt-injection resistance
- tool permission boundaries
- origin restrictions
- user confirmation for side effects
- external-data disclosure controls
- content sanitization
- least-privilege extension permissions

Never let arbitrary page content silently redefine system-level agent policy.

## 18. Developer Experience

The long-term project should feel like a small SDK/platform.

Potential package structure:

```text
packages/
├── agent-runtime
├── tool-registry
├── capability-detection
├── workflow-engine
├── validators
├── tracing
└── chrome-ai-adapters

apps/
├── browser-agent
├── workflow-studio
└── examples
```

Provide examples rather than requiring users to understand the entire framework.

Seams that already matter in the prototype: `AgentRuntime`, `CapabilityRegistry`, `ToolRegistry`, `Planner`, `WorkflowExecutor`, messaging adapters, Agent Workspace adapter.

## 19. Product Examples

### Conversational Research Agent (near-term flagship)

User chats in the side panel → Agent Workspace holds relevant tabs → page-grounded or `searchWeb` Plans → reply grounded in extracts / SERP text → Trace inspectable.

### Learning / Study Agent

Page or workspace notes → conversational learning path, quizzes, or explanations — driven by Goals, not a separate Learning Path mode.

### Job Agent

Job posting (workspace tab) → requirements → candidate evidence → gap analysis → rewrite suggestions — consuming the same runtime.

### Documentation Agent

Documentation tabs in the workspace → extract APIs → examples → structured reference.

### Technical Report Agent

Web content in workspace → analysis → report → PDF/export.

## 20. Non-Goals

Do not become:

- a general-purpose autonomous browser computer-use system
- a replacement for cloud frontier models
- an opaque cloud chatbot with no inspectable Plan/Trace
- a browser automation framework (Selenium-style)
- an opaque autonomous agent that acts without user control
- a product whose suggestions open hidden “modes” disconnected from ordinary messages

Being **conversational** is in-scope. Being a **generic ungrounded chatbot** (no page/workspace tools, no capability model, no Trace) is not.

The product should remain focused on **observable, composable, browser-native agents** — conversation on top of an explicit runtime and workspace.

## 21. Long-Term Success Criteria

The product should eventually demonstrate:

1. Multiple reusable tools (page, workspace, Built-in AI, search).
2. Conversational UX with intent-aware Plans (and optional deterministic Skills).
3. Capability-aware execution.
4. Local-first AI execution.
5. Explicit cloud fallback policies.
6. Typed outputs and validation.
7. Human approval gates.
8. Persistent but inspectable memory (conversation + workspace + preferences).
9. Evaluation and observability.
10. Reusable skills that compose Tools without mode lock-in.
11. Strong developer experience.
12. A clear privacy model (`LOCAL` / `BROWSER` / `EXTERNAL`).

## 22. Relationship to the shipped prototype

The prototype is no longer “three demo buttons that run templates.” The **product UX is conversational + workspace-scoped**:

| Area | Shipped direction |
| --- | --- |
| Surface | Side-panel Conversation (composer + suggestion chips) |
| Goal path | Chip click ≡ send that instruction as a message |
| Workflow | Always `conversational`; intent branches choose Steps |
| Scope | Agent Workspace tab group (`Browser Agent`), multi-tab extract |
| Language | PreferredLanguage Auto (detector) or lock; outbound translate when needed |
| Research | `searchWeb` + raw truncated SERP extract (no Built-in web grounding) |
| Observability | Runtime Trace under each assistant turn |
| Result | Conversational `{ reply }` (legacy structured Result schemas may remain for older Workflow ids) |

Still do not prematurely implement:

- workflow studio
- persistent memory beyond conversation history + workspace membership + language prefs
- cloud fallback
- complex evaluation harness
- SDK packaging / monorepo split
- advanced security hardening
- multi-agent collaboration
- Skills as separate runtime modes

Core hypothesis (still true, sharpened):

> Browser pages (in an Agent Workspace) provide context, Chrome Built-in AI provides local model capabilities, and an explicit runtime orchestrates both as tools — behind a conversational surface where every suggestion is just a message.

## 23. Discovery Instructions for Future Agents

When turning this document into implementation specifications:

1. Separate currently supported Chrome APIs from experimental APIs.
2. Verify extension availability and current Chrome version requirements.
3. Identify APIs that require origin trials or developer previews.
4. Design adapters so experimental APIs can be isolated.
5. Avoid coupling the runtime to Gemini Nano-specific semantics.
6. Prefer Web Platform/browser abstractions where practical.
7. Treat local/cloud execution as separate providers.
8. Define typed contracts before implementation.
9. Define security boundaries before adding autonomous actions.
10. Keep every major capability independently testable.
11. Treat Agent Workspace as first-class context (not a UI-only convenience).
12. Never reintroduce suggestion → template-mode routing unless the product explicitly reopens that decision.
13. Remember Built-in AI has no native web grounding — research Plans must gather browser-visible evidence (e.g. SERP extract).
14. Prefer updating [`CONTEXT.md`](CONTEXT.md) when introducing new domain nouns.
