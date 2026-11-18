# Held draft: internal valuation-history adapters

This is preparatory source for the existing API #795 / Mono #326 / App #1911
implementation project. It adds no REST route, MCP registration, background job,
production caller or completed-run integration. Existing POST /api/valuation,
measurement reads and public availability remain unchanged. Do not merge or
activate customer persistence until the separate database-access dependency has
independent acceptance and explicit release approval.

## Prepared adapters

The source adapts API #795 head cc0511d0714dec01b2d369ee0fbe819a00881123 to current
catalog ownership rules. Generated types already include catalog_valuations, and
the original Database #52 migration is merged. Neither establishes permission to
activate a new private-data writer. No types/schema/grants/policies are changed.
The detailed access proposal stays in the private release review packet.

- persistCatalogValuation accepts one computed band, catalog ID, measured count
  and streams. It rejects unmeasured/nonfinite/negative/unordered estimates, then
  attempts one insert. It confirms only an acknowledged row ID; a storage failure
  returns false rather than failing the already-computed result or rerunning paid
  measurement. False means unconfirmed, not proof no row exists after response
  loss. This helper is not wired to production and has no retry/deduplication.
- The prepared internal history handler validates credentials, path UUID and
  limit 1–100 (default30), then resolves personal/organization catalog visibility
  through the same current helpers as other catalog reads. Missing/inaccessible
  catalogs return404 without reading history; ownership/storage errors return a
  masked500. No caller-supplied owner ID is accepted. A registered route or
  delegated-client capability is not introduced by this draft.
- The history adapter scopes its query to one catalog and orders by measured_at
  descending, then ID descending for stable ties. Empty history stays an empty
  series, not an estimate of zero. The outward projection includes only low,
  mid, high, measured_song_count, total_streams and measured_at.

Example prepared response (synthetic; not a published/deployed capability):

```json
{
  "status": "success",
  "valuations": [
    { "low": 1000, "mid": 2000, "high": 3000, "measured_song_count": 12,
      "total_streams": 456789, "measured_at": "2026-10-20T00:00:00Z" }
  ]
}
```

## Deliberately unfinished

No existing GET gains side effects. The older check-newest-row-then-insert proposal
cannot guarantee one daily row under concurrency; its atomic design remains
separate. No scheduled capture, report/Attio integration, trend UI, valuation
calibration, backfill or customer file changes are included. These are saved-model
estimate adapters, not audited revenue, verified rights or purchase offers.

The original implementation and product trackers remain open. This held draft
does not replace #795's complete disposition or finish #326 merely by documenting
it. Canonical Marketing/retained Docs must keep the route and persistence pending.
A future activation needs reviewed caller wiring, approved access release,
source/publication parity and an authorized persistence/readback journey. Never
rerun paid work merely because history saving is unconfirmed.

## Verification boundary

Fixtures use synthetic bands, catalog IDs and database rows with mocked clients.
The prepared handler's validator and projection are real in roundtrip cases;
auth/membership/catalog-ownership boundaries use explicit fixtures. Cases cover
auth short-circuiting, inaccessible catalog, organization scope arguments,
membership revocation before reads, stable query ordering, two saved dates,
separate catalog scope, invalid input, masked ownership/storage errors and failed
save acknowledgement. No production customer rows, provider calls, emails,
payments, schema/grant mutations or live valuation were performed. Source tests
are not production database permission or customer-workflow acceptance.
