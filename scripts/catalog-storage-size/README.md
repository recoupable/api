# Catalog snapshot size qualification

This paired fixture loads the real snapshot schema, Catalog processor, receipt validator and `callContextRpc`, replacing only the Supabase client with a local `psql` transport. Synthetic account/head setup and error transport are fixture-only. It executes the owning Database SQL from the pinned composition in `sources.json`; no business SQL is copied here.

The owning `proposals/catalog-snapshot-size-2277/fixture.py` reuses the accepted four-file DB125 bootstrap. The baseline is Database main `7708e337` plus original DB125 `3f2c849`, followed by the separately pinned inactive size proposal; the composition tree is not a deployed commit. The size proposal lives outside migrations and adds no grants; DB125 remains unchanged. The runner reuses the exact reviewed Sites lifecycle helper by Git hash, without changing the shared harness. Supply local repositories containing both source commits; the runner never fetches source or credentials.

```sh
python3 scripts/catalog-storage-size/run.py \
  --database-repo /absolute/path/to/database \
  --lifecycle-repo /absolute/path/to/api \
  --pg-bin /absolute/path/to/postgresql/bin \
  --evidence-dir /absolute/path/to/evidence
```

Three paired cases establish exponent expansion, successful arbitrary JSON roundtrip/replay, and both 9→10 and 99→100 stored-revision boundaries. Each overflow checks actual PostgreSQL byte length and unchanged head/revision state. Reducing the boundary payload by one byte saves at the exact stored limit; exact replay succeeds, while stale revision and changed-payload key reuse still refuse without mutation. The wrapper maps only Catalog save + `22001` + exact `CATALOG_SNAPSHOT_TOO_LARGE`; ordinary errors are not size errors. Separate unit/HTTP/MCP tests cover the narrow mapping and safe text presentation.

The runner uses a minimal environment, disabled dotenv, frozen verified API source loads, an owned Unix-socket-only cluster, denied Node networking, bounded test execution, and parent-owned cleanup before deletion. The reused lifecycle code preserves files if shutdown cannot be verified. This proves the synthetic local contract, not hosted identity, PostgREST exposure, production migration or deployment. Without the runner socket, ordinary Vitest discovery skips these three paired cases.
