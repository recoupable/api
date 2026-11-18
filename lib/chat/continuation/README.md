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
keys fail closed. Limits: complete marker UTF-8 JSON <=1,048,576 bytes, <=2048
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
