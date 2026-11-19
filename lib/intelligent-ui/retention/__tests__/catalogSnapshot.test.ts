import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { prepareCatalogSnapshotRetention } from "../prepareCatalogSnapshotRetention";
import prepared from "../../__fixtures__/catalog-streams-v1.json";
const actor = "00000000-0000-4000-8000-000000000001";
const scope = { accountId: actor, sessionId: "session", chatId: "chat", messageId: "assistant" };
const source = {
  mappingVersion: prepared.mappingVersion,
  workspaceId: prepared.surface.context.workspaceId,
  query: {
    catalog_id: prepared.surface.context.subject.id,
    since: "2026-09-02",
    days: 1,
    page: 1,
    limit: 25,
  },
  periods: {},
  pagination: {},
  membership: [],
  lineage: prepared.lineage,
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const input = {
  ...prepared,
  fingerprint: hash(JSON.stringify(source)),
  sourceEnvelope: {
    version: 1,
    actorId: actor,
    assistantMessageId: "assistant",
    canonical: JSON.stringify(source),
    surfaceSha256: hash(JSON.stringify(prepared.surface)),
  },
};
it("preserves exact original observation versions outside rendered schema", () => {
  const result = prepareCatalogSnapshotRetention(scope, input);
  expect(result.source.canonical).toBe(input.sourceEnvelope.canonical);
  expect(result.surface).toEqual(prepared.surface);
  expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.sourceVersionKind).toBe("catalog-observation-tuple/v1");
});
it.each(["actor", "message", "workspace", "revision", "lineage", "hash"])(
  "refuses mismatched %s without latest lookup",
  mode => {
    const changed = structuredClone(input);
    if (mode === "actor") changed.sourceEnvelope.actorId = "00000000-0000-4000-8000-000000000099";
    if (mode === "message") changed.sourceEnvelope.assistantMessageId = "other";
    if (mode === "workspace")
      changed.surface.context.workspaceId = "00000000-0000-4000-8000-000000000099";
    if (mode === "revision") changed.surface.revision = 2;
    if (mode === "lineage") changed.lineage = [];
    if (mode === "hash") changed.fingerprint = "0".repeat(64);
    expect(() => prepareCatalogSnapshotRetention(scope, changed)).toThrow();
  },
);
