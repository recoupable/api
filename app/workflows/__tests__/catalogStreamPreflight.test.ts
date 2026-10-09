import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareCatalogStreamRunStep } from "../prepareCatalogStreamRunStep";
import { fetchCatalogStreamTrackStep } from "../fetchCatalogStreamTrackStep";
import { selectCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/selectCatalogStreamRun";
import { selectCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/selectCatalogStreamTracking";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { selectCatalogSongs } from "@/lib/supabase/catalog_songs/selectCatalogSongs";
import { fetchLuminateStreams } from "@/lib/luminate/fetchLuminateStreams";
vi.mock("@/lib/supabase/catalog_stream_runs/selectCatalogStreamRun", () => ({
  selectCatalogStreamRun: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_stream_tracking/selectCatalogStreamTracking", () => ({
  selectCatalogStreamTracking: vi.fn(),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogRecordingPage", () => ({
  selectCatalogRecordingPage: vi.fn(),
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongs", () => ({ selectCatalogSongs: vi.fn() }));
vi.mock("@/lib/supabase/catalog_stream_runs/updateCatalogStreamRun", () => ({
  updateCatalogStreamRun: vi.fn(),
}));
vi.mock("@/lib/luminate/fetchLuminateStreams", () => ({ fetchLuminateStreams: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectCatalogStreamRun).mockResolvedValue({
    id: "run",
    catalog_id: "catalog",
    revision: "v1",
    status: "queued",
    since: "2026-08-07",
    until: "2026-10-07",
  } as never);
  vi.mocked(selectCatalogStreamTracking).mockResolvedValue({
    enabled: true,
    revision: "v1",
    owner_id: "owner",
  } as never);
  vi.mocked(selectAccountCatalog).mockResolvedValue({
    account: "owner",
    catalog: "catalog",
  } as never);
  vi.mocked(selectCatalogRecordingPage).mockResolvedValue({ songs: [], total_count: 251 });
  vi.mocked(selectCatalogSongs).mockResolvedValue([{ catalog: "catalog", song: "USAAA2400001" }]);
});
describe("catalog stream preflight", () => {
  it("fails oversized catalogs before provider requests", async () => {
    await expect(prepareCatalogStreamRunStep("run")).rejects.toThrow("250");
    expect(fetchLuminateStreams).not.toHaveBeenCalled();
  });
  it.each(["disabled", "revision", "owner", "membership"])(
    "rechecks %s before provider fetch",
    async kind => {
      if (kind === "disabled")
        vi.mocked(selectCatalogStreamTracking).mockResolvedValue({
          enabled: false,
          revision: "v1",
        } as never);
      if (kind === "revision")
        vi.mocked(selectCatalogStreamTracking).mockResolvedValue({
          enabled: true,
          revision: "v2",
        } as never);
      if (kind === "owner") vi.mocked(selectAccountCatalog).mockResolvedValue(null);
      if (kind === "membership") vi.mocked(selectCatalogSongs).mockResolvedValue([]);
      await expect(fetchCatalogStreamTrackStep("run", "USAAA2400001")).rejects.toThrow();
      expect(fetchLuminateStreams).not.toHaveBeenCalled();
    },
  );
});
