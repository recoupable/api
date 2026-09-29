import { beforeEach, expect, it, vi } from "vitest";
import { resolveSiteArtist } from "../production/resolveSiteArtist";
import type { Site, SiteSnapshot } from "../schema";
const m = vi.hoisted(() => ({ rpc: vi.fn(), owners: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: m.rpc }));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: m.owners,
}));
const artist = "11111111-1111-4111-8111-111111111111";
const site = { owner_id: "owner", artist_id: null } as Site;
const draft = { production: { context: { engine: { requestIds: ["request"] } } } } as SiteSnapshot;
beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockResolvedValue({ output: { artists: [{ artistId: artist, order: 0 }] } });
  m.owners.mockResolvedValue([{ organization_id: "owner" }]);
});
it("resolves the credited artist only through the site's scoped request", async () => {
  expect(await resolveSiteArtist(site, draft)).toBe(artist);
  expect(m.rpc).toHaveBeenCalledWith("read_context_request", {
    p_owner: "owner",
    p_request: "request",
  });
});
it("preserves an explicitly selected artist", async () => {
  expect(await resolveSiteArtist({ ...site, artist_id: artist }, draft)).toBe(artist);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("does not attribute fans to an artist outside the workspace", async () => {
  m.owners.mockResolvedValue([{ organization_id: "other" }]);
  expect(await resolveSiteArtist(site, draft)).toBeNull();
});
