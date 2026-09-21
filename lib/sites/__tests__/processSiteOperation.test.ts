import { beforeEach, expect, it, vi } from "vitest";
import { processSiteOperation } from "../processSiteOperation";
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: m.artistOrgs,
}));
const m = vi.hoisted(() => ({
  access: vi.fn(),
  artistOrgs: vi.fn(),
  artist: vi.fn(),
  select: vi.fn(),
  list: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generate: vi.fn(),
  resolve: vi.fn(),
  signups: vi.fn(),
}));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: m.access,
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: m.artist }));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.select }));
vi.mock("@/lib/supabase/sites/selectSites", () => ({ selectSites: m.list }));
vi.mock("@/lib/supabase/sites/insertSite", () => ({ insertSite: m.insert }));
vi.mock("@/lib/supabase/sites/updateSite", () => ({ updateSite: m.update }));
vi.mock("@/lib/supabase/sites/selectSignups", () => ({ selectSignups: m.signups }));
vi.mock("../production/produceSite", () => ({ produceSite: m.generate }));
vi.mock("../production/startSiteProduction", () => ({ startSiteProduction: m.generate }));
vi.mock("../production/getSiteProduction", () => ({ getSiteProduction: vi.fn() }));
vi.mock("../resolveSpotifyRelease", () => ({ resolveSpotifyRelease: m.resolve }));
const id = "11111111-1111-4111-8111-111111111111";
const account = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const draft = { name: "Release" };
beforeEach(() => {
  vi.resetAllMocks();
  m.artistOrgs.mockResolvedValue([]);
  m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft, published: null });
  m.access.mockResolvedValue(false);
  m.update.mockResolvedValue({ id, revision: 3 });
  m.list.mockResolvedValue([]);
});
it("rejects missing authentication before reading data", async () => {
  await expect(processSiteOperation("", "get", { id })).rejects.toMatchObject({ status: 401 });
  expect(m.select).not.toHaveBeenCalled();
});
it("blocks foreign workspace and signup reads", async () => {
  m.select.mockResolvedValue({ id, owner_id: org });
  await expect(processSiteOperation(account, "signups", { id })).rejects.toMatchObject({
    status: 403,
  });
  expect(m.signups).not.toHaveBeenCalled();
});
it("allows organization members to list their workspace", async () => {
  m.access.mockResolvedValue(true);
  await processSiteOperation(account, "list", { organizationId: org });
  expect(m.list).toHaveBeenCalledWith(org, undefined);
});
it("never accepts caller identity from input", async () => {
  await expect(processSiteOperation(account, "list", { account_id: org })).rejects.toThrow();
});
it("creates a private draft from a Spotify link", async () => {
  m.resolve.mockResolvedValue({
    title: "Release",
    url: "https://open.spotify.com/track/abc",
    artwork: null,
  });
  await processSiteOperation(account, "create", {
    releaseUrl: "https://open.spotify.com/track/abc",
  });
  expect(m.insert).toHaveBeenCalledWith(
    expect.objectContaining({ owner_id: account, created_by: account, name: "Release" }),
  );
  expect(m.generate).not.toHaveBeenCalled();
});
it("blocks assets from another owner before metadata fetch", async () => {
  await expect(
    processSiteOperation(account, "create", {
      releaseUrl: "https://open.spotify.com/track/abc",
      assets: [{ url: "https://evil.test/file.png", type: "image", name: "x" }],
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(m.resolve).not.toHaveBeenCalled();
});
it("blocks inaccessible artist association", async () => {
  m.artist.mockResolvedValue(false);
  await expect(
    processSiteOperation(account, "create", { name: "x", brief: "y", artistId: org }),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.insert).not.toHaveBeenCalled();
});
it("rejects stale revision before generating", async () => {
  await expect(
    processSiteOperation(account, "generate", { id, revision: 1, instruction: "change" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.generate).not.toHaveBeenCalled();
});
it("reports concurrent writes after generation", async () => {
  m.generate.mockResolvedValue(draft);
  m.update.mockResolvedValue(null);
  await expect(
    processSiteOperation(account, "generate", {
      id,
      revision: 2,
      instruction: "change",
      background: false,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("publishes only saved draft and can unpublish", async () => {
  await processSiteOperation(account, "publish", { id, revision: 2 });
  expect(m.update).toHaveBeenCalledWith(
    id,
    account,
    2,
    expect.objectContaining({ published: draft }),
  );
  await processSiteOperation(account, "unpublish", { id, revision: 2 });
  expect(m.update).toHaveBeenLastCalledWith(id, account, 2, {
    published: null,
    published_at: null,
  });
});
it("does not publish a missing draft", async () => {
  m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft: null });
  await expect(processSiteOperation(account, "publish", { id, revision: 2 })).rejects.toMatchObject(
    { status: 400 },
  );
});

it("rejects attaching an accessible artist from a different workspace", async () => {
  m.access.mockResolvedValue(true);
  m.artist.mockResolvedValue(true);
  await expect(
    processSiteOperation(account, "create", {
      organizationId: org,
      artistId: id,
      name: "x",
      brief: "y",
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.insert).not.toHaveBeenCalled();
});

it("permits organization API keys to attach their own roster artist", async () => {
  m.artistOrgs.mockResolvedValue([{ organization_id: org }]);
  await processSiteOperation(org, "create", {
    organizationId: org,
    artistId: id,
    name: "x",
    brief: "y",
  });
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: org, artist_id: id }));
});
