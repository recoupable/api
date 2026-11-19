import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readRetainedFieldSelection } from "./readRetainedFieldSelection";
import { consumeRetainedField } from "./consumeRetainedField";
import { method } from "./schemas";
import { classifyRetainedFieldRefusal } from "./classifyRetainedFieldRefusal";
import { evaluateRetainedStreamField } from "../catalog-stream-fields/evaluate";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = {
  actorId: id(9),
  workspaceId: id(1),
  requestId: id(2),
  catalogId: id(3),
  key: "original",
};
const receipt = {
  ownerId: id(1),
  requestId: id(2),
  subjectId: id(4),
  catalogId: id(3),
  key: "original",
  commandDigest: "a".repeat(64),
  resultId: id(5),
  sourceVersionId: id(6),
  revision: 7,
};
const selection = {
  ownerId: id(1),
  requestId: id(2),
  subjectId: id(4),
  catalogId: id(3),
  resultId: id(5),
  revision: 7,
  topic: "catalog_retained_streams",
  sourceVersionIds: [id(6)],
};
const query = { since: "2026-10-24", days: 1, timezone: "UTC" };
const request = {
  mode: "retained_field",
  workspaceId: id(1),
  catalogId: id(3),
  field: "current_streams",
  query,
  method,
  selections: [selection],
};
const actor = { actorId: id(9), sessionId: "session", chatId: "chat", messageId: "assistant" };
const envelope = {
  ...selection,
  evidence: {
    schemaVersion: 1,
    workspaceId: id(1),
    catalogId: id(3),
    subjectId: id(4),
    isrc: "USAAA2600001",
    provider: "luminate",
    metric: "daily_streams",
    platform: "all_dsps",
    territory: "worldwide",
    timezone: "UTC",
    since: "2026-10-23",
    until: "2026-10-25",
    periods: {
      previous: { start: "2026-10-23", end_exclusive: "2026-10-24" },
      current: { start: "2026-10-24", end_exclusive: "2026-10-25" },
      days: 1,
      timezone: "UTC",
    },
    providerRecordingId: "provider-original",
    observations: [23, 24].map((d, i) => ({
      catalog_id: id(3),
      isrc: "USAAA2600001",
      date: `2026-10-${d}`,
      run_id: id(7),
      provider_recording_id: "provider-original",
      streams: i ? 100 : 50,
      source_hash: "a".repeat(64),
      retrieved_at: "2026-10-25T01:00:00Z",
    })),
    absentDates: [],
    nullDates: [],
    retrievalRange: { earliest: "2026-10-25T01:00:00Z", latest: "2026-10-25T01:00:00Z" },
  },
};
const asOf = "2026-10-27T00:00:00Z";
describe("genuine retained selection proposal", () => {
  it("round trips reconciled identities through the real evaluator while transaction is held", async () => {
    await expect(
      JSON.stringify({ scope, actor, receipt, envelope, query, asOf }, null, 2) + "\n",
    ).toMatchFileSnapshot("./fixtures/synthetic-authority-input.json");
    const reconcile = vi.fn(async () => receipt);
    const selected = await readRetainedFieldSelection(scope, reconcile);
    expect(reconcile).toHaveBeenCalledWith(scope);
    expect(selected).toEqual({ state: "ready", selection });
    let held = false;
    const result = await consumeRetainedField(
      actor,
      { ...request, selections: selected.state === "ready" ? [selected.selection] : [] },
      async (context, consume) => {
        expect(context.actorId).toBe(id(9));
        expect(context.selections).toEqual([selection]);
        held = true;
        const value = await consume({
          asOf,
          readBinding: async () => {
            expect(held).toBe(true);
            return envelope;
          },
        });
        held = false;
        return value;
      },
    );
    expect(held).toBe(false);
    expect(result.state).toBe("ready");
    if (result.state !== "ready") throw new Error("expected ready");
    const { state: _state, ...fieldContext } = result;
    await expect(JSON.stringify(fieldContext, null, 2) + "\n").toMatchFileSnapshot(
      "./fixtures/fieldContext.json",
    );
    expect(result.items[0].binding).toEqual(selection);
    expect(result.items[0].value).toEqual({ state: "known", amount: 100 });
    expect(result.items[0].ref.id).toBe(id(4));
    expect(JSON.stringify(result)).not.toContain("provider-original");
    expect(JSON.stringify(result)).not.toContain("observations");
  });
  it.each([
    null,
    undefined,
    {},
    { state: "pending" },
    { ...receipt, ownerId: id(9) },
    { ...receipt, requestId: id(8) },
    { ...receipt, catalogId: id(8) },
    { ...receipt, key: "new-key" },
    { ...receipt, extra: true },
  ])("does not manufacture selection from unavailable or mismatched receipt %j", async value => {
    expect(await readRetainedFieldSelection(scope, async () => value)).toEqual({
      state: "unavailable",
    });
  });
  it("defaults to unavailable and does not retry ambiguous transport errors", async () => {
    expect(await readRetainedFieldSelection(scope)).toEqual({ state: "unavailable" });
    const reconcile = vi.fn(async () => {
      throw new Error("unknown commit");
    });
    expect(await readRetainedFieldSelection(scope, reconcile)).toEqual({ state: "error" });
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(await consumeRetainedField(actor, request)).toEqual({ state: "unavailable" });
  });
  it("withholds all projections when the authority read returns unavailable", async () => {
    const result = await consumeRetainedField(actor, request, async (_, consume) =>
      consume({ asOf, readBinding: async () => null }),
    );
    expect(result).toEqual({ state: "unavailable" });
  });
  it.each([
    { ...envelope, revision: 8 },
    { ...envelope, resultId: id(8) },
    { ...envelope, sourceVersionIds: [id(8)] },
  ])("does not silently upgrade exact binding", async value => {
    expect(
      await consumeRetainedField(actor, request, async (_, consume) =>
        consume({ asOf, readBinding: async () => value }),
      ),
    ).toEqual({ state: "unavailable" });
  });
  it.each([
    { ...request, mode: "report" },
    { ...request, evidence: envelope },
    { ...request, selections: [selection, selection] },
    { ...request, selections: Array(9).fill(selection) },
    { ...request, method: { ...method, evaluatorSha256: "b".repeat(64) } },
    { ...request, selections: [{ ...selection, ownerId: id(9) }] },
  ])("rejects invalid branch before authority call", async input => {
    const transaction = vi.fn();
    expect(await consumeRetainedField(actor, input, transaction)).toEqual({ state: "invalid" });
    expect(transaction).not.toHaveBeenCalled();
  });
  it("withholds the whole batch if a later selection is unavailable", async () => {
    const second = { ...selection, subjectId: id(8), resultId: id(10) };
    const result = await consumeRetainedField(
      actor,
      { ...request, selections: [selection, second] },
      async (_, consume) =>
        consume({ asOf, readBinding: async s => (s.subjectId === id(4) ? envelope : null) }),
    );
    expect(result).toEqual({ state: "unavailable" });
  });
  it("preserves observed zero and makes incomplete values unknown", async () => {
    const zero = structuredClone(envelope);
    zero.evidence.observations[1].streams = 0;
    const result = await consumeRetainedField(actor, request, async (_, consume) =>
      consume({ asOf, readBinding: async () => zero }),
    );
    expect(result.state === "ready" && result.items[0].value).toEqual({
      state: "known",
      amount: 0,
    });
    const absent = structuredClone(envelope);
    absent.evidence.observations.pop();
    absent.evidence.absentDates = ["2026-10-24"] as never[];
    const unknown = await consumeRetainedField(actor, request, async (_, consume) =>
      consume({ asOf, readBinding: async () => absent }),
    );
    expect(unknown.state === "ready" && unknown.items[0].value).toEqual({ state: "unknown" });
  });
});

