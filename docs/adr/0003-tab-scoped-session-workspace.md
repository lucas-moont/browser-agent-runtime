# ADR 0003 — Tab-scoped side panel + per-open AgentWorkspace session

## Status

Accepted (supersedes [ADR 0002](0002-reusable-agent-workspace-group.md))

## Date

2026-08-09

## Context

ADR 0002 chose one reusable `"Browser Agent"` tab group per window plus a global side panel. In practice:

- The side panel stayed visible when switching tabs (global panel).
- Users had to click **Add current tab**, which often failed or felt redundant.
- The desired Claude-like flow is: open the extension on a tab → that tab is the session → panel is only for that tab → opening again elsewhere starts another session/group.

Chrome supports tab-specific side panels via `sidePanel.setOptions({ tabId, enabled })`. Calling `sidePanel.open()` after `await setOptions()` loses the user-gesture token (`sidePanel.open() may only be called in response to a user gesture`). Using `openPanelOnActionClick: true` with a **disabled global** panel and **per-tab** options avoids `open()` entirely.

## Decision

1. **Tab-scoped panel:** Disable the global panel (`setOptions({ enabled: false })`) and set `openPanelOnActionClick: true`. On `tabs.onActivated` / `tabs.onUpdated`, enable a panel for that `tabId` with `?homeTabId=` in the path (http(s) only). The toolbar click then opens the already-configured tab panel; no `sidePanel.open()` call.
2. **Per-open session group:** `createSession(seedTabId)` always creates a **new** tab group titled `"Browser Agent"` seeded with the home tab (http(s) only). Do not reuse groups by title across Conversations.
3. **No invite button for the home tab:** Opening the extension auto-links the home tab. Extra tabs still join via tools (`openTab` / `searchWeb` / optional future invite).

## Consequences

**Positive:** Panel hides on other tabs; multiple concurrent sessions (one panel instance + group per home tab open); matches “session linked to the tab I opened.”

**Negative:** Orphan groups if the user closes the panel without closing tabs; StrictMode double-mount may recreate a group (tab moves; empty group is destroyed). Global “same conversation across all tabs” is intentionally abandoned.
