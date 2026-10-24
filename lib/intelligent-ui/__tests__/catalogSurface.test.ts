import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { sendCatalogSurfaceStep } from "@/app/lib/workflows/sendCatalogSurfaceStep";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalogStreams } from "@/lib/catalog/getCatalogStreams";
import { getCatalogOwnerIds } from "@/lib/catalog/getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { selectCatalogStreamObservations } from "@/lib/supabase/catalog_stream_observations/selectCatalogStreamObservations";
import { prepareCatalogSurface } from "../prepareCatalogSurface";
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogRecordingPage", () => ({
  selectCatalogRecordingPage: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_stream_observations/selectCatalogStreamObservations", () => ({
  selectCatalogStreamObservations: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_stream_runs/selectLatestCatalogStreamRun", () => ({
  selectLatestCatalogStreamRun: vi.fn().mockResolvedValue(null),
}));
const actor = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";
const catalog = "00000000-0000-4000-8000-000000000003";
const query = { catalog_id: catalog, since: "2026-09-02", days: 1, page: 1, limit: 25 };
const input = { accountId: actor, workspaceId: workspace, query, assistantMessageId: "message-1" };
const row = (date: string, streams: number | null, run = "run-1") => ({
  catalog_id: catalog,
  isrc: "USAAA2400001",
  date,
  streams,
  provider_recording_id: "MR1",
  retrieved_at: "2026-09-04T00:00:00Z",
  run_id: run,
  source_hash: "a".repeat(64),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
  vi.clearAllMocks();
  vi.mocked(getCatalogOwnerIds).mockResolvedValue([actor, workspace]);
  vi.mocked(selectAccountCatalog).mockResolvedValue({ account: workspace, catalog } as never);
  vi.mocked(selectCatalogRecordingPage).mockResolvedValue({
    songs: [{ isrc: "USAAA2400001", name: "Track" }],
    total_count: 2,
  });
  vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
    row("2026-09-01", 1),
    row("2026-09-02", 3, "run-2"),
  ]);
});
afterEach(() => vi.useRealTimers());
describe("saved catalog surface", () => {
  it("binds exact selected workspace and preserves all contributing runs", async () => {
    const result = await prepareCatalogSurface(input);
    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountIds: [workspace],
      catalogId: catalog,
      throwOnError: true,
    });
    expect(result.surface.context.subject).toMatchObject({ kind: "catalog", id: catalog });
    expect(result.lineage.map(r => r.run_id)).toEqual(["run-1", "run-2"]);
    expect(result.surface.components[0]).toMatchObject({
      type: "distribution",
      complete: false,
      totalCount: 2,
      items: [{ value: 3 }],
    });
    expect(result.surface.fallbackText).toContain("Luminate");
    expect(result.surface.fallbackText).not.toContain(result.fingerprint);
    expect(result.surface.evidence[0].text).toContain(result.fingerprint);
    expect(result.surface.fallbackText).toContain("page 1");
  });
  it("denies a forged or revoked workspace before data reads", async () => {
    vi.mocked(getCatalogOwnerIds).mockResolvedValue([actor]);
    await expect(prepareCatalogSurface(input)).rejects.toThrow("Catalog not found");
    expect(selectAccountCatalog).not.toHaveBeenCalled();
    expect(selectCatalogRecordingPage).not.toHaveBeenCalled();
  });
  it("denies a catalog linked only to another workspace", async () => {
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);
    await expect(prepareCatalogSurface(input)).rejects.toThrow("Catalog not found");
    expect(selectCatalogRecordingPage).not.toHaveBeenCalled();
  });
  it("keeps canonical fingerprint on replay/order changes and changes it on correction", async () => {
    const a = await prepareCatalogSurface(input);
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      row("2026-09-02", 3, "run-2"),
      row("2026-09-01", 1),
    ]);
    const b = await prepareCatalogSurface(input);
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(b.surface.id).toBe(a.surface.id);
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      row("2026-09-01", null, "run-3"),
      row("2026-09-02", 3, "run-2"),
    ]);
    const c = await prepareCatalogSurface(input);
    expect(c.fingerprint).not.toBe(a.fingerprint);
    expect(c.lineage[0].streams).toBeNull();
    expect(c.surface.components).toEqual([]);
    expect(c.surface.fallbackText).toContain("unavailable");
  });
  it("keeps generic catalog access and output shape unchanged", async () => {
    const result = await getCatalogStreams(actor, query);
    expect(selectAccountCatalog).toHaveBeenCalledWith({
      accountIds: [actor, workspace],
      catalogId: catalog,
      throwOnError: true,
    });
    expect(result.data?.recordings[0]).not.toHaveProperty("source_observations");
  });
  it("rejects incomplete lineage instead of claiming an authoritative chart", async () => {
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      { ...row("2026-09-01", 1), source_hash: "" },
      row("2026-09-02", 3),
    ]);
    await expect(prepareCatalogSurface(input)).rejects.toThrow("Observation lineage unavailable");
  });
});

