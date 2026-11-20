import { GET as publicGet } from "@/app/api/players/public/[id]/route";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getPublicPlayer } from "../getPublicPlayer";
const m = vi.hoisted(() => ({
  select: vi.fn(),
  session: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/supabase/release_players/selectReleasePlayer", () => ({
  selectReleasePlayer: m.select,
}));
vi.mock("@/lib/supabase/player_sessions/selectPlayerSession", () => ({
  selectPlayerSession: m.session,
}));
vi.mock("@/lib/supabase/player_sessions/insertPlayerSession", () => ({
  insertPlayerSession: m.insert,
}));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.limit }));
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PLAYER_SESSION_SECRET", "test-key");
  m.select.mockResolvedValue({
    id,
    name: "Release",
    enabled: true,
    revision: 1,
    spotify_url: "https://open.spotify.com/album/abc",
    apple_url: null,
    allowed_origins: ["https://artist.example"],
  });
});
it("returns only public settings, with a signed provider-bound session", async () => {
  const result = await getPublicPlayer(
    id,
    {
      provider: "spotify",
      parent: "https://artist.example",
      source: "instagram",
    },
    true,
  );
  expect(result).toMatchObject({ playerId: id, name: "Release", provider: "spotify" });
  expect(result).not.toHaveProperty("owner_id");
  expect(result).not.toHaveProperty("email");
  expect(m.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      player_id: id,
      provider: "spotify",
      acquisition: expect.objectContaining({ source: "instagram" }),
    }),
  );
});
it("rejects unregistered parents before issuing a session", async () => {
  await expect(
    getPublicPlayer(id, { provider: "spotify", parent: "https://evil.example" }, true),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.insert).not.toHaveBeenCalled();
});
it("hides disabled players and missing providers", async () => {
  m.select.mockResolvedValueOnce({ enabled: false });
  await expect(getPublicPlayer(id, {})).rejects.toMatchObject({ status: 404 });
  await expect(
    getPublicPlayer(id, { provider: "apple_music", parent: "https://artist.example" }, true),
  ).rejects.toMatchObject({
    status: 404,
  });
});

it("GET config never creates a session", async () => {
  await getPublicPlayer(id, {});
  await expect(
    getPublicPlayer(id, { provider: "spotify", parent: "https://artist.example" }),
  ).rejects.toMatchObject({ status: 400 });
  expect(m.insert).not.toHaveBeenCalled();
});
it("session acquisition requires an explicit parent", async () => {
  await expect(getPublicPlayer(id, { provider: "spotify" }, true)).rejects.toMatchObject({
    status: 400,
  });
  expect(m.insert).not.toHaveBeenCalled();
});

it("exposes configured audio only to Spotify provider sessions, not the chooser or Apple", async () => {
  m.select.mockResolvedValue({
    id,
    name: "Release",
    enabled: true,
    revision: 1,
    spotify_url: "https://open.spotify.com/track/abc",
    apple_url: "https://music.apple.com/us/album/release/123",
    allowed_origins: ["https://artist.example"],
    free_playback: "audio",
    audio_url: "https://storage.test/song.mp3",
  });
  expect(await getPublicPlayer(id, {})).not.toHaveProperty("audioUrl");
  expect(
    await getPublicPlayer(id, { provider: "spotify", parent: "https://artist.example" }, true),
  ).toMatchObject({ freePlayback: "audio", audioUrl: "https://storage.test/song.mp3" });
  expect(
    await getPublicPlayer(id, { provider: "apple_music", parent: "https://artist.example" }, true),
  ).toMatchObject({ audioUrl: null });
});

it.each(["", "public-client-id"])(
  "exposes credential-free capabilities without creating a session (%s)",
  async client => {
    vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", client);
    vi.stubEnv("PLAYER_APP_ORIGIN", "https://app.recoupable.dev");
    const result = await getPublicPlayer(id, {});
    expect(result).toMatchObject({
      capabilities: {
        version: 1,
        spotify: {
          clientConfiguration: client ? "configured" : "unconfigured",
          releaseConfigured: true,
          premiumEligibility: "unknown",
          tokenStatus: "unknown",
          scopeStatus: "unknown",
          playbackSupport: "unknown",
        },
      },
    });
    expect(result).not.toHaveProperty("spotify");
    expect(result).not.toHaveProperty("flow");
    expect(m.insert).not.toHaveBeenCalled();
  },
);
it("retains capability unknowns on fresh and resumed provider sessions", async () => {
  vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", "");
  const first = await getPublicPlayer(
    id,
    { provider: "spotify", parent: "https://artist.example" },
    true,
  );
  expect(first).toMatchObject({
    spotify: { configured: false },
    capabilities: { spotify: { clientConfiguration: "unconfigured", tokenStatus: "unknown" } },
  });
  expect(m.insert).toHaveBeenCalledTimes(1);
  if (!("flow" in first)) throw new Error("Expected session");
  m.session.mockResolvedValue({ ...m.insert.mock.calls[0][0], provider: "spotify" });
  const resumed = await getPublicPlayer(
    id,
    { provider: "spotify", parent: "https://artist.example", flow: first.flow },
    true,
  );
  expect(resumed).toMatchObject({ flow: first.flow, capabilities: first.capabilities });
  expect(m.insert).toHaveBeenCalledTimes(1);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps metadata GET credential-free, no-store and free of provider/session work", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await publicGet(new Request("https://api.example/api/players/public/" + id), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const body = await response.json();
  expect(body.capabilities.version).toBe(1);
  expect(body).not.toHaveProperty("spotify");
  expect(body).not.toHaveProperty("flow");
  expect(m.insert).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("preserves invalid public origin configuration failure", async () => {
  vi.stubEnv("PLAYER_APP_ORIGIN", "invalid");
  await expect(getPublicPlayer(id, {})).rejects.toThrow();
  expect(m.insert).not.toHaveBeenCalled();
});
