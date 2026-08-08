# Product Vision Spec — Browser Agent Runtime
## From Weekend Prototype to Product

> Status: Long-term product direction
> Audience: AI coding agents performing discovery, architecture, and product decomposition
> Relationship: Evolves the weekend Browser Agent Runtime into a reusable agent platform.

## 1. Product Thesis

Turn Chrome Built-in AI capabilities and browser context into a reusable, observable agent runtime for browser-native workflows.

The product should make it easy to define:

- goals
- tools
- capabilities
- workflows
- policies
- state
- validation
- fallbacks

without coupling the application to a single model or a single AI API.

The long-term abstraction is:

```text
Goal
 ↓
Context
 ↓
Planner
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
Result
```

## 2. Product Positioning

Primary experience: a **conversational side panel** on the current page — users ask for what they want in natural language, in their PreferredLanguage, across multiple turns.

The differentiator is still the **runtime architecture** under that chat surface: Goals become Plans over Tools, Capabilities are detected (not assumed), Results are validated, and a Runtime Trace remains inspectable.

Positioning:

> A browser-native conversational agent powered by an observable local runtime — Chrome Built-in AI + page tools, not a cloud chatbot wrapper.

And:

> Chat when you want answers; expand the Trace when you want to see the system.

## 3. Target Users

Primary:

- frontend engineers experimenting with browser AI
- AI engineers building lightweight agents
- developer-tool builders
- teams building privacy-sensitive browser workflows

Secondary:

- power users
- researchers
- internal enterprise tooling teams

## 4. Core Product Concepts

### Agent

A goal-oriented execution unit.

### Tool

A typed capability an agent can invoke.

### Capability

A runtime-detectable feature such as Summarizer, Translator, Prompt, or a browser API.

### Workflow

A deterministic or partially dynamic sequence of tools.

### Policy

Rules controlling what an agent is allowed to execute.

### Context

Page content, selected text, metadata, user-provided input, conversation history, and application state.

### Conversation

Multi-turn side-panel dialogue. Each user message is a Goal; prior turns travel with the Goal as conversation history so free-form replies stay coherent. Suggestion chips are optional shortcuts into known Workflows.

### Memory

Persistent state intentionally retained between tasks.

### Trace

An observable record of execution events.

### Validator

A component that checks whether an output satisfies the expected contract.

## 5. Tool System

The product should eventually support a typed tool contract:

```ts
interface AgentTool<TInput, TOutput> {
  name: string
  description: string
  inputSchema: Schema<TInput>
  outputSchema: Schema<TOutput>
  capabilities: Capability[]
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
```

Potential tool categories:

- page extraction
- DOM inspection
- selected-text extraction
- summarization
- translation
- rewriting
- classification
- structured extraction
- document generation
- export/download
- user confirmation
- storage
- external APIs

## 6. Planning Modes

Support multiple planning strategies:

### Deterministic workflows

Known workflow, predictable execution.

### LLM-assisted planning

Model proposes a plan from available tools.

### Hybrid planning

Deterministic guardrails + model-selected steps.

### Human-in-the-loop

Agent pauses for user approval before sensitive actions.

The system should favor predictable execution when possible.

## 7. Capability-Aware Execution

Every workflow should be evaluated against current capabilities.

Example:

```text
Required:
- summarize
- translate
- structured generation

Available:
- summarize ✓
- translate ✓
- structured generation via Prompt ✓

Plan accepted.
```

If capabilities are missing:

```text
Primary plan unavailable.

Alternative:
summarize → user confirmation → manual export
```

The runtime should make capability degradation explicit.

## 8. Validation

Agent outputs should not automatically be considered correct.

Introduce validators for:

- schema compliance
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

## 10. Memory

Start with explicit, inspectable memory rather than opaque autonomous memory.

Potential layers:

- task state
- session memory
- user preferences
- reusable workflow state

Memory should be scoped and deletable.

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

Never expose private chain-of-thought.

## 12. Evaluation

Introduce repeatable evaluation datasets.

For each workflow:

```text
Input
Expected structure
Expected behavior
Actual result
Validation score
Latency
Failure mode
```

This enables comparison between:

- local model execution
- cloud fallback
- different prompt strategies
- different workflow designs

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

## 15. Workflow Builder

A mature product could provide a visual workflow editor:

```text
[Page]
   ↓
[Detect Language]
   ↓
[Summarize]
   ↓
[Extract Concepts]
   ↓
[Validate]
   ↓
[Generate Document]
   ↓
[User Approval]
   ↓
[Export]
```

Developers could export workflows as TypeScript definitions.

## 16. Agent Skills

Introduce reusable skills as higher-level compositions of tools.

Examples:

- Research Page
- Summarize Documentation
- Analyze Job Posting
- Create Technical Report
- Translate + Summarize
- Compare Two Pages
- Extract Structured Data

A skill should remain composable and inspectable.

## 17. Security and Trust

The product should assume web content can be adversarial.

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

## 19. Product Examples

### Research Agent

Page → summarize → concepts → learning path → report.

### Job Agent

Job posting → requirements → candidate evidence → gap analysis → rewrite suggestions.

### Documentation Agent

Documentation → extract APIs → examples → structured reference.

### Technical Report Agent

Web content → analysis → report → PDF/export.

## 20. Non-Goals

Do not become:

- a general-purpose autonomous browser computer-use system
- a replacement for cloud frontier models
- a generic chatbot
- a browser automation framework
- an opaque autonomous agent that acts without user control

The product should remain focused on **observable, composable, browser-native agent workflows**.

## 21. Long-Term Success Criteria

The product should eventually demonstrate:

1. Multiple reusable tools.
2. Multiple planning strategies.
3. Capability-aware execution.
4. Local-first AI execution.
5. Explicit cloud fallback policies.
6. Typed outputs and validation.
7. Human approval gates.
8. Persistent but inspectable memory.
9. Evaluation and observability.
10. Reusable skills.
11. Strong developer experience.
12. A clear privacy model.

## 22. Relationship to the shipped prototype

The prototype remains deliberately small, but the **product UX is conversational**:

- chat-style Conversation in the side panel
- PreferredLanguage for Result prose
- free-form Goals → conversational Workflow (Prompt reply + history)
- suggestion chips as shortcuts into Analyze / Learning Path / Summarize templates
- Runtime Trace still inspectable under each assistant turn

Still do not prematurely implement:

- workflow studio
- persistent memory beyond in-session conversation history
- cloud fallback
- complex evaluation
- SDK packaging
- advanced security
- multi-agent collaboration

Core hypothesis (still true):

> A browser page can provide context, Chrome Built-in AI can provide local AI capabilities, and an explicit runtime can orchestrate both as tools — behind a conversational surface.

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
