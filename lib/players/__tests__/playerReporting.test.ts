vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: vi.fn() }));
import { beforeEach, expect, it, vi } from "vitest";
import { readPlayerReport } from "../readPlayerReport";
const m = vi.hoisted(() => ({ select: vi.fn(), access: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/supabase/release_players/selectReleasePlayer", () => ({
  selectReleasePlayer: m.select,
}));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.access }));
vi.mock("@/lib/supabase/player_listening_events/getPlayerReport", () => ({
  getPlayerReport: m.report,
}));
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue("owner");
  m.select.mockResolvedValue({ owner_id: "owner" });
  m.report.mockResolvedValue({ reportedListeningMs: 1000 });
});
it("reports observed listening with an explicit measurement boundary", async () => {
  const result = await readPlayerReport("account", id, {});
  expect(result).toHaveProperty("measurement", "browser_reported_playback");
  expect(result).toHaveProperty("dspStreams", null);
});
it("does not expose another workspace's fan history", async () => {
  m.select.mockResolvedValue({ owner_id: "another" });
  await expect(readPlayerReport("account", id, {})).rejects.toMatchObject({ status: 404 });
  expect(m.report).not.toHaveBeenCalled();
});
