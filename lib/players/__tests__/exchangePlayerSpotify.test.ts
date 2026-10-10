import { beforeEach, expect, it, vi } from "vitest";
import { exchangePlayerSpotify } from "../exchangePlayerSpotify";
const m = vi.hoisted(() => ({ session: vi.fn(), save: vi.fn(), limit: vi.fn() }));
vi.mock("../requirePlayerSession", () => ({ requirePlayerSession: m.session }));
vi.mock("@/lib/supabase/player_fans/connectPlayerFan", () => ({ connectPlayerFan: m.save }));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.limit }));
const scopes =
  "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", "server-client");
  m.session.mockResolvedValue({
    context: { sessionId: "session", revision: 1, playerId: "player" },
    session: { provider: "spotify", created_at: new Date().toISOString(), connected_at: null },
  });
});
it("captures only Spotify-confirmed profile and binds returned credentials to the listening session", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "private-token", expires_in: 3600, scope: scopes }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "provider-id", email: "verified@example.com" }),
    });
  vi.stubGlobal("fetch", fetch);
  m.save.mockResolvedValue("fan-id");
  const result = await exchangePlayerSpotify({
    code: "code",
    verifier: "v".repeat(64),
    flow: "signed",
  });
  expect(m.save).toHaveBeenCalledTimes(1);
  expect(m.save).toHaveBeenCalledWith(
    "session",
    1,
    { id: "provider-id", email: "verified@example.com" },
    scopes.split(" "),
  );
  expect(result).toMatchObject({ player_session_id: "session", fanCapture: true });
  expect(result).not.toHaveProperty("email");
  expect(result).not.toHaveProperty("fanId");
  expect(fetch.mock.calls[0][1].body.get("client_id")).toBe("server-client");
});
it("rejects missing permissions before saving a fan", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token", expires_in: 3600, scope: "streaming" }),
    }),
  );
  await expect(
    exchangePlayerSpotify({ code: "code", verifier: "v".repeat(64), flow: "signed" }),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.save).not.toHaveBeenCalled();
});
it("rejects supplied emails, old sessions, and Apple sessions", async () => {
  await expect(
    exchangePlayerSpotify({
      code: "code",
      verifier: "v".repeat(64),
      flow: "signed",
      email: "forged@example.com",
    }),
  ).rejects.toThrow();
  m.session.mockResolvedValue({
    context: {},
    session: { provider: "apple_music", created_at: new Date().toISOString() },
  });
  await expect(
    exchangePlayerSpotify({ code: "code", verifier: "v".repeat(64), flow: "signed" }),
  ).rejects.toMatchObject({ status: 403 });
});

it("rejects stale Spotify authorization sessions before exchanging credentials", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  m.session.mockResolvedValue({
    context: {},
    session: {
      provider: "spotify",
      created_at: new Date(Date.now() - 11 * 60000).toISOString(),
      connected_at: null,
    },
  });
  await expect(
    exchangePlayerSpotify({ code: "code", verifier: "v".repeat(64), flow: "signed" }),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetch).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});
