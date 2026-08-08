# ADR 0001 — Messaging is a pure protocol; Chrome is an adapter

## Status

Accepted

## Date

2026-08-08

## Context

The weekend MVP must extract page content from the active tab into a side-panel agent runtime (MV3). Chrome’s messaging model is asymmetric and easy to get wrong:

- Extension → content script requires `chrome.tabs.sendMessage` (or `tabs.connect`); `runtime.sendMessage` does **not** deliver to content scripts.
- Content script → extension uses `runtime.sendMessage` / `runtime.connect`.
- Payloads are JSON-serialized; content-script messages must be treated as untrusted and validated.
- Built-in AI must stay in the side-panel (extension page) document; extraction stays in page/content-script context.

HITL locked six TDD seams, including typed Messaging. Research 03 recommends splitting pure protocol concerns from Chrome transport so unit tests do not require a live browser, while still preventing insecure or incorrect cross-context calls.

This boundary is hard to reverse later: once tools, content scripts, and UI all embed `chrome.*` calls and ad-hoc payload shapes, protocol evolution and security review become cross-cutting rewrites.

## Decision

1. The **Messaging** module is **pure protocol + validation only**:
   - Discriminated message types and Zod (or equivalent) schemas.
   - JSON-serializability guards.
   - Allowlists for which types a content script may send and which fields may be sent to a content script (no secrets / privileged data).
   - A pure encode/decode + router (`validated message → handler result`).

2. All Chrome transport and injection sit behind a **Chrome messaging/extraction adapter**:
   - `tabs.sendMessage` for extension → content script.
   - `runtime` messaging for content script → extension.
   - `scripting.executeScript` when programmatic injection is needed.
   - `tabId` / `activeTab` lifecycle handling.

3. Unit tests at the Messaging seam use a **fake transport**. Adapter/integration tests (optional, not required for every TDD cycle) cover live Chrome behavior.

## Consequences

**Positive**

- Protocol and security rules are testable in Vitest without Chrome.
- ToolRegistry page tools depend on Messaging types/ports, not `chrome.tabs` directly.
- Transport mistakes (`runtime.sendMessage` to CS) are confined to one adapter.

**Negative / cost**

- An extra port/adapter layer versus “just call chrome in the tool.”
- Adapter still needs careful integration when `activeTab` grants and async `onMessage` response channels matter.

**Follow-through**

- Documented as TDD seam 6 in `.scratch/browser-agent-runtime/seams.md`.
- Do not put Built-in AI calls in content scripts or the service worker as a workaround for messaging complexity.

## References

- Research 03 — [`.scratch/browser-agent-runtime/research/03-mv3-sidepanel-extraction.md`](../../.scratch/browser-agent-runtime/research/03-mv3-sidepanel-extraction.md) §4
- [Chrome message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [chrome.runtime.sendMessage](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage) (CS delivery restriction)
- Map — TDD seams list in [`.scratch/browser-agent-runtime/map.md`](../../.scratch/browser-agent-runtime/map.md)
