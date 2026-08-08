# Browser Agent Runtime

Domain language for a browser-native agent runtime that orchestrates Chrome Built-in AI and page tools as an explicit, observable system — not a single prompt.

## Language

### Runtime

**Agent**:
A goal-oriented execution unit that obtains PageContext, forms a Plan, and runs a Workflow over Tools under Policy — including free-form Conversation turns.
_Avoid_: LLM wrapper, single-prompt bot

**Goal**:
The user's natural-language instruction for the current turn (typed freely or via a suggestion shortcut).
_Avoid_: prompt (alone), query, request

**Plan**:
The concrete ordered list of Steps chosen for a Goal before execution begins.
_Avoid_: strategy, itinerary, recipe

**Step**:
One planned Tool invocation within a Plan, optionally depending on earlier Steps.
_Avoid_: action, task, node, operation

**Workflow**:
A known sequence shape (template or conversational Plan) that realizes a Goal through ordered Tool use.
_Avoid_: pipeline, script, automation, playbook

**Result**:
The outcome of a successful run — structured fields for known Workflows, or a conversational `reply` string for free-form turns.
_Avoid_: completion (alone)

### Tools and constraints

**Tool**:
A named, invocable unit an Agent can call, declaring required Capabilities and expected input/output shape.
_Avoid_: function, action, API, adapter

**Capability**:
A runtime-detectable feature (Built-in AI or browser ability) that must be available before a Tool may run.
_Avoid_: feature flag, API, model, provider

**Policy**:
Rules that constrain which Tools and data movements an Agent is allowed to perform.
_Avoid_: permission, guardrail, ACL, allowlist

**Validator**:
A check that an output satisfies an expected contract before the run accepts it as Result or intermediate state.
_Avoid_: sanitizer, assertion, linter

**dataBoundary**:
The declared processing locus for an operation: on-device local, browser-mediated, or external.
_Avoid_: privacy tier, residency, trust level, processing location

### Context and observability

**PageContext**:
The extractable state of the active browser page used as Agent input — content and related page metadata.
_Avoid_: Context (alone), DOM snapshot, page state, scrape

**Trace**:
The user-visible record of high-level Events for a single run.
_Avoid_: log, timeline, history, chain-of-thought, debug dump

**Event**:
A discrete, named milestone in a run that appears in the Trace (for example goal received, plan created, tool completed).
_Avoid_: log line, message, notification, span

### Side panel conversation

**Conversation**:
The multi-turn side-panel thread; prior Messages are passed into the next Goal as `conversationHistory` so free-form replies can stay coherent.
_Avoid_: session log (alone)

**Message**:
One turn in the Conversation — either a user Goal instruction or an assistant Result (with status, optional error, and expandable Runtime Trace).
_Avoid_: post

**Conversational Workflow**:
The default Workflow for free-form Goals that do not match a suggestion template: detect → summarize PageContext → Prompt a `reply` using the user request, conversation history, and page summary.
_Avoid_: open chat mode (as a separate product)

### Languages

**FoundationLanguage**:
A language in the small set supported for foundation-model I/O used by Summarizer and Prompt (`en`, `ja`, `es`, `de`, `fr`).
_Avoid_: model language, summarizer language, prompt language

**TranslationLanguage**:
A language supported by the Translator Capability, a broader set that includes codes (such as `pt`) outside FoundationLanguage.
_Avoid_: target language, locale, BCP-47 code (alone)

**PreferredLanguage**:
The user's chosen language for Agent Result prose in the side panel; may be a FoundationLanguage or a TranslationLanguage (MVP UI: `en`, `ja`, `es`, `de`, `fr`, `pt`). When it is not a FoundationLanguage, the runtime plans or post-processes outbound Translator steps instead of asking Summarizer/Prompt for non-foundation I/O.
_Avoid_: locale, UI language, display language (alone)

### Future composition

**Skill**:
A reusable, inspectable composition of Tools for a recurring intent; not an MVP runtime primitive.
_Avoid_: template, recipe, macro, plugin, package