it("serializes the actual prepared snapshot and same text through the API SDK", async () => {
  const prepared = await prepareCatalogSurface(input);
  const chunks: UIMessageChunk[] = [{ type: "start", messageId: input.assistantMessageId }];
  const writable = new WritableStream<UIMessageChunk>({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  const message = await sendCatalogSurfaceStep(writable, input.assistantMessageId, prepared);
  chunks.push({ type: "finish" });
  const response = createUIMessageStreamResponse({
    stream: new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(chunk));
        controller.close();
      },
    }),
  });
  const body = await response.text();
  await expect(JSON.stringify(prepared, null, 2) + "\n").toMatchFileSnapshot(
    "../__fixtures__/catalog-streams-v1.json",
  );
  await expect(body).toMatchFileSnapshot("../__fixtures__/catalog-streams-v1.sse");
  const decoded = body
    .split("\n\n")
    .filter(line => line.startsWith("data: {"))
    .map(line => JSON.parse(line.slice(6)));
  expect(decoded.find(c => c.type === "data-intelligent-ui-snapshot")?.data).toEqual(
    prepared.surface,
  );
  expect(decoded.some(c => c.type === "text-delta")).toBe(false);
  expect(message.parts).toContainEqual({
    type: "data-intelligent-ui-snapshot",
    id: prepared.surface.id,
    data: prepared.surface,
  });
});
it("stops before a snapshot if the output stream rejects delivery", async () => {
  const prepared = await prepareCatalogSurface(input);
  const chunks: UIMessageChunk[] = [];
  const writable = new WritableStream<UIMessageChunk>({
    write() {
      throw new Error("cancelled");
    },
  });
  await expect(
    sendCatalogSurfaceStep(writable, input.assistantMessageId, prepared),
  ).rejects.toThrow("cancelled");
  expect(chunks.some(c => c.type === "data-intelligent-ui-snapshot")).toBe(false);
  expect(writable.locked).toBe(false);
});

it("preserves a measured zero in text without inventing a positive distribution", async () => {
  vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
    row("2026-09-01", 0),
    row("2026-09-02", 0),
  ]);
  const result = await prepareCatalogSurface(input);
  expect(result.surface.components).toEqual([]);
  expect(result.surface.fallbackText).toContain("Track: 0 streams");
});
it("suppresses the chart when provider identity changes between periods", async () => {
  vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
    row("2026-09-01", 1),
    { ...row("2026-09-02", 3), provider_recording_id: "MR2" },
  ]);
  const result = await prepareCatalogSurface(input);
  expect(result.surface.components).toEqual([]);
  expect(result.lineage).toHaveLength(2);
  expect(result.surface.fallbackText).toContain("unavailable");
});

it("uses saved retrieval time and supplies a representation reading plan", async () => {
  const result = await prepareCatalogSurface(input);
  expect(result.surface.evidence[0].observedAt).toBe("2026-09-04T00:00:00.000Z");
  expect(result.surface.answer.revision).toBe(result.surface.revision);
  expect(result.surface.answer.parts).toContainEqual({
    type: "representation",
    id: "listening-distribution",
    componentId: "catalog-current-streams",
    benefit: "show-distribution",
  });
});
it("keeps an allowed unmeasured 28-day page bounded without inventing observation dates", async () => {
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  vi.mocked(selectCatalogRecordingPage).mockResolvedValue({
    songs: Array.from({ length: 25 }, (_, index) => ({
      isrc: `USAAA24000${String(index).padStart(2, "0")}`,
      name: `Track ${index}`,
    })),
    total_count: 25,
  });
  vi.mocked(selectCatalogStreamObservations).mockResolvedValue([]);
  const result = await prepareCatalogSurface({
    ...input,
    query: { ...query, since: "2026-09-01", days: 28 },
  });
  expect(result.surface.evidence).toEqual([]);
  expect(result.surface.components).toEqual([]);
  expect(result.surface.fallbackText.length).toBeLessThan(8000);
  expect(result.surface.answer.parts[0]).toMatchObject({
    type: "markdown",
    text: expect.stringContaining("56 dates missing"),
  });
});
it("delivers only the same readable answer in explicit text mode", async () => {
  const prepared = await prepareCatalogSurface(input);
  const chunks: UIMessageChunk[] = [];
  const message = await sendCatalogSurfaceStep(
    new WritableStream({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
    "message-1",
    prepared,
    "text",
  );
  expect(chunks.some(c => c.type === "data-intelligent-ui-snapshot")).toBe(false);
  expect(message.parts).toEqual([{ type: "text", text: prepared.surface.fallbackText }]);
});

it.each([
  [1, "preceding 1 day."],
  [2, "preceding 2 days."],
])("uses correct day wording for a %s-day comparison", async (days, phrase) => {
  const result = await prepareCatalogSurface({ ...input, query: { ...query, days } });
  expect(result.surface.fallbackText).toContain(phrase);
  expect(result.surface.answer.parts[0]).toMatchObject({
    type: "markdown",
    text: expect.stringContaining(phrase),
  });
});
