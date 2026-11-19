import { createHash } from "node:crypto";
import { z } from "zod";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import { catalogSurfaceRequestSchema } from "../catalogSurfaceRequest";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const id = z.string().min(1).max(128);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const row = z.strictObject({
  catalog_id: z.uuid(),
  isrc: z.string().min(1).max(100),
  date: z.iso.date(),
  provider_recording_id: z.string().nullable(),
  streams: z.number().int().nonnegative().nullable(),
  run_id: z.string().min(1).max(128),
  source_hash: hash,
  retrieved_at: z.iso.datetime({ offset: true }),
});
const inputSchema = z.object({
  surface: z
    .object({
      schemaVersion: z.literal(1),
      id,
      revision: z.literal(1),
      context: z.object({
        workspaceId: z.uuid(),
        subject: z.object({ kind: z.literal("catalog"), id: z.uuid() }),
      }),
    })
    .passthrough(),
  fingerprint: hash,
  lineage: z.array(row).min(1),
  mappingVersion: z.literal("catalog-streams-v1"),
  sourceEnvelope: z.strictObject({
    version: z.literal(1),
    actorId: z.uuid(),
    assistantMessageId: id,
    canonical: z.string().max(262144),
    surfaceSha256: hash,
  }),
});
/** Trusted producer handoff only: not a public parser or current source authorization. */
export function prepareCatalogSnapshotRetention(
  inputScope: { accountId: string; sessionId: string; chatId: string; messageId: string },
  input: unknown,
) {
  const scope = z
    .strictObject({ accountId: z.uuid(), sessionId: id, chatId: id, messageId: id })
    .parse(inputScope);
  encodeStrictJson(input, { maxBytes: 1048576 });
  const parsed = inputSchema.parse(input);
  const source = parsed.sourceEnvelope;
  const canonical = z
    .object({
      mappingVersion: z.literal("catalog-streams-v1"),
      ...catalogSurfaceRequestSchema.shape,
      lineage: z.array(row).min(1),
    })
    .passthrough()
    .parse(JSON.parse(source.canonical));
  const surface = (input as { surface: unknown }).surface;
  if (
    source.actorId !== scope.accountId ||
    source.assistantMessageId !== scope.messageId ||
    digest(source.canonical) !== parsed.fingerprint ||
    digest(JSON.stringify(surface)) !== source.surfaceSha256 ||
    canonical.workspaceId !== parsed.surface.context.workspaceId ||
    canonical.query.catalog_id !== parsed.surface.context.subject.id ||
    encodeStrictJson(canonical.lineage) !== encodeStrictJson(parsed.lineage) ||
    canonical.lineage.some(item => item.catalog_id !== canonical.query.catalog_id) ||
    new Set(canonical.lineage.map(item => item.isrc + ":" + item.date)).size !==
      canonical.lineage.length
  )
    throw new Error("Catalog snapshot source binding mismatch");
  return {
    ...scope,
    sourceVersionKind: "catalog-observation-tuple/v1" as const,
    source,
    surface,
    sourceSha256: parsed.fingerprint,
  };
}
