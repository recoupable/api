import { expect, it, vi } from "vitest";
import { selectOAuthPersonalArtists } from "../selectOAuthPersonalArtists";
const { query } = vi.hoisted(() => ({ query: { from: vi.fn(), select: vi.fn(), eq: vi.fn() } }));
vi.mock("../../serverClient", () => ({ default: query }));
it("filters by authenticated ownership and excludes organization-managed artists", async () => {
  query.from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue({
    data: [
      { artist: { id: "personal", name: "Personal", organizations: [] } },
      { artist: { id: "organization", name: "Org", organizations: [{ organization_id: "org" }] } },
      { artist: null },
    ],
    error: null,
  });
  expect(await selectOAuthPersonalArtists("verified-owner")).toEqual([
    { id: "personal", name: "Personal" },
  ]);
  expect(query.eq).toHaveBeenCalledWith("account_id", "verified-owner");
  query.eq.mockResolvedValue({ data: null, error: new Error("database detail") });
  await expect(selectOAuthPersonalArtists("verified-owner")).rejects.toThrow(
    "Artist access unavailable",
  );
});
