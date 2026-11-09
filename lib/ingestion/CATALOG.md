# Organization datasets in Recoup

Organization imports use the existing Recoup Supabase project and its existing organization membership model. No per-organization database, schema, credentials or new tenant identifier is required. External database delivery is an optional separate operation.

## Storage and ownership

- Bronze originals, silver records, gold artifacts and manifests remain in the existing private ingestion bucket, under `organization/<organization_id>/...`.
- `ingestion_datasets` groups related imports inside one organization. The first import creates a dataset named after the source filename; later imports can explicitly reuse its `dataset_id`.
- `ingestion_imports` records the immutable manifest and each import's processing result. Held and rejected imports retain their evidence without queryable gold rows.
- `ingestion_records` stores ready gold as JSONB records, preserving identifiers and exact decimals as strings. Field types are recorded per import. Shared indexes begin with organization and import identifiers.

An import is a versioned population, not an automatic append into an org-wide financial ledger. Reading records requires an explicit dataset and job ID. New imports never overwrite earlier versions, and Recoup does not implicitly combine versions or deduplicate economic events across files.

The database RPC checks current membership inside every transaction and locks the membership through commit. All three tables have RLS enabled and no browser or service-role table grants. Only the service role can invoke the guarded RPC; it receives the actor from verified API/MCP authentication. Service credentials are trusted server credentials and must never reach a browser. A SQL function cannot authenticate a fabricated actor supplied by a compromised service credential.

## Create and process

Use the existing `create` operation with `organization_id`, source and contract. The response includes `dataset_id`. No destination configuration is needed for Recoup's own database.

To add another import to that dataset, pass its `dataset_id` and a new idempotency key:

```json
{
  "action": "create",
  "organization_id": "22222222-2222-4222-8222-222222222222",
  "dataset_id": "33333333-3333-4333-8333-333333333333",
  "idempotency_key": "income-2026-12-v1",
  "source": { "kind": "connector", "connector_id": "report-snapshot" },
  "contract": {
    "version": "income-v1",
    "fields": [{ "name": "id", "source": "ID", "type": "string" }]
  }
}
```

Repeating the exact create request can also index a previously completed private import into the shared catalog without recapturing or reprocessing its original; its gold bytes are integrity-checked first.

The selected dataset is part of the immutable input fingerprint. It must belong to the selected organization. Personal account imports retain their existing private artifact behavior and cannot select an organization dataset.

Workers store validated ready gold automatically in Recoup. This is internal dataset storage, not business approval or external delivery. Ready rows and their completion receipt commit together in one database transaction. The private completion marker is written afterward. If its write or the database acknowledgement fails, retrying converges on the same rows; database import state can briefly lead the private artifact marker. Infrastructure failures leave retryable queued work rather than a fabricated successful result.

## Read through HTTP or MCP

The standard authenticated `ingestion` tool and `POST /api/ingestion` accept:

```json
{ "action": "datasets", "organization_id": "<org UUID>", "limit": 25 }
{ "action": "imports", "organization_id": "<org UUID>", "dataset_id": "<dataset UUID>", "limit": 25 }
{ "action": "records", "organization_id": "<org UUID>", "dataset_id": "<dataset UUID>", "job_id": "<job SHA-256>", "limit": 25, "after_row": 0 }
```

Read-only GET uses the same fields as query parameters, for example `/api/ingestion?action=datasets&organization_id=<org UUID>`. Create and delivery remain POST-only. Authentication is unchanged; never pass `account_id`.

Dataset/import pages contain `datasets` or `imports` and `next_after`. Supply that cursor as `after` for the next page. Record pages contain `records: [{ row_number, record }]`, field types, the gold digest and `next_after`; supply that number as `after_row`. A null cursor means the page is complete. Lists allow 1–50 items; record pages allow 1–100 with a 2 MiB record-payload budget, so a page can contain fewer rows than requested. A single row larger than that budget returns HTTP 413 rather than being omitted; those records remain stored, but reading them requires a future large-object export path. Each query is scoped again in the database. Per-minute limits are 60 dataset/import list calls and 30 record page calls per actor and organization.

## Rollout and verification — 2026-11-09

Apply Database's `20261110010000_ingestion_catalog.sql` and `20261110010100_ingestion_catalog_page_budget.sql` in order to the existing project before deploying/enabling these API consumers. Keep `INGESTION_ENABLED` off until private storage, the existing rate counter, Redis dispatch storage and hosted Workflow execution are qualified. No new database needs provisioning. Local disposable databases are verification fixtures only.

Local database tests exercise the actual migration, cross-organization denial, revocation, concurrent retries, exact values, immutable versions, private table/function grants, pagination and rollback. An optional joined test runs this API's real processor against the same disposable database and verifies recovery after a committed write loses its acknowledgement. The fixture schema includes only accounts and memberships plus the new migration; it is not a replay of the full historical Supabase schema or hosted acceptance.

Do not remove persisted datasets as a routine rollback. Revert the API consumer first and retain the additive tables and historical receipts. No production migration or intake activation is performed by these tests.
