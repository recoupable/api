# Catalog source retention handoff — App2207

This source increment preserves the exact authenticated development producer input
before projection drops it. `prepareCatalogSurface` now returns `sourceEnvelope`
(version, actor, assistant ID, original canonical fingerprint input, surface digest)
as **internal workflow output**. `surface`, SDK snapshots/text and stored UIMessage
parts remain unchanged. The existing wire and prepared-public fixtures remain exact;
tests explicitly reject envelope/run-lineage leakage in both delivery modes.

`prepareCatalogSnapshotRetention` validates scope, immutable source revision 1,
original query/workspace/catalog, exact lineage and source/surface byte digests.
It refuses missing lineage, duplicates and changed/mismatched bindings. This is
integrity checking of server-produced material, not current authorization of rows.
Source versions are original retained catalog/ISRC/date/provider/run/hash/time/value
tuples (`catalog-observation-tuple/v1`), never fabricated Context source UUIDs.
The envelope preserves query, periods, membership, pagination and null corrections.

The actual internal fenced development workflow consumes this envelope after
required assistant persistence and before releasing its captured writer.
`retainCatalogSnapshotStep` is **default off** unless the server environment has
`CATALOG_SURFACE_RETENTION_ENABLED=true`; even then production is refused. No public
request field, tool registration, producer enrollment or environment value is added.
Unfenced legacy delivery is unchanged and never claims retention. The RPC validates
an exact source revision-1 receipt, not a mutable working-state receipt. Denial,
conflict, malformed receipt or transport ambiguity fails without retry/fallback.

The matching Database source-only proposal is
`proposals/catalog-snapshot-handoff-2207/{PROTOCOL.md,proposal.sql}`. It extends the
existing disabled fence and working-surface boundary, stores one immutable source
record per assistant anchor, serializes on the original fence/message locks,
rejects different bytes at the same anchor and prevents subsequent source mutation.
It has **no EXECUTE grants** and its fixed source authorizer **always denies**.
No migration placement/application, registry activation or production setting change.

Prerequisites remain real: qualify a fixed transactional actor/workspace/catalog/
original-observation source authorizer, source-family withdrawal/writer enforcement,
required SQL concurrency/lifecycle tests, fence enrollment/credential boundaries,
and all read/history/text/export/model disclosure paths. A hash or actor field is
not proof of authority; clients cannot submit this envelope through a new route.
The development step must not be enabled before those gates. No SQL was executed
for this change; mocked API conflict tests are not PostgreSQL concurrency proof.

This is the lineage-to-persistence handoff, **not working-surface save/reopen**.
The existing working-surface controls/CAS proposal must later bind to the retained
source record and reauthorize it. The current raw history reader is unchanged.
A failure after message persistence may leave a message without a source receipt;
stream finish, message existence and source retention are distinct outcomes.
No working view is marked saved; no selected Context objects/artifacts, new read
endpoint, latest-source substitution, collector, provider work or public upload.
UI schema-v1/replay/text consumers are unchanged pending root's contract handshake.
