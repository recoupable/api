# Controlled get_tasks failures

This restores only the task-read failure outcome from API #297 under Mono #358.
The current standard registered callback let selector rejections escape; the
installed MCP SDK converts such exceptions into text using their original message.
That is not a sanitized replacement for the original controlled error body.

The shared callback now returns `getToolResultError("Failed to fetch tasks")` on
failure, preserving its established text-encoded `{ success: false, message }`
contract without adding a global helper change or logging the raw exception.
The helper does not set the MCP `isError` flag; this repair deliberately retains
that existing JSON contract. Success (including an empty list), input schema and
selector arguments are unchanged. Full OAuth still validates grant/scope/owner
and prepares arguments before reaching the callback. Its authorization failures
retain their own generic `isError` response. Limited OAuth does not expose this tool.

October 25, 2026 offline verification: three new tests fail before the fix,
including actual in-memory MCP SDK exposure of the synthetic internal message.
They pass after the fix and cover both standard registered callback and full
OAuth wrapper, success/empty results, Error/non-Error rejections, revoked grants
and rejected owner overrides. All database leaves are mocked; no live database,
Redis, Slack, task scheduling, credential or provider operation is involved.

Startup/lazy-bot and provider setup residuals from #297 remain separate. This
repair does not close the whole original PR, alter task access policy, claim
production acceptance or restore obsolete bot architecture.
