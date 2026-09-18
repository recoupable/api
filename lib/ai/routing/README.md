# Auto model routing

Select **Auto · Jev** in the chat model picker (paid plan), or persist `auto` as
`chats.model_id` through the existing session-chat PATCH endpoint. Explicit model
IDs continue to bypass routing. Existing chats and the default model are unchanged.

The durable workflow routes once at the start of each turn, before the first agent
call. Jev evaluates recent conversation text via Vercel AI Gateway and picks from:

| Tier | Gateway model |
| --- | --- |
| Fast | `google/gemini-3.5-flash-lite` |
| Balanced | `moonshotai/kimi-k3` |
| Frontier | `openai/gpt-6-astra` (medium reasoning) |

Confidence below 0.7 escalates to frontier. Attachments also use frontier without
sending their contents to Jev. Only the last eight user/assistant messages' text
is evaluated (6,000 characters per message, 24,000 total); tool results and
reasoning are excluded. This is a bounded classification context, not a full
assessment of the conversation or sandbox. The generation model still gets the
normal full agent context and tools.

The router has a two-second deadline and no automatic retries. Authentication
failures, invalid answers and timeouts use Kimi K3 and display an explicit fallback
explanation. No model IDs supplied by Jev are accepted: its tier maps to the local
allowlist in `routingPolicy.ts`.

`message-metadata` chunks announce selection, then the selected model, source,
reason and confidence. The decision is persisted with the assistant message and
carried through subsequent agent steps, including page reloads. Billing uses the
execution model ID, never `auto`; the reported routing cost seeds the cumulative
Gateway cost so it is included once. Explanations are policy summaries, not model
chain of thought. No savings percentage is inferred.

## Runtime and configuration

Node 22+ is required by the evaluation dependency. Existing `AI_GATEWAY_API_KEY`
or Vercel OIDC authentication is used; no separate TypeSafe key is needed.
`ai-evaluation` aliases `ai@7.0.105` solely for its evaluation API. The main agent
continues to import `ai@6.0.190`, preserving its streaming and tool contracts.

Deploy the API change before the chat change: an older API cannot resolve `auto`.
No database migration is required (model_id is already a string).

## Validation

Run `pnpm test lib/ai/routing app/lib/workflows lib/agent/messageMetadata`.
Live synthetic Gateway checks on 2026-09-18 selected fast for an EP definition,
balanced for a release campaign and frontier for a complex royalty pipeline.
These checks establish model access and the response contract, not production
quality, latency guarantees, or measured savings. Tune the policy against real
workload evaluations before changing the default.

Sources:
- https://vercel.com/docs/ai-gateway/modalities/evaluation
- https://docs.typesafe.ai/introduction/quickstart
