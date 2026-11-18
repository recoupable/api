# Canonical continuation v1

`X-Recoup-Stream-Continuation: canonical-base-v1` advertises parser capability only.
It grants no identity, history provenance or authority. Server-constructed durable
workflow input records `streamProtocol: canonical-base-v1 | unmarked-v1`.
Missing/unknown stored requirements are unknown, never safe legacy defaults.

A reused assistant emits exactly one start whose messageMetadata.recoupStream is
`{version:1, mode:"continuation", base:{id,role:"assistant",parts,metadata?}}`.
The base is canonical history after verification, never restored native history.
Original payloads inside verified observation parts remain unchanged. Outer start
ID must equal base ID (1..256 characters). Marker/base unknown keys, non-JSON
values, invalid UI parts, raw custom/reasoning-file parts and nested recoupStream
keys in message metadata fail closed. Opaque observation originals, provider metadata
and tool input/output are data: a property named recoupStream there is preserved. Limits: complete marker UTF-8 JSON <=1,048,576 bytes, <=2048
parts, depth <=32, <=50,000 visited values. No truncation or URL fetching.

Every reader (initial, resume, tail and terminal success) first verifies current
ownership, then reads configured World input with resolveData:all and existing
SDK/key hydration. Resolve only the actual legacy tuple or strict fenced wrapper;
match run/account/chat/session and exact runAgentWorkflow identity. Protocol version
is the explicit input enum; this does not admit projection producer identities.
Bound raw/hydrated input to16MiB, depth64 and250,000 values and the overall read to
five seconds. Errors expose neither input nor key material. No stream sniffing.

Unsupported required capability yields409 stream_continuation_upgrade_required.
Unknown/unavailable run evidence yields503 stream_continuation_evidence_unavailable.
Initial post-start failures report admission:"admitted" plus runId; resume failures
report admission:"existing". Neither cancels/restarts the run or reclaims its slot.
Preflight refusal reports admission:"not_admitted", before claims or effects.
Absolute stored event cursors and raw stream bytes are preserved.

App must consume/validate the marker and reset to its canonical base before SDK,
onData or persistence on ordinary sends, snapshots, autoreconnect and manual resume
before advertising capability. Remove only recoupStream; preserve other metadata.
Unmarked fresh/full replay/new ID/late-start and no-start-tail behavior remain App
controls, as do collisions, scope cancellation and errors. Source tests with
synthetic World/effect ports are not hosted retention, deployment or release proof.

The three chat preflights (POST /api/chat, GET /api/chat/{chatId}/stream and
POST /api/chat/runs) opt into this additional allowed request header through
getCorsHeaders. Other published CORS contracts are unchanged. Initial readback
also requires the stored requirement to equal the server-selected requirement.

The disabled fenced reconnect adapter accepts a request, verifies current
ownership, matches the captured original account/chat, then runs the same stored
protocol gate before status, reader/tail or terminal release. It remains disabled;
this change does not grant adapter deployment or database admission.

After start succeeds, a failed/lost placeholder promotion returns409 with
`{status:"error",error:"chat_stream_ownership_lost",admission:"admitted",runId}`.
Admission means the run was created; it does not claim successful streaming,
completed cancellation or absence of effects. The existing single cancellation
attempt remains unchanged, and its success/failure does not alter this response.
Before-start409 claim/existing-stream conflicts explicitly say not_admitted and
never invent a runId. Clients must treat ambiguous bare409 responses as unknown.
