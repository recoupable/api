# Data ingestion

Private, versioned processing from source files or configured JSON APIs through bronze, silver and gold into export artifacts or an external Postgres database. All code lives in this API repository.

## Operating contract

- **Bronze:** exact original bytes, SHA-256, retrieval time and source occurrence. Private originals are never uploaded to public media storage.
- **Silver:** mapped and typed source-grain records, source row/sheet/page coordinates, validation issues and exact reconciliation controls.
- **Gold:** business-ready detail or explicit grouped sums, with field types and contract/engine versions. Only a job with no blocking issues produces gold.
- **Delivery:** explicit selection of an exact gold digest and a configured destination. Rows and the durable delivery receipt commit together in the destination database.

A job manifest links the source digest and immutable processing contract. The completion marker links the silver and gold byte digests. Stage objects are create-only; conflicting retries cannot replace earlier artifacts. Changes to bytes, mappings or rules require a new idempotency key. Future engine behavior changes must bump `INGESTION_ENGINE_VERSION` so an older unfinished job cannot silently run a different processor.

`ready` means the declared parsing/validation contract passed. It does not establish financial definitions, provider completeness, rights, ownership or business approval. `held` keeps silver and issues but has no gold. `rejected` retains the original with a reader/limit error. Review a held job, change its explicit contract and create a new version; there is no automatic schema alteration or silent dropping of bad rows.

## Setup

Disabled by default. Before enabling a deployment:

1. Provision a dedicated **private** Supabase Storage bucket and set `INGESTION_STORAGE_BUCKET`. Keep its object policies server-only; do not give anonymous/authenticated clients direct reads, writes or bucket updates. The service verifies the bucket is private before every storage operation. Retention and region are operator decisions; this implementation never deletes originals automatically.
2. Configure the API's existing Supabase service credentials and Vercel Workflow runtime. No new Recoup database tables or migrations are required: manifests, originals, results and stage outputs are durable private objects.
3. Optionally configure source connectors and destinations below. Verify access with synthetic fixtures before production data. No source or destination is inferred from client names or request URLs.
4. Set `INGESTION_ENABLED=true` only after deployment qualification. There is no added billing or recurring schedule.

The same operations are exposed by `POST /api/ingestion` and the standard authenticated MCP tool `ingestion`. Identity comes from `x-api-key` or Bearer authentication; never supply `account_id`. Optional `organization_id` requires current membership. Personal and organization namespaces are distinct. Organization-scoped jobs are shared with currently authorized organization members. Workers recheck the initiating actor's access before processing and publication; reads and delivery also recheck access. Delegated OAuth does not expose this tool.

## HTTP operations

All responses are private and uncached. Request JSON is streamed with a 3 MiB ceiling. Inline decoded files are limited to 2 MiB; larger files need a future staged-upload/worker extension.

### Create

```json
{
  "action": "create",
  "idempotency_key": "income-2026-11-v1",
  "source": {
    "kind": "inline",
    "filename": "income.csv",
    "format": "csv",
    "content_base64": "SUQsQW1vdW50CjAwMSwwLjEKMDAyLDAuMgo="
  },
  "contract": {
    "version": "income-v1",
    "fields": [
      { "name": "id", "source": "ID", "type": "string" },
      { "name": "amount", "source": "Amount", "type": "decimal" },
      { "name": "currency", "constant": "USD", "type": "string" }
    ],
    "business_keys": ["id"],
    "controls": [{ "field": "amount", "expected": "0.3", "tolerance": "0" }]
  }
}
```

Returns HTTP 202 with `job_id` and `status`. Repeat the identical request/key to recover dispatch failure or reuse a completed result. A changed input under the same key is refused. Source capture and the manifest finish before dispatch. A manifest without a result remains `queued`, including a workflow whose retries have exhausted: repeat the original create request to redispatch after fixing infrastructure. There is no unattended dispatch-recovery sweep or workflow-failure mirror yet.

### Read and export

```json
{ "action": "read", "job_id": "<64-character job ID>" }
```

