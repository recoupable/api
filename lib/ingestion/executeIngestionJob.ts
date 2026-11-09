import { readIngestionManifest } from "./readIngestionManifest";
import { runIngestionPipeline } from "./runIngestionPipeline";
import { hashIngestionBytes } from "./hashIngestionBytes";
import { writeIngestionArtifact } from "./writeIngestionArtifact";
import { INGESTION_ENGINE_VERSION, INGESTION_MAX_ARTIFACT_BYTES } from "./const";
import type { IngestionDependencies } from "./types";

/** Durable processing entry point: originals first, artifacts next, completion marker last. */
export async function executeIngestionJob(
  actor: string,
  organization: string | undefined,
  jobId: string,
  deps: IngestionDependencies,
): Promise<void> {
  const scope = await deps.authorize(actor, organization);
  const manifest = await readIngestionManifest(deps.store, scope, jobId);
  const prefix = `${scope}/${jobId}`;
  if (await deps.store.read(`${prefix}/result.json`)) return;
  if (manifest.engine_version !== INGESTION_ENGINE_VERSION)
    throw new Error("Engine version unavailable");
  const bronze = await deps.store.read(manifest.bronze_key);
  if (!bronze || hashIngestionBytes(bronze) !== manifest.bronze_sha256)
    throw new Error("Original integrity check failed");
  let processed = await runIngestionPipeline(bronze, manifest.format, manifest.contract);
  const rowsRead = processed.rows_read;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
  let silver = encode(processed.silver);
  let gold = processed.gold ? encode(processed.gold) : null;
  if (
    silver.length > INGESTION_MAX_ARTIFACT_BYTES ||
    (gold && gold.length > INGESTION_MAX_ARTIFACT_BYTES)
  ) {
    processed = {
      ...processed,
      status: "rejected",
      gold: null,
      silver: { records: [] },
      issues: [{ code: "OUTPUT_SIZE_LIMIT" }],
      issue_count: 1,
    };
    silver = encode(processed.silver);
    gold = null;
  }
  if ((await deps.authorize(actor, organization)) !== scope) throw new Error("Scope changed");
  await writeIngestionArtifact(deps.store, `${prefix}/silver.json`, silver);
  if (gold) await writeIngestionArtifact(deps.store, `${prefix}/gold.json`, gold);
  if ((await deps.authorize(actor, organization)) !== scope) throw new Error("Scope changed");
  await writeIngestionArtifact(
    deps.store,
    `${prefix}/result.json`,
    encode({
      job_id: jobId,
      status: processed.status,
      engine_version: manifest.engine_version,
      source_sha256: manifest.bronze_sha256,
      rows_read: rowsRead,
      rows_output: processed.gold?.records.length ?? 0,
      issues: processed.issues,
      issue_count: processed.issue_count,
      issues_truncated: Math.max(0, processed.issue_count - processed.issues.length),
      controls: processed.controls,
      silver_sha256: hashIngestionBytes(silver),
      gold_sha256: gold ? hashIngestionBytes(gold) : null,
    }),
  );
}
