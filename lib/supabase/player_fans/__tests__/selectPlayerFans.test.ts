import { expect, it, vi } from "vitest";
import { selectPlayerFans } from "../selectPlayerFans";
const m = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("../../release_players/playerDatabase", () => ({
  playerDatabase: () => ({ from: () => m }),
}));
it("keeps relationship IDs but reads the latest profile from the owning contact", async () => {
  for (const fn of [m.select, m.eq, m.order]) fn.mockReturnValue(m);
  m.range.mockResolvedValue({
    data: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        contact_id: "10000000-0000-4000-8000-000000000002",
        provider: "spotify",
        email: "old@test.test",
        display_name: "Old",
        first_connected_at: "first",
        last_connected_at: "last",
        contact: { email: "new@test.test", display_name: "New" },
      },
    ],
    error: null,
  });
  expect(await selectPlayerFans("owner", "artist", 0, 50)).toEqual([
    {
      id: "10000000-0000-4000-8000-000000000001",
      contact_id: "10000000-0000-4000-8000-000000000002",
      provider: "spotify",
      email: "new@test.test",
      display_name: "New",
      first_connected_at: "first",
      last_connected_at: "last",
    },
  ]);
  expect(m.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(m.eq).toHaveBeenCalledWith("artist_id", "artist");
});
