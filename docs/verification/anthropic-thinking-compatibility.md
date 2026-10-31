# General-agent Anthropic thinking compatibility

This is the bounded successor to original API #445, head
`69bcc4aeab5e62bb61da17560b168af3ae66da66`.
The original outcome is model-aware thinking configuration, not a new provider
or an AI SDK major-version migration.

## Result and scope

The general agent previously sent `thinking.type: enabled` with a 12,000-token
budget for every model. For the exact Gateway IDs
`anthropic/claude-opus-4.7`, `anthropic/claude-opus-4.6` and
`anthropic/claude-sonnet-4.6`, it now uses adaptive thinking, summarized thinking
display and medium effort. Adaptive requests omit the manual token budget.
The request's selected model, instructions, tools and stopping rules are unchanged.
OpenAI and Google provider options are unchanged.

All other model IDs retain the previous manual configuration. This preserves
older models' behavior; it does not assert that unknown, newer or alternate-name
models support that configuration. No automatic model-version inference or new
model catalog entry is introduced. This fixes only the general-agent constructor;
it does not promise every other execution path uses these options.

The installed Anthropic SDK already accepts adaptive thinking, summarized display
and medium effort. No dependency, lockfile, default model, credential, billing,
database, MCP capability or worker changes are required.

## Evidence

Anthropic's [thinking compatibility guide](https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting)
documents Opus 4.7's rejection of manual thinking and the older models' differing
support. Its [extended-thinking migration guide](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
describes replacing the manual budget with adaptive thinking and effort. Sources
were checked October 21, 2026; the scope here remains the three original model IDs.

Before implementation, constructor regressions fail for all three selected IDs.
After implementation, tests inspect the actual general-agent settings and pass
the options through the installed Anthropic SDK's real request serializer with
a fake fetch and fixture response. Older model requests retain their manual
budget; unlisted IDs retain the previous options. No provider request, paid model
execution, customer operation or credential inspection is performed. These tests
prove source/serialization behavior, not production provider acceptance, cost,
reasoning quality or response latency. No deployment is implied by a passing test.
