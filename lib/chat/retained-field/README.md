# Retained-field model-input denial (2207)

The existing model consumers now deny the entire invocation when structured
retained-field content is present. They reuse the history gate's reserved-family
recognizer. No messages or tool parts are removed: preserving complete unmarked
tool-call/result pairs avoids silently corrupting the model conversation.
The failure is the existing workflow `FatalError` with only the static message
`Retained-field model input unavailable`. It includes no content, amount, IDs,
source diagnostics or authority details and is not retryable by the workflow.

## Actual callers and boundaries

- `runAgentWorkflow` checks original UI messages in the workflow body before
  conversion and routing. This is not a journaled step and is evaluated again
  when the body replays. It also checks the returned converted messages, each
  iteration's input and every iteration's returned UI/model messages before
  persistence, another iteration or auto-commit's later model work.
- `convertMessagesStep` checks before `convertToModelMessages` can perform I/O.
  Its result is journaled, so this check alone would be insufficient.
- `routeChatModelStep` checks before routing metadata or the Jev evaluator.
- `runAgentStep` checks both model and original UI messages before polling,
  gateway construction and `streamText`, including independently resumed steps.
- `setupChatRequest` checks original messages before `getGeneralAgent` or
  conversion, then converted messages before legacy truncation/config return.
  Its actual callers are Slack's `handleSlackChatMessage` and evaluation's
  `callChatFunctionsWithResult`.
- Slack checks saved `memory.content` before reconstructing UI messages, because
  that reconstruction intentionally drops metadata. Its authenticated API-key
  account and room scope are unchanged. Existing redacted error/idle handling
  remains; no automatic retry is added.
- `getGeneralAgent` checks before account/knowledge/tool setup. Its actual
  `ToolLoopAgent.prepareStep` checks messages and tool results every iteration,
  and checks any tool-chain replacement messages. In the installed SDK this
  runs before prompt conversion/download and provider invocation. Thus a marked
  tool result cannot be sent back to the model on its next call.

No owner/workspace substitution, new authorization input or local approval flag
is introduced. Existing actual server account/session/chat context is passed
unchanged. Cached ready/preparation/disclosure flags never allow marked input.
There is no positive current-source transport, latest lookup, re-key, retention,
expansion, raw-report fallback, public route, grant or activation.

## Qualification

Tests invoke real workflow orchestration/conversion/routing/provider-step entry
points with synthetic effect seams; replay cases supply the already-completed
step outputs that those callers can receive. They are not a claim of live WDK
journal migration or replay against production state. The compiled offline
workflow fixture additionally qualifies marked original input, converted output
and iteration results as actual failed runs. Independently captured journals show
completed conversion and agent-step results followed by workflow resumption,
stream closure and static failure, with no subsequent routing/provider call for
marked conversion and no second provider call for a marked iteration result.

The fixture also re-enqueues each run after it has already failed. The runtime
skips terminal runs, so the unchanged effect trace proves terminal duplicate
delivery is a no-op. It does not prove another execution of the disclosure
assertion. That is distinct from the running workflow's journaled-step completion
and resumption evidence above. Synthetic effect seams remain in place; no live
authorization or existing production journal migration is claimed.

Slack/evaluation tests use their real caller and setup functions with synthetic
account/storage/agent seams. Actual `ToolLoopAgent.generate` tests use the SDK's
`MockLanguageModelV3`: initial marked input causes zero provider calls/downloads;
an unmarked first call that returns a marked tool result stops before the second
provider call. Network is prohibited. No live model, billing, auth, history or
provider request is made.

## Remaining gaps

This qualifies marked message inputs for these callers only. It cannot reconstruct
provenance after another source has already removed all markers or converted the
content to unmarked prose/serialized text. It does not classify independent system
prompts, knowledge content, other model callers, streamed output already emitted,
metadata/export surfaces or already-delivered clients. It does not retract an
already-completed provider call. Early raw/conversion privacy denials in
`runAgentWorkflow` now enter the existing legacy cleanup:
CAS-scoped active-stream clear, one terminal finish before writable closure, and
headless ephemeral-key revocation when present. Unrelated startup failures keep
their prior behavior. Post-bind fenced failures close their stream without legacy cleanup
or release, and a losing fenced bind acquires no cleanup authority. No retry or
account/grant policy is added. Positive
current-authority/publication integration and other disclosure paths remain open.
