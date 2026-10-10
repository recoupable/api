import { z } from "zod";
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: vi.fn() }));
import { beforeEach, expect, it, vi } from "vitest";
import { readPlayerFans } from "../readPlayerFans";
const m = vi.hoisted(() => ({ access: vi.fn(), player: vi.fn(), fans: vi.fn() }));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.access }));
vi.mock("@/lib/supabase/release_players/selectReleasePlayer", () => ({
  selectReleasePlayer: m.player,
}));
vi.mock("@/lib/supabase/player_fans/selectPlayerFans", () => ({ selectPlayerFans: m.fans }));
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue("owner");
  m.player.mockResolvedValue({ owner_id: "owner", artist_id: "artist" });
  m.fans.mockResolvedValue([{ email: "verified@example.test" }]);
});
it("returns the artist's fans across releases only within the owning workspace", async () => {
  expect(await readPlayerFans("account", id, {})).toMatchObject({
    marketingConsent: false,
    fans: [{ email: "verified@example.test" }],
  });
  expect(m.fans).toHaveBeenCalledWith("owner", "artist", 0, 50);
});
it("blocks cross-workspace and malformed pagination", async () => {
  m.player.mockResolvedValue({ owner_id: "other" });
  await expect(readPlayerFans("account", id, {})).rejects.toMatchObject({ status: 404 });
  m.player.mockResolvedValue({ owner_id: "owner", artist_id: "artist" });
  await expect(readPlayerFans("account", id, { limit: 10000 })).rejects.toBeInstanceOf(z.ZodError);
  expect(m.fans).not.toHaveBeenCalled();
});
