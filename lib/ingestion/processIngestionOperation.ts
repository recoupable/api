import { ingestionOperationSchema } from "./schemas";
import { hashIngestionValue } from "./hashIngestionValue";
import { hashIngestionBytes } from "./hashIngestionBytes";
import { readIngestionManifest } from "./readIngestionManifest";
import { writeIngestionArtifact } from "./writeIngestionArtifact";
import { INGESTION_ENGINE_VERSION, INGESTION_MAX_BYTES } from "./const";
import type { GoldArtifact, IngestionDependencies, IngestionManifest } from "./types";

/** Shared HTTP/MCP operations. All storage and destination calls use an authenticated scope. */
export async function processIngestionOperation(
  actor: string,
  input: unknown,
  deps: IngestionDependencies,
) {
  const args = ingestionOperationSchema.parse(input);
  const scope = await deps.authorize(actor, args.organization_id);
  await deps.limit(actor, scope, args.action);
  const recheck = async () => {
    if ((await deps.authorize(actor, args.organization_id)) !== scope)
      throw new Error("Scope changed");
  };
  if (args.action === "datasets" || args.action === "imports" || args.action === "records") {
    const { action, organization_id: _organization, ...query } = args;
    const result = await deps.catalog(actor, scope.split("/")[1], action, query);
    await recheck();
    return result;
  }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
  if (args.action === "create") {
    const jobId = hashIngestionValue({ scope, idempotency_key: args.idempotency_key });
    const prefix = `${scope}/${jobId}`;
    const fingerprint = hashIngestionValue({
      source: args.source,
      contract: args.contract,
      engine_version: INGESTION_ENGINE_VERSION,
      ...(args.dataset_id ? { dataset_id: args.dataset_id.toLowerCase() } : {}),
    });
    let saved = await deps.store.read(`${prefix}/manifest.json`);
    if (!saved) {
      const source =
        args.source.kind === "inline"
          ? {
              bytes: Buffer.from(args.source.content_base64, "base64"),
              format: args.source.format,
              filename: args.source.filename,
            }
          : await deps.acquire(scope, args.source.connector_id);
      if (!source.bytes.length || source.bytes.length > INGESTION_MAX_BYTES)
        throw new Error("Source size limit");
      if (
        args.source.kind === "inline" &&
        Buffer.from(source.bytes).toString("base64") !== args.source.content_base64
      )
        throw new Error("Invalid base64");
      const digest = hashIngestionBytes(source.bytes);
      const bronzeKey = `${scope}/originals/${digest}`;
      await recheck();
      await writeIngestionArtifact(deps.store, bronzeKey, source.bytes);
      const manifest: IngestionManifest = {
        job_id: jobId,
        ...(args.dataset_id ? { dataset_id: args.dataset_id.toLowerCase() } : {}),
        input_sha256: fingerprint,
        engine_version: INGESTION_ENGINE_VERSION,
        scope,
        format: source.format,
        filename: source.filename,
        bronze_key: bronzeKey,
        bronze_sha256: digest,
        source:
          args.source.kind === "inline"
            ? { kind: "inline" }
            : { kind: "connector", connector_id: args.source.connector_id },
        contract: args.contract,
        created_at: new Date().toISOString(),
      };
      await recheck();
      await deps.store.create(`${prefix}/manifest.json`, encode(manifest));
      saved = await deps.store.read(`${prefix}/manifest.json`);
    }
    if (!saved) throw new Error("Job creation unavailable");
    const manifest = await readIngestionManifest(deps.store, scope, jobId);
    if (
      manifest.input_sha256 !== fingerprint ||
      manifest.scope !== scope ||
      manifest.job_id !== jobId
    )
      throw new Error("Idempotency conflict");
    const catalog = scope.startsWith("organization/")
      ? await deps.catalog(actor, scope.split("/")[1], "register", { manifest })
      : {};
    const completed = await deps.store.read(`${prefix}/result.json`);
    if (completed && args.organization_id) {
      const result = JSON.parse(new TextDecoder().decode(completed));
      let gold: GoldArtifact | null = null;
      if (result.status === "ready") {
        const bytes = await deps.store.read(`${prefix}/gold.json`);
        if (!bytes || hashIngestionBytes(bytes) !== result.gold_sha256)
          throw new Error("Gold integrity check failed");
        gold = JSON.parse(new TextDecoder().decode(bytes));
      }
      await deps.catalog(actor, scope.split("/")[1], "complete", { job_id: jobId, result, gold });
    }
    await recheck();
    if (!completed) await deps.dispatch(actor, args.organization_id, jobId);
    await recheck();
    return {
      job_id: jobId,
      ...catalog,
      ...(completed ? JSON.parse(new TextDecoder().decode(completed)) : { status: "queued" }),
    };
  }
  const manifest = await readIngestionManifest(deps.store, scope, args.job_id);
  const prefix = `${scope}/${args.job_id}`;
  const marker = await deps.store.read(`${prefix}/result.json`);
  const result = marker
    ? JSON.parse(new TextDecoder().decode(marker))
    : { job_id: args.job_id, status: "queued", gold_sha256: null };
  if (args.action === "read") {
    await recheck();
    return result;
  }
  if (args.action === "artifact") {
    if (args.stage === "bronze") {
      const bytes = await deps.store.read(manifest.bronze_key);
      if (!bytes || hashIngestionBytes(bytes) !== manifest.bronze_sha256)
        throw new Error("Original unavailable");
      await recheck();
      return {
        job_id: args.job_id,
        stage: "bronze",
        artifact: {
          filename: manifest.filename,
          format: manifest.format,
          source_sha256: manifest.bronze_sha256,
          content_base64: Buffer.from(bytes).toString("base64"),
        },
      };
    }
    const digest = result[`${args.stage}_sha256`];
    if (!digest || (args.stage === "gold" && result.status !== "ready"))
      throw new Error("Artifact not ready");
    const bytes = await deps.store.read(`${prefix}/${args.stage}.json`);
    if (!bytes || hashIngestionBytes(bytes) !== digest)
      throw new Error("Artifact integrity check failed");
    await recheck();
    return {
      job_id: args.job_id,
      stage: args.stage,
      artifact: JSON.parse(new TextDecoder().decode(bytes)),
    };
  }
  if (result.status !== "ready" || result.gold_sha256 !== args.gold_sha256)
    throw new Error("Gold selection mismatch");
  const bytes = await deps.store.read(`${prefix}/gold.json`);
  if (!bytes || hashIngestionBytes(bytes) !== args.gold_sha256)
    throw new Error("Gold integrity check failed");
  const gold: GoldArtifact = JSON.parse(new TextDecoder().decode(bytes));
  await recheck();
  const deliveryId = hashIngestionValue({
    scope,
    job_id: args.job_id,
    destination: args.destination_id,
    gold_sha256: args.gold_sha256,
  });
  const receipt = await deps.deliver(
    scope,
    args.destination_id,
    deliveryId,
    gold,
    args.gold_sha256,
  );
  await recheck();
  // The destination's durable receipt is authoritative even if this response is lost.
  return { job_id: args.job_id, delivery_id: deliveryId, receipt };
}
