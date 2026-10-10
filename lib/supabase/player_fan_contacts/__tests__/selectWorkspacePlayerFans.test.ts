import { expect, it, vi } from "vitest";
import { selectWorkspacePlayerFans } from "../selectWorkspacePlayerFans";
const m = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("../../release_players/playerDatabase", () => ({
  playerDatabase: () => ({ from: () => m }),
}));
it("returns a contact with artist relationships without exposing Spotify identity keys", async () => {
  for (const fn of [m.select, m.eq, m.order]) fn.mockReturnValue(m);
  m.range.mockResolvedValue({
    error: null,
    data: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        provider: "spotify",
        provider_id: "must-stay-private",
        email: null,
        display_name: "Fan",
        first_connected_at: "first",
        last_connected_at: "last",
        artists: [
          {
            artist_id: "10000000-0000-4000-8000-000000000002",
            first_connected_at: "first",
            last_connected_at: "last",
          },
        ],
      },
    ],
  });
  const fans = await selectWorkspacePlayerFans("owner", 0, 50);
  expect(fans).toHaveLength(1);
  expect(fans[0].artists).toHaveLength(1);
  expect(fans[0]).not.toHaveProperty("provider_id");
  expect(m.eq).toHaveBeenCalledWith("owner_id", "owner");
});