it("pins the actual evaluated code, recipe and helper", () => {
  for (const [file, hash] of [
    ["../catalog-stream-fields/evaluate.ts", method.evaluatorSha256],
    ["../catalog-stream-fields/recipe.json", method.recipeHash],
    ["../../../lib/catalog/compareSpotifyDailyStreams.ts", method.helperSha256],
  ]) {
    expect(
      createHash("sha256")
        .update(readFileSync(new URL(file, import.meta.url)))
        .digest("hex"),
    ).toBe(hash);
  }
});
it("redacts later transport failure after a successful row and never retries", async () => {
  const second = { ...selection, subjectId: id(8), resultId: id(10) };
  const readBinding = vi.fn(async s => {
    if (s.subjectId === id(4)) return envelope;
    throw new Error("transport uncertain");
  });
  expect(
    await consumeRetainedField(
      actor,
      { ...request, selections: [selection, second] },
      async (_, consume) => consume({ asOf, readBinding }),
    ),
  ).toEqual({ state: "error" });
  expect(readBinding).toHaveBeenCalledTimes(2);
});

it.each([270000, 400000])(
  "classifies actual oversized UTF-8 authority evidence as invalid (%i characters)",
  async characters => {
    const oversized = structuredClone(envelope);
    oversized.evidence.providerRecordingId = "é".repeat(characters);
    const evidenceBytes = Buffer.byteLength(JSON.stringify(oversized.evidence), "utf8");
    const envelopeBytes = Buffer.byteLength(JSON.stringify(oversized), "utf8");
    expect(evidenceBytes).toBeGreaterThan(512 * 1024);
    if (characters === 270000) expect(envelopeBytes).toBeLessThan(768 * 1024);
    else expect(envelopeBytes).toBeGreaterThan(768 * 1024);
    expect(
      evaluateRetainedStreamField({
        operation: "read_field",
        recipe: method.recipe,
        field: "current_streams",
        selection: { ...selection, query },
        asOf,
        boundary: { state: "qualified", envelope: oversized },
      }),
    ).toEqual({ state: "refused", reason: "size_limit" });
    expect(
      await consumeRetainedField(actor, request, async (_, consume) =>
        consume({ asOf, readBinding: async () => oversized }),
      ),
    ).toEqual({ state: "invalid" });
  },
);

it.each(["helper_changed", "source_error"])(
  "classifies evaluator operational refusal %s without details",
  reason => {
    expect(classifyRetainedFieldRefusal(reason)).toEqual({ state: "error" });
  },
);
