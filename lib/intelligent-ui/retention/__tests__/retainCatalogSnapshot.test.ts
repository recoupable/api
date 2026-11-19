import { expect, it, vi } from "vitest";
import { retainCatalogSnapshot } from "../retainCatalogSnapshot";

import { createHash } from "node:crypto";
import prepared from "../../__fixtures__/catalog-streams-v1.json";
it("denies missing fenced authority before RPC", async () => {
  const execute = vi.fn();
  await expect(
    retainCatalogSnapshot(
      undefined,
      { accountId: "x", sessionId: "s", chatId: "c", messageId: "m" },
      {},
      execute,
    ),
  ).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const actor = "00000000-0000-4000-8000-000000000001";
const scope = { accountId: actor, sessionId: "session", chatId: "chat", messageId: "message" };
const writer = { effectiveAccount: actor, chatId: "chat", epoch: 4, owner: actor, runId: "run" };
const canonical = JSON.stringify({
  mappingVersion: "catalog-streams-v1",
  workspaceId: prepared.surface.context.workspaceId,
  query: {
    catalog_id: prepared.surface.context.subject.id,
    since: "2026-09-02",
    days: 1,
    page: 1,
    limit: 25,
  },
  lineage: prepared.lineage,
});
const input = {
  ...prepared,
  fingerprint: hash(canonical),
  sourceEnvelope: {
    version: 1,
    actorId: actor,
    assistantMessageId: "message",
    canonical,
    surfaceSha256: hash(JSON.stringify(prepared.surface)),
  },
};
const receipt = {
  message_id: "message",
  source_revision: 1,
  source_sha256: hash(canonical),
  surface_sha256: input.sourceEnvelope.surfaceSha256,
  retained: true,
};
it("hands exact source bytes and captured writer to persistence without leaking them into Surface", async () => {
  const execute = vi.fn().mockResolvedValue(receipt);
  expect(await retainCatalogSnapshot(writer, scope, input, execute)).toEqual(receipt);
  expect(execute).toHaveBeenCalledOnce();
  expect(execute.mock.calls[0][0]).toMatchObject({
    p_account: actor,
    p_epoch: 4,
    p_run: "run",
    p_session: "session",
    p_expected_revision: 0,
    p_source: canonical,
    p_surface: JSON.stringify(prepared.surface),
  });
});
it.each(["actor", "chat"])("refuses cross-%s writer", async mode => {
  const execute = vi.fn();
  await expect(
    retainCatalogSnapshot(
      {
        ...writer,
        ...(mode === "actor"
          ? { effectiveAccount: "00000000-0000-4000-8000-000000000099" }
          : { chatId: "other" }),
      },
      scope,
      input,
      execute,
    ),
  ).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
it.each(["revision", "message", "source", "extra"])(
  "refuses substituted %s receipt",
  async mode => {
    const bad = {
      ...receipt,
      ...(mode === "revision"
        ? { source_revision: 2 }
        : mode === "message"
          ? { message_id: "other" }
          : mode === "source"
            ? { source_sha256: "0".repeat(64) }
            : { work_saved: true }),
    };
    const execute = vi.fn().mockResolvedValue(bad);
    await expect(retainCatalogSnapshot(writer, scope, input, execute)).rejects.toThrow();
    expect(execute).toHaveBeenCalledOnce();
  },
);
it.each(["40001 stale writer", "42501 denied", "commit outcome unknown"])(
  "never retries or falls back after %s",
  async reason => {
    const execute = vi.fn().mockRejectedValue(new Error(reason));
    await expect(retainCatalogSnapshot(writer, scope, input, execute)).rejects.toThrow(reason);
    expect(execute).toHaveBeenCalledOnce();
  },
);