Returns state, source digest, read/output counts, controls, bounded issues and artifact digests. Issues identify coordinates/fields and codes; source values are kept in private artifacts. `issue_count` and `issues_truncated` make bounded diagnostics explicit.

```json
{ "action": "artifact", "job_id": "<job ID>", "stage": "gold" }
```

`stage` is `bronze`, `silver` or `gold`. Bronze returns native bytes as base64 plus filename/format/digest. Silver/gold return private JSON artifacts. Gold values remain strings or null so identifiers and decimals survive JSON and client transport. Review/export large artifacts through HTTP rather than model context. There is no cross-account listing endpoint or public artifact URL.

### Deliver

```json
{
  "action": "deliver",
  "job_id": "<job ID>",
  "destination_id": "analytics",
  "gold_sha256": "<exact digest returned by read>"
}
```

Only ready, integrity-checked gold can be delivered. The destination must be configured for the authenticated scope. Never approve publication merely because validation passed. A successful response includes `delivery_id` and `{ "committed": true, "rows": 2 }`. The count is accepted input/output rows, not a split of inserted versus updated rows.

## Parsing and transformations

| Format | Supported behavior |
| --- | --- |
| CSV/TSV | UTF-8, quoted multiline records, explicit delimiter/header row, strict widths and unique headers |
| JSON/JSONL | Array records or an explicit `records_path`; lossless numeric tokens; nested cell values rejected |
| XLSX | Native XML text/numeric tokens, shared strings, explicit sheet selection for multi-sheet workbooks, actual source row coordinates; formulas rejected |
| PDF | Native text using an explicit reviewed `text_table: { review_ref, separator }`; page coordinates retained; scans require an OCR extension |

Limits: 10,000 data records, 100 columns, 2 MiB source bytes, 16 MiB stage artifacts, 1,000 workbook archive members and 16 MiB declared expansion, 50 PDF pages and 2 million extracted characters. Archive members are not written to the filesystem. Encrypted/legacy workbooks, general archives, Parquet, OCR and arbitrary document interpretation are not implemented.

Fields support `string`, `decimal`, `integer`, ISO `date`, and literal `boolean`, plus explicit constants and `nullable`. Trimming is opt-in. Currency symbols and period meanings are never guessed. Decimal/thousands separators are declared; malformed grouping is rejected. Identifiers declared as strings preserve leading zeros. Spreadsheet numeric formatting does not manufacture missing identifier zeros. Date serials require an explicit future conversion; date fields currently need ISO text.

Every source column must be mapped or named in `ignored_columns`. Any repeated business key, missing/invalid required value or unmapped column holds the entire gold publication. `controls` sum a numeric field with exact decimal arithmetic; optional `where` values scope a control to a currency/period/etc. Never combine distinct economic measures without an explicit approved transformation.

Optional `aggregate: { group_by: ["currency"], sums: ["amount"] }` produces grouped gold with exact sums. Null sums hold publication. There are no arbitrary code execution, SQL transforms, implicit joins, currency conversions, ownership inference, deduplication by apparent income or automatic deletes. Extend readers and transformations behind their own tests/contracts.

## Configured JSON source

Set `INGESTION_SOURCES_JSON` to an array:

```json
[
  {
    "id": "report-snapshot",
    "scope": "organization/11111111-1111-4111-8111-111111111111",
    "url": "https://reports.example.com/export",
    "token_env": "INGESTION_SOURCE_REPORTS"
  }
]
```

Store the token in the named server secret. Use `source: { kind: "connector", connector_id: "report-snapshot" }` with the ordinary contract. URLs are operator-controlled, HTTPS-only and never caller supplied; redirects are refused. Fetch is bounded by 15 seconds and 2 MiB. The exact response body becomes bronze. A reused job/key reuses its original captured snapshot. This is one JSON response, not pagination, CDC or proof of complete source history. A new retrieval needs a new key. Tokens and source URLs are excluded from job artifacts and errors.

## External Postgres / Supabase destination

Set `INGESTION_DESTINATIONS_JSON` to scoped configuration:

