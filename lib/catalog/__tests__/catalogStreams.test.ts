import { beforeEach, describe, expect, it, vi } from "vitest";
import { manageCatalogStreamTracking } from "../manageCatalogStreamTracking";
import { getCatalogStreams } from "../getCatalogStreams";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { upsertCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/upsertCatalogStreamTracking";
import { selectCatalogStreamObservations } from "@/lib/supabase/catalog_stream_observations/selectCatalogStreamObservations";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { startCatalogStreamRun } from "../startCatalogStreamRun";
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn().mockResolvedValue(0),
}));
vi.mock("../getCatalogOwnerIds", () => ({
  getCatalogOwnerIds: vi.fn().mockResolvedValue(["owner"]),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_stream_tracking/selectCatalogStreamTracking", () => ({
  selectCatalogStreamTracking: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/supabase/catalog_stream_tracking/upsertCatalogStreamTracking", () => ({
  upsertCatalogStreamTracking: vi.fn().mockResolvedValue({ enabled: true }),
}));
vi.mock("@/lib/supabase/catalog_stream_runs/selectLatestCatalogStreamRun", () => ({
  selectLatestCatalogStreamRun: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogRecordingPage", () => ({
  selectCatalogRecordingPage: vi
    .fn()
    .mockResolvedValue({ songs: [{ isrc: "USAAA2400001", name: "Track" }], total_count: 1 }),
}));
vi.mock("@/lib/supabase/catalog_stream_observations/selectCatalogStreamObservations", () => ({
  selectCatalogStreamObservations: vi.fn(),
}));
vi.mock("../startCatalogStreamRun", () => ({
  startCatalogStreamRun: vi.fn().mockResolvedValue({ state: "started", run_id: "run" }),
}));
const catalog = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectAccountCatalog).mockResolvedValue({ account: "owner", catalog } as never);
  vi.mocked(selectCatalogStreamObservations).mockResolvedValue([]);
});
describe("catalog daily streams", () => {
  it("denies inaccessible catalog before writes or provider work", async () => {
    vi.mocked(selectAccountCatalog).mockResolvedValue(null);
    expect(
      await manageCatalogStreamTracking("account", { catalog_id: catalog, action: "enable" }),
    ).toEqual({ error: "Catalog not found", status: 404 });
    expect(upsertCatalogStreamTracking).not.toHaveBeenCalled();
    expect(startCatalogStreamRun).not.toHaveBeenCalled();
  });
  it("enables tracking and starts initial backfill", async () => {
    expect(
      await manageCatalogStreamTracking("account", { catalog_id: catalog, action: "enable" }),
    ).toMatchObject({ data: { tracking: { enabled: true }, collection: { state: "started" } } });
    expect(upsertCatalogStreamTracking).toHaveBeenCalledWith({
      catalog_id: catalog,
      owner_id: "owner",
      enabled: true,
    });
    expect(consumeOAuthRateLimit).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), [
      { key: expect.stringMatching(/^[a-f0-9]{64}$/), limit: 10 },
    ]);
  });
  it("throttles repeated controls before writes or provider traffic", async () => {
    vi.mocked(consumeOAuthRateLimit).mockResolvedValueOnce(30);
    expect(
      await manageCatalogStreamTracking("account", { catalog_id: catalog, action: "enable" }),
    ).toEqual({ error: "Too many tracking requests", status: 429 });
    expect(upsertCatalogStreamTracking).not.toHaveBeenCalled();
    expect(startCatalogStreamRun).not.toHaveBeenCalled();
  });
  it("pauses without starting a workflow", async () => {
    await manageCatalogStreamTracking("account", { catalog_id: catalog, action: "disable" });
    expect(startCatalogStreamRun).not.toHaveBeenCalled();
    expect(upsertCatalogStreamTracking).toHaveBeenCalledWith({
      catalog_id: catalog,
      owner_id: "owner",
      enabled: false,
    });
  });
  it("keeps unmeasured recordings visible and suppresses growth", async () => {
    const r = await getCatalogStreams("account", {
      catalog_id: catalog,
      since: "2026-09-02",
      days: 1,
      page: 1,
      limit: 25,
    });
    expect(r).toMatchObject({
      data: { platform: "all_dsps", recordings: [{ state: "incomplete", current_streams: null }] },
    });
  });
  it("compares complete equal 366-day periods without changing collection", async () => {
    const boundary = Date.parse("2024-01-01T00:00:00Z");
    const day = 86400000;
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue(
      Array.from({ length: 732 }, (_, index) => ({
        date: new Date(boundary + (index - 366) * day).toISOString().slice(0, 10),
        streams: index < 366 ? 1 : 3,
        provider_recording_id: "MR1",
        retrieved_at: "2025-01-03",
        run_id: "run",
      })) as never,
    );
    const result = await getCatalogStreams("account", {
      catalog_id: catalog,
      since: "2024-01-01",
      days: 366,
      page: 1,
      limit: 25,
    });
    expect(selectCatalogStreamObservations).toHaveBeenCalledWith({
      catalogId: catalog,
      isrc: "USAAA2400001",
      since: "2022-12-31",
      until: "2025-01-01",
    });
    expect(result).toMatchObject({
      data: {
        periods: { days: 366 },
        recordings: [
          {
            state: "comparable",
            previous_streams: 366,
            current_streams: 1098,
            percentage_growth: 200,
          },
        ],
      },
    });
    expect(startCatalogStreamRun).not.toHaveBeenCalled();
  });
  it("uses latest correction and preserves missing days", async () => {
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      { date: "2026-09-02", streams: 3, provider_recording_id: "MR1", retrieved_at: "2026-09-04" },
      { date: "2026-09-02", streams: 2, provider_recording_id: "MR1", retrieved_at: "2026-09-03" },
      { date: "2026-09-01", streams: 1, provider_recording_id: "MR1", retrieved_at: "2026-09-03" },
    ] as never);
    const r = await getCatalogStreams("account", {
      catalog_id: catalog,
      since: "2026-09-02",
      days: 1,
      page: 1,
      limit: 25,
    });
    expect(r).toMatchObject({
      data: { recordings: [{ previous_streams: 1, current_streams: 3, percentage_growth: 200 }] },
    });
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      {
        date: "2026-09-01",
        streams: null,
        provider_recording_id: "MR1",
        retrieved_at: "2026-09-04",
      },
      { date: "2026-09-01", streams: 1, provider_recording_id: "MR1", retrieved_at: "2026-09-03" },
      { date: "2026-09-02", streams: 3, provider_recording_id: "MR1", retrieved_at: "2026-09-03" },
    ] as never);
    expect(
      await getCatalogStreams("account", {
        catalog_id: catalog,
        since: "2026-09-02",
        days: 1,
        page: 1,
        limit: 25,
      }),
    ).toMatchObject({
      data: {
        recordings: [
          { state: "incomplete", missing_days: ["2026-09-01"], percentage_growth: null },
        ],
      },
    });
  });
  it("never joins different provider recording identities into growth", async () => {
    vi.mocked(selectCatalogStreamObservations).mockResolvedValue([
      { date: "2026-09-01", streams: 1, provider_recording_id: "MR1", retrieved_at: "2026-09-03" },
      { date: "2026-09-02", streams: 3, provider_recording_id: "MR2", retrieved_at: "2026-09-04" },
    ] as never);
    expect(
      await getCatalogStreams("account", {
        catalog_id: catalog,
        since: "2026-09-02",
        days: 1,
        page: 1,
        limit: 25,
      }),
    ).toMatchObject({ data: { recordings: [{ state: "incomplete", percentage_growth: null }] } });
  });
});
