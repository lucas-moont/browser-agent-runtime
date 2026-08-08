# Prototype Spec — Browser Agent Runtime
## Weekend MVP

> Status: Discovery input / prototype concept
> Audience: AI coding agents performing discovery, architecture, and task decomposition
> Goal: Build a compelling two-day technical prototype, not a production framework.

## 1. Intent

Build a Chrome Extension that demonstrates a small, explicit agent runtime for Chrome Built-in AI.

The central thesis is:

> AI agents should be treated as software systems composed of planning, tools, state, capability detection, and orchestration — not merely as a single prompt.

The prototype should let a user give a natural-language goal about the current browser page and have the runtime plan and execute a small workflow using browser tools and Chrome Built-in AI capabilities.

The prototype should prioritize architectural clarity and observability over feature breadth.

## 2. Primary Demo

A user opens the extension side panel on an arbitrary article/documentation page and enters:

"Analyze this page and create a concise learning path."

The system should:

1. Detect the available browser AI capabilities.
2. Extract relevant page content.
3. Build an execution plan.
4. Select tools for the plan.
5. Execute the workflow.
6. Show high-level execution events in an Agent Trace.
7. Return a structured result.

The UI should make it obvious that the system is an agent runtime rather than a chatbot with one large prompt.

## 3. Prototype Scope

### Must have

- Chrome Extension, Manifest V3.
- TypeScript.
- React-based side panel UI.
- Current-page content extraction.
- Agent runtime with explicit state.
- Tool registry.
- Tool execution abstraction.
- Capability detection.
- At least three Built-in AI tools.
- Agent trace showing high-level workflow events.
- Clear unsupported-capability/error states.
- A small set of predefined demo goals.

### Preferred Built-in AI capabilities

Use capabilities according to their current Chrome availability during discovery. The prototype should favor stable APIs where possible.

Candidate tools:

- `detectLanguage`
- `summarize`
- `translate`
- `prompt`

Writer/Rewriter can be included if the target Chrome/test environment supports them without destabilizing the MVP.

Do not hard-code the assumption that every API is available. Capability detection is part of the prototype.

## 4. Conceptual Architecture

```text
Chrome Extension
│
├── Side Panel UI
│   ├── Goal Input
│   ├── Agent Status
│   ├── Agent Trace
│   └── Result View
│
├── Agent Runtime
│   ├── Planner
│   ├── State
│   ├── Tool Registry
│   ├── Capability Registry
│   └── Workflow Executor
│
├── Browser Tools
│   ├── extractPage
│   └── inspectPageContext
│
└── Built-in AI Tools
    ├── detectLanguage
    ├── summarize
    ├── translate
    └── prompt
```

## 5. Agent Runtime Model

The runtime should conceptually expose:

```ts
type AgentGoal = {
  instruction: string
  context?: unknown
}

type AgentState = {
  goal: AgentGoal
  context: unknown
  plan: AgentStep[]
  outputs: Record<string, unknown>
  events: AgentEvent[]
}

type AgentTool = {
  name: string
  description: string
  capabilities: string[]
  execute(input: unknown, context: ToolContext): Promise<unknown>
}

type AgentStep = {
  id: string
  tool: string
  input: unknown
  dependsOn?: string[]
}

type AgentEvent =
  | "goal_received"
  | "context_collected"
  | "plan_created"
  | "tool_selected"
  | "tool_started"
  | "tool_completed"
  | "validation_completed"
  | "agent_completed"
  | "agent_failed"
```

The exact API is subject to discovery. Do not over-engineer this into a reusable SDK during the weekend.

## 6. Tool Registry

Tools should be registered explicitly rather than embedded inside planner logic.

Example conceptual registration:

```ts
registry.register(extractPageTool)
registry.register(summarizeTool)
registry.register(languageDetectorTool)
registry.register(translatorTool)
```

Each tool should declare:

- name
- description
- required capability
- input shape
- output shape
- execution function

This is important because the runtime should be able to reason about what it can and cannot do.

## 7. Capability Detection

Before executing a workflow, the runtime should determine which capabilities are available.

Examples:

```text
Prompt API: available
Summarizer API: available
Translator API: available
Language Detector API: available
Writer API: unavailable
```

Unavailable tools should not silently fail.

The runtime should either:

1. choose an alternative workflow, or
2. explain that the requested capability is unavailable.

## 8. Planning

For the weekend MVP, avoid building a sophisticated autonomous planner.

A pragmatic planner can combine:

- deterministic intent recognition,
- a small set of workflow templates,
- optional Prompt API assistance for plan generation.

Example:

```text
Goal: Analyze this page and create a learning path.

Plan:
1. extractPage
2. detectLanguage
3. summarize
4. prompt -> identify concepts
5. prompt -> organize learning path
```

The important demonstration is that planning and execution are separate concerns.

## 9. Agent Trace

The UI should show high-level execution state.

Example:

```text
✓ Goal received
✓ Page context collected
✓ Plan created
✓ Language detected: English
✓ Content summarized
✓ Concepts identified
✓ Learning path generated
✓ Agent completed
```

Do not expose private chain-of-thought or hidden model reasoning. Show observable workflow events, selected tools, inputs/outputs at a safe summary level, and errors.

## 10. Demo Workflows

At least three:

### A. Analyze Page

Input:

"Analyze this page."

Output:

- page summary
- key concepts
- detected language
- relevant topics

### B. Learning Path

Input:

"Turn this page into a learning path."

Output:

- prerequisites
- concepts
- ordered learning sequence
- suggested next topics

### C. Translate + Summarize

Input:

"Summarize this page in Portuguese."

Workflow:

```text
detectLanguage
→ summarize
→ translate
```

If the source is already Portuguese, the runtime should avoid unnecessary translation.

## 11. UX Principles

The interface should feel like a developer tool rather than a generic AI chat.

Priorities:

- minimal UI
- strong hierarchy
- visible agent state
- visible tool execution
- useful error messages
- no unnecessary animations
- easy demo flow

The primary visual artifact is the Agent Trace.

## 12. Weekend Constraints

Explicitly avoid:

- authentication
- backend services
- user accounts
- database infrastructure
- multi-user collaboration
- generalized autonomous browsing
- arbitrary computer-use automation
- production-grade plugin architecture
- complicated memory systems
- vector databases
- cloud LLM fallback unless required purely for development/testing

The project should remain small enough to finish in approximately two focused days.

## 13. Success Criteria

The prototype succeeds if:

1. A reviewer can understand the architecture in under two minutes.
2. A user can execute a useful workflow against a real web page.
3. The UI demonstrates explicit tool orchestration.
4. Built-in AI capability availability is detected rather than assumed.
5. The project can be demonstrated without a backend.
6. The README can explain why this is an agent runtime rather than a prompt wrapper.
7. The codebase is clean enough to become the foundation of a second project.

## 14. Intended Follow-up

This runtime is intentionally designed to become infrastructure for a second application:

> Job Analysis Agent

The second project should consume or adapt the runtime rather than duplicate its architecture.

## 15. Discovery Notes

During discovery, the implementation agent should verify:

- current Chrome Stable API availability
- extension-specific API availability
- hardware/model requirements
- permission requirements
- service worker vs side panel responsibilities
- content-script/page extraction constraints
- model download/readiness behavior
- error and unsupported states
- whether Prompt API is appropriate for planning
- whether structured output can be reliably enforced
- current TypeScript typings

Treat the official Chrome documentation as the source of truth for API status and constraints.