```json
[
  {
    "id": "analytics",
    "scope": "organization/11111111-1111-4111-8111-111111111111",
    "connection_env": "INGESTION_DB_ANALYTICS",
    "schema": "public",
    "table": "income",
    "columns": ["id", "amount", "currency"],
    "mode": "upsert",
    "business_keys": ["id"],
    "receipt_schema": "ingestion",
    "receipt_table": "delivery_receipts"
  }
]
```

The named secret contains the connection URL. TLS certificate verification is required. URL query options do not override it. Provision target tables, unique keys and receipt table before use; the worker does not alter client schemas. Example receipt DDL:

```sql
CREATE SCHEMA IF NOT EXISTS ingestion;
CREATE TABLE ingestion.delivery_receipts (
  delivery_id text PRIMARY KEY,
  artifact_sha256 text NOT NULL,
  target text NOT NULL,
  config_sha256 text NOT NULL,
  row_count integer NOT NULL CHECK (row_count > 0),
  committed_at timestamptz NOT NULL DEFAULT now()
);
```

Grant the connection role only required target read/insert/update and receipt read/insert permissions, schema usage and necessary sequence privileges. It should not own schemas, change tables or bypass RLS. Keep receipts immutable and durable for as long as deliveries may be retried. Bind a destination ID to one database identity; changing its connection to a different database is a new destination, not a retry.

The adapter locks each delivery, checks its existing receipt, validates target column types, and inserts/upserts with bound JSON parameters. Postgres `RETURNING` values are checked before commit: numeric rounding, string coercion and trigger changes cause rollback. Floats are refused for decimal fields. Output rows and receipt share one transaction. After a lost acknowledgement, retry the exact delivery; the client receipt proves whether it committed. This gives idempotency per destination/job/output, not semantic deduplication across jobs. Append mode deliberately appends new jobs; use explicit business keys/upsert for revised populations. There is no cross-job newest-wins policy, automatic deletion, rollback command or multi-destination transaction.

## Verification and extension

```sh
pnpm exec vitest run lib/ingestion/__tests__
pnpm exec tsc --noEmit --project tsconfig.ingestion.json
```

For a disposable local database named `ingestion_test` only:

```sh
INGESTION_TEST_DATABASE_URL=postgresql://localhost:5432/ingestion_test \
  pnpm exec vitest run lib/ingestion/__tests__/postgres.integration.test.ts
```

The integration test creates a uniquely named schema and drops that schema afterward. It verifies actual loading/replay, concurrent delivery, exact identifier types and rollback on numeric rounding. No test uses production destinations.

Add source acquisition behind `acquire`, new readers behind `readIngestionRows`, transformations behind the versioned contract, durable storage behind `ArtifactStore`, and destinations behind `deliver`. A destination must state its atomicity/idempotency behavior; do not promise universal exactly-once delivery. Provider qualification, large-file capacity, CPU/memory containment for adversarial documents, hosted Workflow execution, private bucket policies and a real external database connection require deployment acceptance beyond local tests.

### Validation record — 2026-11-09

Implemented in an isolated API feature branch. Verified 49 ingestion tests (including four tests against disposable PostgreSQL 17) and 82 existing OAuth tests: 131 passing on Node 22.23.4. ESLint and ingestion type checking passed. The Node 22 production compile-only build passed. The production build compiled the application and passed TypeScript, then stopped during page-data collection because the local checkout lacks the existing `PRIVY_JWT_VERIFICATION_KEY` configuration.

No hosted storage, destination, deployment or production-data load was configured or exercised. Next: review the implementation, provision private storage and a synthetic external destination, then qualify the deployed HTTP/MCP/Workflow path before enabling intake. OCR, larger-file processing and additional destination types remain extensions, not shipped capabilities.

Follow-up on 2026-11-09: the complete OAuth compatibility suite passes locally after adding the explicit standard-only ingestion policy entry. CI now exercises ingestion against disposable PostgreSQL 15 and 17, and the general unit-test job uses the documented Node 22 runtime. The automatically deployed PR preview returned HTTP 404 with `Cache-Control: private, no-store` and the expected disabled response for `POST /api/ingestion`; this verifies the inactive route, not hosted processing or external delivery.
