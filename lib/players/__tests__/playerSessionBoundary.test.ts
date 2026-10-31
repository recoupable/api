import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signPlayerSession } from "../signPlayerSession";
import { exchangePlayerSpotify } from "../exchangePlayerSpotify";
import { recordListeningEvent } from "../recordListeningEvent";

const m = vi.hoisted(() => ({
  player: vi.fn(),
  session: vi.fn(),
  connect: vi.fn(),
  record: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/supabase/release_players/selectReleasePlayer", () => ({
  selectReleasePlayer: m.player,
}));
vi.mock("@/lib/supabase/player_sessions/selectPlayerSession", () => ({
  selectPlayerSession: m.session,
}));
vi.mock("@/lib/supabase/player_fans/connectPlayerFan", () => ({ connectPlayerFan: m.connect }));
vi.mock("@/lib/supabase/player_listening_events/insertPlayerListeningEvent", () => ({
  insertPlayerListeningEvent: m.record,
}));
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: m.limit }));

const playerId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const origin = "https://app.recoupable.dev";
const now = new Date("2026-10-30T00:00:00Z");
const payload = { playerId, sessionId, revision: 1, origin, expiresAt: now.getTime() + 60000 };
const event = { id: "33333333-3333-4333-8333-333333333333", provider: "spotify", event: "playing" };
let fetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("PLAYER_SESSION_SECRET", "synthetic-session-secret");
  vi.stubEnv("PLAYER_APP_ORIGIN", origin);
  vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", "synthetic-client");
  m.player.mockResolvedValue({ id: playerId, enabled: true, revision: 1 });
  m.session.mockResolvedValue({
    id: sessionId,
    player_id: playerId,
    revision: 1,
    provider: "spotify",
    created_at: now.toISOString(),
    expires_at: new Date(payload.expiresAt).toISOString(),
    connected_at: null,
  });
  m.record.mockResolvedValue(true);
  fetch = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([
  "trailing separator",
  "hidden fourth segment",
  "signature punctuation",
  "signature padding",
  "noncanonical signature bits",
])("rejects %s before fan exchange or attributed events", async variant => {
  const token = signPlayerSession(payload);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const malformed =
    variant === "trailing separator"
      ? token + "."
      : variant === "hidden fourth segment"
        ? token + "..ignored"
        : variant === "signature punctuation"
          ? token + "!"
          : variant === "signature padding"
            ? token + "="
            : token.slice(0, -1) + alphabet[alphabet.indexOf(token.at(-1)!) + 1];
  await expect(
    exchangePlayerSpotify({ code: "synthetic-code", verifier: "v".repeat(64), flow: malformed }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(recordListeningEvent(malformed, event)).rejects.toMatchObject({ status: 403 });
  expect(fetch).not.toHaveBeenCalled();
  expect(m.player).not.toHaveBeenCalled();
  expect(m.session).not.toHaveBeenCalled();
  expect(m.connect).not.toHaveBeenCalled();
  expect(m.record).not.toHaveBeenCalled();
  expect(m.limit).not.toHaveBeenCalled();
});

it.each(["expired", "wrong origin", "wrong player"])(
  "rejects %s through the real session guard",
  async variant => {
    const token = signPlayerSession({
      ...payload,
      ...(variant === "expired" ? { expiresAt: now.getTime() } : {}),
      ...(variant === "wrong origin" ? { origin: "https://other.example" } : {}),
    });
    if (variant === "wrong player")
      m.session.mockResolvedValue({
        player_id: "44444444-4444-4444-8444-444444444444",
        revision: 1,
        expires_at: new Date(payload.expiresAt).toISOString(),
      });
    await expect(
      exchangePlayerSpotify({ code: "synthetic-code", verifier: "v".repeat(64), flow: token }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(recordListeningEvent(token, event)).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
    expect(m.connect).not.toHaveBeenCalled();
    expect(m.record).not.toHaveBeenCalled();
  },
);

it("accepts the unchanged canonical credential and preserves event attribution", async () => {
  await expect(recordListeningEvent(signPlayerSession(payload), event)).resolves.toEqual({
    success: true,
    recorded: true,
  });
  expect(m.record).toHaveBeenCalledWith(sessionId, 1, expect.objectContaining(event));
});

it("rejects repeated connection exchange while allowing that session's listening events", async () => {
  const token = signPlayerSession(payload);
  m.session.mockResolvedValue({
    id: sessionId,
    player_id: playerId,
    revision: 1,
    provider: "spotify",
    created_at: now.toISOString(),
    expires_at: new Date(payload.expiresAt).toISOString(),
    connected_at: now.toISOString(),
  });
  await expect(
    exchangePlayerSpotify({ code: "synthetic-code", verifier: "v".repeat(64), flow: token }),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetch).not.toHaveBeenCalled();
  expect(m.connect).not.toHaveBeenCalled();
  await expect(recordListeningEvent(token, event)).resolves.toMatchObject({ recorded: true });
});
