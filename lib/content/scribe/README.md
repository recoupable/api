# Internal Scribe word-timing adapter

Tracks the separate Scribe capability gap in Mono #351. This is a non-routable,
explicit-use adapter, not a shipped customer transcription operation. No REST
handler, MCP registration, skill invocation, background job or flag imports it.
It makes no account-file writes and contains no credit/billing implementation.
Do not connect it to production callers before the exposure gates below.

## Contract

The pinned endpoint is `fal-ai/elevenlabs/speech-to-text/scribe-v2`, using the
existing server-side Fal client. One `audio_url`, optional `language_code` and
`diarize` are accepted. English is not forced; audio-event tagging is explicit.
Arbitrary model overrides, Whisper fields, premium keyterms, arrays and owner
fields are rejected before a provider request. This URL syntax check is not
an authorization, network-destination or recording-ownership check.

The parser retains full transcript, word/spacing/event entries, language and
confidence, including null speaker IDs and null non-word timings allowed by the
provider schema. It requires at least one actual word with finite nonnegative start
and end times; end must not precede start. Missing word timestamps are rejected,
never replaced with zero. Word timings are returned separately with source URL,
pinned model and provider request ID. Timings may overlap between speakers.
An empty/non-speech response requires review rather than a false completed lyric
transcript. Malformed responses preserve a completed provider request ID on the
error for reconciliation. No automatic provider fallback or regeneration occurs.

Whisper content transcription and the file-saving Whisper operation are unchanged.
Existing hosted lipsync/audio-driven generation from Mono #348 is unchanged.
Nothing writes `audio/scribe.json`; the agent must explicitly save an approved
result for the exact recording and compare words with the approved lyrics.

## Exposure gates

Before adding a REST/MCP caller, define and implement:

- authenticated billing owner and access to the approved recording; no owner
  supplied by a model or accepted from an unchecked request field;
- allowed audio URL destinations and bounded retrieval/probing for trustworthy
  duration, request size and a maximum cost; caller-declared duration alone is
  insufficient;
- Scribe-specific rate/units, rounding, Recoup margin and credit ceiling; current
  uncharged content transcription is not a billing policy for this new operation;
- credit preflight and retry/reconciliation policy for paid completion, malformed
  output, provider response loss and deduction failure; do not repeat a paid job
  just to repair accounting;
- shared REST/MCP behavior, explicit paid tool policy and OAuth scope tests, public
  contracts and released skill guidance.

Existing image/video credit accounting is a reference, not proof that those unit
prices or optional receipt/reservation adapters apply to Scribe. No migrations,
new credentials or spending authorization are part of this adapter change.

## Verification

All provider interactions in tests are mocked and real fetch is forbidden in
adapter tests. Fixtures follow the documented list schema; they are synthetic,
not a captured successful provider response. Fal's illustrative JSON currently
renders `words` as an object despite declaring `list<TranscriptionWord>`; the
parser rejects that object and follows the declared list contract.

Primary contracts read October 20, 2026:
- https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/elevenlabs/speech-to-text/scribe-v2
- https://fal.ai/models/fal-ai/elevenlabs/speech-to-text/scribe-v2/api
- https://elevenlabs.io/docs/overview/capabilities/speech-to-text

No live Scribe accuracy, singing alignment, production availability, customer
billing or final-film synchronization claim follows from these mocked tests.
A bounded authorized recording test and film inspection remain separate.
