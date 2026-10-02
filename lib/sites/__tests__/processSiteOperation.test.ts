import { SiteError } from "../SiteError";
import { approvedConcept } from "./conceptFixture";
import { beforeEach, expect, it, vi } from "vitest";
import { processSiteOperation } from "../processSiteOperation";
vi.mock("../production/cancelSiteProduction", () => ({ cancelSiteProduction: m.cancel }));
vi.mock("../fanConnection/prepareSiteFanConnection", () => ({
  prepareSiteFanConnection: m.fanSetup,
}));
vi.mock("../production/resolveSiteArtist", () => ({
  resolveSiteArtist: vi.fn(async site => site.artist_id ?? null),
}));
vi.mock("../production/collectReleaseContext", () => ({ collectReleaseContext: m.collect }));
vi.mock("../production/proposeExperienceConcepts", () => ({
  proposeExperienceConcepts: m.propose,
}));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: m.artistOrgs,
}));
const m = vi.hoisted(() => ({
  publication: vi.fn(),
  savedBuild: vi.fn(),
  fanSetup: vi.fn().mockResolvedValue("enabled"),
  access: vi.fn(),
  collect: vi.fn(),
  propose: vi.fn(),
  brief: vi.fn(),
  artistOrgs: vi.fn(),
  artist: vi.fn(),
  select: vi.fn(),
  list: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  cancel: vi.fn(),
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
vi.mock("../production/readSiteContextBrief", () => ({ readSiteContextBrief: m.brief }));
vi.mock("../production/produceSite", () => ({ produceSite: m.generate }));
vi.mock("../production/startSiteProduction", () => ({ startSiteProduction: m.generate }));
vi.mock("../production/getSiteProduction", () => ({ getSiteProduction: vi.fn() }));
vi.mock("../resolveSpotifyRelease", () => ({ resolveSpotifyRelease: m.resolve }));
vi.mock("@/lib/supabase/sites/deleteSite", () => ({ deleteSite: m.remove }));
vi.mock("@/lib/supabase/sites/updateSitePublication", () => ({
  updateSitePublication: m.publication,
}));
vi.mock("../production/readPublishableBuild", () => ({ readPublishableBuild: m.savedBuild }));
const id = "11111111-1111-4111-8111-111111111111";
const account = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const draft = { name: "Release" };
beforeEach(() => {
  vi.resetAllMocks();
  m.artistOrgs.mockResolvedValue([]);
  m.select.mockResolvedValue({
    id,
    owner_id: account,
    revision: 2,
    brief: "",
    draft,
    published: null,
  });
  m.access.mockResolvedValue(false);
  m.update.mockResolvedValue({ id, revision: 3 });
  m.publication.mockResolvedValue({ id, revision: 2 });
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
    processSiteOperation(account, "generate", {
      approvedConcept,
      id,
      revision: 1,
      instruction: "change",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(m.generate).not.toHaveBeenCalled();
});
it("reports concurrent writes after generation", async () => {
  m.generate.mockResolvedValue(draft);
  m.update.mockResolvedValue(null);
  await expect(
    processSiteOperation(account, "generate", {
      approvedConcept,
      id,
      revision: 2,
      instruction: "change",
      background: false,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("publishes only saved draft and can unpublish", async () => {
  await processSiteOperation(account, "publish", { id, revision: 2 });
  expect(m.publication).toHaveBeenCalledWith(
    expect.objectContaining({ id, revision: 2 }),
    expect.objectContaining({ published: draft }),
  );
  await processSiteOperation(account, "unpublish", { id, revision: 2 });
  expect(m.publication).toHaveBeenLastCalledWith(expect.objectContaining({ id }), {
    artist_id: undefined,
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

it("passes the selected brief to background generation after validation", async () => {
  await processSiteOperation(account, "generate", {
    approvedConcept,
    id,
    revision: 2,
    contextBriefId: org,
  });
  expect(m.brief).toHaveBeenCalledWith(expect.objectContaining({ id }), account, org);
  expect(m.generate).toHaveBeenCalledWith(
    expect.objectContaining({ id }),
    "",
    account,
    org,
    approvedConcept,
  );
});
it("does not generate or publish from an unavailable saved brief", async () => {
  m.select.mockResolvedValue({
    id,
    owner_id: account,
    revision: 2,
    draft: { production: { context: { engine: { briefId: org } } } },
  });
  m.brief.mockRejectedValue(new Error("Evidence withdrawn"));
  await expect(
    processSiteOperation(account, "generate", { approvedConcept, id, revision: 2 }),
  ).rejects.toThrow("withdrawn");
  await expect(processSiteOperation(account, "publish", { id, revision: 2 })).rejects.toThrow(
    "withdrawn",
  );
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});

it("returns pitches without starting production or overwriting the draft", async () => {
  m.collect.mockResolvedValue({});
  m.propose.mockResolvedValue({ status: "ready", candidates: [approvedConcept], reason: "" });
  const result = await processSiteOperation(account, "concepts", { id, revision: 2 });
  expect(result).toMatchObject({ concepts: { candidates: [approvedConcept] }, revision: 2 });
  expect(m.generate).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it("starts URL-only generation without requiring a caller-selected concept", async () => {
  await processSiteOperation(account, "generate", { id, revision: 2 });
  expect(m.generate).toHaveBeenCalledWith(
    expect.objectContaining({ id }),
    "",
    account,
    undefined,
    undefined,
  );
});

it("prepares paid fan connection before publishing and reports its status", async () => {
  m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft: { name: "Draft" } });
  m.fanSetup.mockResolvedValue("enabled");
  const result = await processSiteOperation(account, "publish", {
    id,
    revision: 2,
    returnUrl: "https://app.test/s/site",
  });
  expect(m.fanSetup).toHaveBeenCalledWith(
    expect.objectContaining({ id }),
    "https://app.test/s/site",
  );
  expect(m.fanSetup.mock.invocationCallOrder.at(-1)).toBeLessThan(
    m.publication.mock.invocationCallOrder.at(-1)!,
  );
  expect(result).toHaveProperty("fanConnection", "enabled");
});
it("keeps the existing publication unchanged when automatic setup fails", async () => {
  m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft: { name: "Draft" } });
  m.fanSetup.mockRejectedValueOnce(new Error("Spotify configuration unavailable"));
  await expect(processSiteOperation(account, "publish", { id, revision: 2 })).rejects.toThrow(
    "configuration unavailable",
  );
  expect(m.update).not.toHaveBeenCalled();
});

it.each([null, { name: "Existing publication" }])(
  "does not publish or republish without a paid subscription (%j)",
  async published => {
    m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft, published });
    m.fanSetup.mockRejectedValue(new SiteError(402, "Paid subscription required to publish"));
    await expect(
      processSiteOperation(account, "publish", { id, revision: 2 }),
    ).rejects.toMatchObject({ status: 402 });
    expect(m.update).not.toHaveBeenCalled();
  },
);
it("allows unpaid workspaces to unpublish without checking paid setup", async () => {
  m.fanSetup.mockRejectedValue(new SiteError(402, "Paid subscription required"));
  await processSiteOperation(account, "unpublish", { id, revision: 2 });
  expect(m.fanSetup).not.toHaveBeenCalled();
  expect(m.publication).toHaveBeenCalledWith(expect.objectContaining({ id }), {
    published: null,
    published_at: null,
    artist_id: undefined,
  });
});

it("deletes only the authorized revision and never generates", async () => {
  m.remove.mockResolvedValue(true);
  expect(await processSiteOperation(account, "delete", { id, revision: 2 })).toEqual({
    deleted: true,
    id,
  });
  expect(m.remove).toHaveBeenCalledWith(id, account, 2);
  expect(m.generate).not.toHaveBeenCalled();
});
it("rejects deletion from a foreign workspace", async () => {
  m.select.mockResolvedValue({ id, owner_id: org, revision: 2 });
  await expect(processSiteOperation(account, "delete", { id, revision: 2 })).rejects.toMatchObject({
    status: 403,
  });
  expect(m.remove).not.toHaveBeenCalled();
});
it("rejects stale deletion and a race with a build save", async () => {
  await expect(processSiteOperation(account, "delete", { id, revision: 1 })).rejects.toMatchObject({
    status: 409,
  });
  expect(m.remove).not.toHaveBeenCalled();
  m.remove.mockResolvedValue(false);
  await expect(processSiteOperation(account, "delete", { id, revision: 2 })).rejects.toMatchObject({
    status: 409,
  });
});

it("cancels the signed active build before deletion", async () => {
  m.remove.mockResolvedValue(true);
  await processSiteOperation(account, "delete", { id, revision: 2, generationToken: "job" });
  expect(m.cancel).toHaveBeenCalledWith("job", id, account);
  expect(m.cancel.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
});

it("does not delete when active-build cancellation fails", async () => {
  m.cancel.mockRejectedValueOnce(new Error("Cancellation unavailable"));
  await expect(
    processSiteOperation(account, "delete", { id, revision: 2, generationToken: "job" }),
  ).rejects.toThrow("Cancellation unavailable");
  expect(m.remove).not.toHaveBeenCalled();
});

it("publishes an interrupted working build without a finalized draft", async () => {
  m.select.mockResolvedValue({ id, owner_id: account, revision: 2, draft: null });
  m.savedBuild.mockResolvedValue(draft);
  await processSiteOperation(account, "publish", { id, revision: 2, generationToken: "signed" });
  expect(m.savedBuild).toHaveBeenCalledWith("signed", expect.objectContaining({ id }), account);
  expect(m.publication).toHaveBeenCalledWith(
    expect.objectContaining({ id }),
    expect.objectContaining({ published: draft }),
  );
  expect(m.update).not.toHaveBeenCalled();
});
