# Pack candidate adapter compatibility

## Scope and state

CD03 follow-up to the [model readiness review](2026-10-30-pack-model-readiness.md), based on API main `571f0c2aaf6858e512ed2ef71d537c116f6c37e5` (PR #1204). This change supplies unwired Gemini audio and Luna text/image adapters. No production caller imports either candidate. There is no activation flag, default model resolver, credential lookup, account access, provider execution, price change or new charge.

The adapters require an explicitly supplied model object. Runtime checks constrain the model ID and direct SDK transport. A Gateway model, OpenAI Responses model, or another model is rejected before invocation. Direct SDK serialization evidence does not qualify Gateway routing or either provider account.

## Contracts

- Gemini accepts already authorized audio bytes, a caller-supplied analysis prompt, recording duration and clip length. The future caller must retain the existing ownership, snapshot hash, decoded-media validation, quote assertion and persisted `analyzing` state before invoking it. URLs are not accepted by this adapter.
- The inline candidate conservatively caps audio at 10 MiB and the prompt at 12,000 characters, leaving room for base64 and JSON within Google's [20 MB total inline request limit](https://ai.google.dev/gemini-api/docs/audio). It accepts a documented MIME subset; `audio/x-wav` needs normalization upstream and `audio/mp4` needs separate format qualification. Larger recordings need a separately qualified upload or media preparation path. Neither is silently transformed or uploaded here.
- Gemini uses `thinkingLevel: low`, omits thought output, and bounds total output at 2,048 tokens. This is a candidate evaluation setting, not a proven adequate allowance or a quoted price. It must be included in any later approved configuration and cost qualification.
- Both the existing Flamingo path and candidate use `parsePackAudioAnalysis`: descriptive non-placeholder observations, existing length limits and an excerpt start within the supplied duration. The shared extraction preserves fenced JSON handling and existing error behavior. Saved context validation reuses the extracted text schema. The existing uncertain-attempt guard remains in `preparePackProduction`; no automatic candidate fallback is introduced.
- Luna uses explicit `reasoningEffort: none` with `forceReasoning: true`. The installed OpenAI SDK does not recognize GPT-6 automatically; the override causes the output limit to serialize as `max_completion_tokens`, rather than legacy `max_tokens`. Caption and still-inspection limits remain candidate values of 350 and 600. No temperature is sent.
- Luna consumes text and optional actual image bytes. The caller supplies the existing inspection instruction. Its return value is text, not a QA verdict: the existing strict inspection judgment parser and media/audio probes must still run before any asset can pass.
- Both adapters require a normal stop, reject blank/unusable output, use bounded abort signals and disable SDK retries. A parseable truncated response is still rejected. Errors are not evidence that the provider performed no work; reconciliation and any permitted retry remain the caller's responsibility.

## Local evidence

Tests exercise the real installed `ai` 6.0.190, `@ai-sdk/google` 3.0.79 and `@ai-sdk/openai` 3.0.65 serializers through synthetic HTTP responses and injected fetch functions. Fixtures contain no customer media or credentials. They verify inline audio/image encoding, thinking/reasoning settings, output limits, finish reasons, invalid analysis and excerpt bounds, model/transport rejection, and one attempt after a 503. Existing analysis-readiness, quote-configuration and model-isolation regressions verify the active path and approved digest remain unchanged.

This proves local request shape and response handling only. It does not prove current provider acceptance, account availability, commercial/data terms, meaningful audio understanding, visual QA quality, latency, spend or customer outcome.

## Next qualification

Before activation: qualify the selected account and data terms; verify current upstream request acceptance and representative audio/caption/still fixtures under separate authorization; measure thinking/output use and costs; bind the approved route/settings/pricing into a new immutable execution configuration; preserve uncertain-attempt reconciliation; and obtain a newly approved quote when configuration changes. Keep the old route until those gates are met. No candidate is wired into production in this PR.
