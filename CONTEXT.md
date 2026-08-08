# Browser Agent Runtime

Domain language for a browser-native agent runtime that orchestrates Chrome Built-in AI and page tools as an explicit, observable system — not a single prompt.

## Language

### Runtime

**Agent**:
A goal-oriented execution unit that obtains PageContext, forms a Plan, and runs a Workflow over Tools under Policy.
_Avoid_: chatbot, assistant, bot, LLM wrapper

**Goal**:
The user's natural-language instruction the Agent is asked to satisfy for the current page.
_Avoid_: prompt, query, request, chat message

**Plan**:
The concrete ordered list of Steps chosen for a Goal before execution begins.
_Avoid_: strategy, itinerary, recipe

**Step**:
One planned Tool invocation within a Plan, optionally depending on earlier Steps.
_Avoid_: action, task, node, operation

**Workflow**:
A known sequence shape (template or resolved Plan) that realizes a Goal through ordered Tool use.
_Avoid_: pipeline, script, automation, playbook

**Result**:
The structured outcome produced when a run completes successfully for a Goal.
_Avoid_: response, answer, reply, completion

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

### Languages

**FoundationLanguage**:
A language in the small set supported for foundation-model I/O used by Summarizer and Prompt (`en`, `ja`, `es`, `de`, `fr`).
_Avoid_: model language, summarizer language, prompt language

**TranslationLanguage**:
A language supported by the Translator Capability, a broader set that includes codes (such as `pt`) outside FoundationLanguage.
_Avoid_: target language, locale, BCP-47 code (alone)

### Future composition

**Skill**:
A reusable, inspectable composition of Tools for a recurring intent; not an MVP runtime primitive.
_Avoid_: template, recipe, macro, plugin, package
