import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { exchangePlayerSpotify } from "../exchangePlayerSpotify";
const m = vi.hoisted(() => ({ session: vi.fn(), save: vi.fn(), limit: vi.fn() }));
vi.mock("../requirePlayerSession", () => ({ requirePlayerSession: m.session }));
vi.mock("@/lib/supabase/player_fans/connectPlayerFan", () => ({ connectPlayerFan: m.save }));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.limit }));
const scopes =
  "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
beforeEach(() => {
  vi.resetAllMocks();
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  { id: "fan-without-email" },
  { id: "fan-with-null-fields", email: null, display_name: null },
])("preserves optional provider data in player capture: %j", async profile => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ access_token: "token", expires_in: 3600, scope: scopes }),
    )
    .mockResolvedValueOnce(Response.json(profile));
  vi.stubGlobal("fetch", fetch);
  const timeout = vi.spyOn(AbortSignal, "timeout");
  try {
    const result = await exchangePlayerSpotify({
      code: "code",
      verifier: "v".repeat(64),
      flow: "signed",
    });
    expect(result.fanCapture).toBe(true);
    expect(m.save).toHaveBeenCalledWith("session", 1, profile, scopes.split(" "));
    expect(timeout.mock.calls).toEqual([[10000], [10000]]);
    expect(fetch.mock.calls[1][1].signal).toBe(timeout.mock.results[1].value);
  } finally {
    timeout.mockRestore();
  }
});

it.each(["http", "shape", "network"])(
  "keeps playback credentials with fanCapture false after profile %s failure",
  async failure => {
    const token = {
      access_token: "private-token",
      refresh_token: "private-refresh",
      expires_in: 3600,
      scope: scopes,
    };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(token));
    if (failure === "network") fetch.mockRejectedValueOnce(new Error("private-provider-detail"));
    else
      fetch.mockResolvedValueOnce(
        failure === "http" ? new Response("", { status: 503 }) : Response.json({ id: "" }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await exchangePlayerSpotify({
      code: "code",
      verifier: "v".repeat(64),
      flow: "signed",
    });
    expect(result).toEqual({ ...token, player_session_id: "session", fanCapture: false });
    expect(m.save).not.toHaveBeenCalled();
  },
);

it.each(["session", "admission"])("rejects %s before provider profile work", async denial => {
  const error = new Error("denied");
  if (denial === "session") m.session.mockRejectedValue(error);
  else m.limit.mockRejectedValue(error);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    exchangePlayerSpotify({ code: "code", verifier: "v".repeat(64), flow: "signed" }),
  ).rejects.toBe(error);
  expect(fetch).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});
