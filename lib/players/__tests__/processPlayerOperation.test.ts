import { beforeEach, expect, it, vi } from "vitest";
import { processPlayerOperation } from "../processPlayerOperation";
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: vi.fn() }));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  artists: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  list: vi.fn(),
  paid: vi.fn(),
  update: vi.fn(),
  audio: vi.fn(),
}));
vi.mock("@/lib/supabase/storage/selectPlayerAudio", () => ({ selectPlayerAudio: mocks.audio }));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: mocks.access }));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: mocks.artists,
}));
vi.mock("@/lib/supabase/release_players/insertReleasePlayer", () => ({
  insertReleasePlayer: mocks.insert,
}));
vi.mock("@/lib/supabase/release_players/selectReleasePlayer", () => ({
  selectReleasePlayer: mocks.select,
}));
vi.mock("@/lib/supabase/release_players/selectReleasePlayers", () => ({
  selectReleasePlayers: mocks.list,
}));
vi.mock("@/lib/supabase/release_players/updateReleasePlayer", () => ({
  updateReleasePlayer: mocks.update,
}));
vi.mock("@/lib/sites/fanConnection/hasPaidSiteSubscription", () => ({
  hasPaidSiteSubscription: mocks.paid,
}));
const owner = "10000000-0000-4000-8000-000000000001",
  artist = "10000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(owner);
  mocks.artists.mockResolvedValue([{ organization_id: owner }]);
  mocks.paid.mockResolvedValue(true);
  mocks.audio.mockResolvedValue(true);
});
it("derives ownership and creates a disabled reusable release player", async () => {
  mocks.insert.mockImplementation(async value => ({ ...value, id: artist, revision: 1 }));
  const result = await processPlayerOperation(owner, "create", {
    artistId: artist,
    name: "New release",
    spotifyUrl: "https://open.spotify.com/album/abc123",
  });
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      owner_id: owner,
      artist_id: artist,
      enabled: false,
      created_by: owner,
    }),
  );
  expect(result).toHaveProperty("listenUrl", `https://app.recoupable.dev/listen/${artist}`);
});
it("blocks an artist outside the workspace", async () => {
  mocks.artists.mockResolvedValue([]);
  await expect(
    processPlayerOperation(owner, "create", {
      artistId: artist,
      name: "Wrong artist",
      spotifyUrl: "https://open.spotify.com/album/abc123",
    }),
  ).rejects.toMatchObject({ status: 403 });
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("blocks publication without the existing paid entitlement", async () => {
  mocks.paid.mockResolvedValue(false);
  await expect(
    processPlayerOperation(owner, "create", {
      artistId: artist,
      name: "Release",
      enabled: true,
      spotifyUrl: "https://open.spotify.com/album/abc123",
    }),
  ).rejects.toMatchObject({ status: 402 });
});
it("rejects editing someone else's player and stale revisions", async () => {
  mocks.select.mockResolvedValue({ id: artist, owner_id: "elsewhere", revision: 2 });
  await expect(
    processPlayerOperation(owner, "update", { id: artist, revision: 1, enabled: true }),
  ).rejects.toMatchObject({ status: 404 });
  mocks.select.mockResolvedValue({ id: artist, owner_id: owner, revision: 2 });
  await expect(
    processPlayerOperation(owner, "update", { id: artist, revision: 1, enabled: true }),
  ).rejects.toMatchObject({ status: 409 });
});

it("updates destinations and branding without changing artist or fan ownership", async () => {
  mocks.select.mockResolvedValue({
    id: artist,
    owner_id: owner,
    artist_id: artist,
    name: "Old",
    spotify_url: "https://open.spotify.com/album/abc123",
    apple_url: null,
    allowed_origins: [],
    enabled: false,
    artwork: null,
    revision: 2,
  });
  mocks.update.mockImplementation(async (_id, _owner, _revision, patch) => ({
    ...patch,
    id: artist,
    revision: 3,
  }));
  await processPlayerOperation(owner, "update", {
    id: artist,
    revision: 2,
    name: "New",
    appleUrl: "https://music.apple.com/us/album/release/123",
  });
  expect(mocks.update).toHaveBeenCalledWith(
    artist,
    owner,
    2,
    expect.objectContaining({
      name: "New",
      apple_url: "https://music.apple.com/us/album/release/123",
    }),
  );
});

it("checks entitlement when editing an enabled player without an enabled flag", async () => {
  mocks.select.mockResolvedValue({ id: artist, owner_id: owner, enabled: true, revision: 1 });
  mocks.paid.mockResolvedValue(false);
  await expect(
    processPlayerOperation(owner, "update", { id: artist, revision: 1, name: "Published edit" }),
  ).rejects.toMatchObject({ status: 402 });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("paginates the workspace catalog instead of silently truncating it", async () => {
  mocks.list.mockResolvedValue([{ id: artist }]);
  const result = await processPlayerOperation(owner, "list", { offset: 100, limit: 1 });
  expect(mocks.list).toHaveBeenCalledWith(owner, 100, 1);
  expect(result).toMatchObject({ offset: 100, limit: 1, nextOffset: 101 });
});

it("stores the owner-selected fallback and rejects non-owned audio before creating", async () => {
  const input = {
    artistId: artist,
    name: "Release",
    spotifyUrl: "https://open.spotify.com/track/abc",
    freePlayback: "audio",
    audioUrl: "https://storage.test/song.mp3",
  };
  mocks.audio.mockResolvedValue(false);
  await expect(processPlayerOperation(owner, "create", input)).rejects.toMatchObject({
    status: 400,
  });
  expect(mocks.insert).not.toHaveBeenCalled();
  mocks.audio.mockResolvedValue(true);
  mocks.insert.mockResolvedValue({ id: artist });
  await processPlayerOperation(owner, "create", input);
  expect(mocks.audio).toHaveBeenCalledWith(owner, input.audioUrl);
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({ free_playback: "audio", audio_url: input.audioUrl }),
  );
});
it("updates fallback with revision control and can switch back to Spotify", async () => {
  mocks.select.mockResolvedValue({
    id: artist,
    owner_id: owner,
    artist_id: artist,
    name: "Release",
    spotify_url: "https://open.spotify.com/track/abc",
    apple_url: null,
    allowed_origins: [],
    enabled: false,
    artwork: null,
    revision: 1,
    free_playback: "audio",
    audio_url: "https://storage.test/song.mp3",
  });
  mocks.update.mockResolvedValue({ id: artist });
  await processPlayerOperation(owner, "update", {
    id: artist,
    revision: 1,
    freePlayback: "spotify",
    audioUrl: null,
  });
  expect(mocks.update).toHaveBeenCalledWith(
    artist,
    owner,
    1,
    expect.objectContaining({ free_playback: "spotify", audio_url: null }),
  );
});
