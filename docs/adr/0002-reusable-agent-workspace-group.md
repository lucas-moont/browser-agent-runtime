# ADR 0002 — Reusable AgentWorkspace tab group

## Status

Superseded by [ADR 0003](0003-tab-scoped-session-workspace.md)

## Date

2026-08-08

## Context

The Agent Workspace slice needs a Claude-like Chrome tab group linked to the runtime. Alternatives: (1) one group per Conversation, (2) one reusable named group per window/session, (3) no group — active tab only (status quo).

Research shows `groupId` is session-scoped and empty groups are destroyed. Side-panel Conversations are cleared independently of browsing tabs the user still wants in scope.

## Decision

Use **one reusable AgentWorkspace** per window, titled `"Browser Agent"`, resolved by title (or recreate) via `ensureWorkspace`. Clearing Conversation does not destroy the group. Invite the current http(s) tab on first need if it is not a WorkspaceTab.

## Consequences

**Positive:** Matches Claude-style persistent workspace; user can accumulate tabs across Goals; simpler mental model.

**Negative:** Orphan groups after crashes need manual close or later cleanup; title collisions if the user renames groups; multi-window behavior deferred.
