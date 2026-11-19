import { z } from "zod";
import { chatFenceWriterSchema } from "@/lib/chat/fence/chatFenceSchemas";
import { prepareCatalogSnapshotRetention } from "./prepareCatalogSnapshotRetention";
/** Internal source handoff after required fenced message persistence. No automatic retry. */
export async function retainCatalogSnapshot(
  writerInput: unknown,
  scope: Parameters<typeof prepareCatalogSnapshotRetention>[0],
  prepared: unknown,
  execute: (command: Record<string, unknown>) => Promise<unknown>,
) {
  const writer = chatFenceWriterSchema.parse(writerInput);
  if (writer.chatId !== scope.chatId || writer.effectiveAccount !== scope.accountId)
    throw new Error("Catalog retention authority mismatch");
  const value = prepareCatalogSnapshotRetention(scope, prepared);
  const command = {
    p_chat: writer.chatId,
    p_account: writer.effectiveAccount,
    p_session: scope.sessionId,
    p_epoch: writer.epoch,
    p_owner: writer.owner,
    p_run: writer.runId,
    p_message: scope.messageId,
    p_expected_revision: 0,
    p_source: value.source.canonical,
    p_surface: JSON.stringify(value.surface),
    p_source_sha256: value.sourceSha256,
    p_surface_sha256: value.source.surfaceSha256,
  };
  // Operational errors, including ambiguous commit, propagate without re-key or fallback.
  const result = z
    .strictObject({
      message_id: z.literal(scope.messageId),
      source_revision: z.literal(1),
      source_sha256: z.literal(value.sourceSha256),
      surface_sha256: z.literal(value.source.surfaceSha256),
      retained: z.literal(true),
    })
    .parse(await execute(command));
  return result;
}
