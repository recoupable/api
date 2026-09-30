import { resolveSiteArtist } from "../../production/resolveSiteArtist";
import { updateSite } from "@/lib/supabase/sites/updateSite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { startFanConnection } from "../startFanConnection";
import { finishFanConnection } from "../finishFanConnection";
import { fanConnectionHandler } from "../fanConnectionHandler";
import { hashFanValue } from "../hashFanValue";
import { SiteError } from "../../SiteError";
vi.mock("../../production/resolveSiteArtist", () => ({
  resolveSiteArtist: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase/sites/updateSite", () => ({ updateSite: vi.fn() }));
vi.mock("@/lib/supabase/site_fan_connections/cleanupFanSessions", () => ({
  cleanupFanSessions: vi.fn(async () => {}),
}));
vi.mock("../../activity/limitSiteRequest", () => ({ limitSiteRequest: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/site_activity_events/selectSiteActivity", () => ({
  selectSiteActivity: vi.fn(),
}));
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  site: vi.fn(),
  config: vi.fn(),
  saveConfig: vi.fn(),
  fans: vi.fn(),
  authorize: vi.fn(),
  entitlement: vi.fn(),
  insert: vi.fn(),
  consume: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: m.auth }));
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: m.site }));
vi.mock("@/lib/supabase/site_fan_connections/selectFanConfig", () => ({
  selectFanConfig: m.config,
}));
vi.mock("@/lib/supabase/site_fan_connections/updateFanConfig", () => ({
  updateFanConfig: m.saveConfig,
}));
vi.mock("@/lib/supabase/site_fan_connections/selectSiteFans", () => ({ selectSiteFans: m.fans }));
vi.mock("@/lib/sites/authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.authorize }));
vi.mock("../requireFanEntitlement", () => ({ requireFanEntitlement: m.entitlement }));
vi.mock("@/lib/supabase/site_fan_connections/insertFanSession", () => ({
  insertFanSession: m.insert,
}));
vi.mock("@/lib/supabase/site_fan_connections/consumeFanSession", () => ({
  consumeFanSession: m.consume,
}));
vi.mock("@/lib/supabase/site_fan_connections/completeFanConnection", () => ({
  completeFanConnection: m.complete,
}));
const id = "11111111-1111-4111-8111-111111111111";
const origin = "https://api.example.com";
const url = `${origin}/api/sites/public/${id}/spotify`;
const config = {
  site_id: id,
  return_url: "https://artist.example.com/release",
  marketing_text: "Receive release news and offers from Artist.",
  revision: 1,
  enabled: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SITES_SPOTIFY_CLIENT_ID", "public-client");
  vi.stubEnv("SITES_FAN_SPOTIFY_REDIRECT_URI", `${origin}/api/sites/spotify/callback`);
  m.auth.mockResolvedValue({ accountId: "owner" });
  m.site.mockResolvedValue({ id, owner_id: "owner", artist_id: "artist", name: "Artist <script>" });
  m.config.mockResolvedValue(config);
  m.entitlement.mockResolvedValue(undefined);
  m.authorize.mockResolvedValue("owner");
});
it("blocks cross-workspace fan reads before touching fan data", async () => {
  m.authorize.mockRejectedValue(new SiteError(403, "Workspace not available"));
  const response = await fanConnectionHandler(
    new NextRequest(`${origin}/api/sites/${id}/fans`),
    id,
    "fans",
  );
  expect(response.status).toBe(403);
  expect(m.fans).not.toHaveBeenCalled();
});
it("requires paid activation and leaves settings unchanged on failure", async () => {
  m.entitlement.mockRejectedValue(new SiteError(402, "Paid subscription required"));
  const response = await fanConnectionHandler(
    new NextRequest(`${origin}/api/sites/${id}/fan-connection`, {
      method: "PUT",
      body: JSON.stringify({
        returnUrl: config.return_url,
        marketingText: config.marketing_text,
        enabled: true,
        revision: 0,
      }),
    }),
    id,
    "configure",
  );
  expect(response.status).toBe(402);
  expect(m.saveConfig).not.toHaveBeenCalled();
});
it("shows one explicit agreement and starts only with the bound form", async () => {
  const page = await startFanConnection(new NextRequest(url), id);
  const html = await page.text();
  expect(html).toContain("Agree and connect with Spotify");
  expect(html).toContain("Artist &lt;script&gt;");
  const csrfCookie = page.cookies
    .getAll()
    .find(cookie => cookie.name.startsWith("__Host-recoup-fan-form-"))!;
  const csrfName = csrfCookie.name;
  const csrf = csrfCookie.value;
  const response = await startFanConnection(
    new NextRequest(url, {
      method: "POST",
      headers: { origin, cookie: `${csrfName}=${csrf}` },
      body: new URLSearchParams({ csrf, accept: "yes", revision: "1" }),
    }),
    id,
  );
  expect(response.status).toBe(303);
  const redirect = new URL(response.headers.get("location")!);
  expect(redirect.origin).toBe("https://accounts.spotify.com");
  expect(redirect.searchParams.get("code_challenge_method")).toBe("S256");
  expect(m.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      site_id: id,
      marketing_text: config.marketing_text,
      return_url: config.return_url,
    }),
  );
  const saved = m.insert.mock.calls[0][0];
  expect(saved.state_hash).toBe(hashFanValue(redirect.searchParams.get("state")!));
});
it("rejects a forged form and changed consent revision", async () => {
  const csrf = "a".repeat(64);
  const cookie = `__Host-recoup-fan-form-${hashFanValue(csrf).slice(0, 16)}=${csrf}`;
  const forged = await startFanConnection(
    new NextRequest(url, {
      method: "POST",
      headers: { origin: "https://attacker.example", cookie },
      body: new URLSearchParams({ csrf, accept: "yes", revision: "1" }),
    }),
    id,
  );
  expect(forged.status).toBe(403);
  const stale = await startFanConnection(
    new NextRequest(url, {
      method: "POST",
      headers: { origin, cookie },
      body: new URLSearchParams({ csrf, accept: "yes", revision: "0" }),
    }),
    id,
  );
  expect(stale.status).toBe(409);
  expect(m.insert).not.toHaveBeenCalled();
});
const callbackRequest = () => {
  const state = "a".repeat(64),
    browser = "b".repeat(64);
  return new NextRequest(`${origin}/api/sites/spotify/callback?state=${state}&code=provider-code`, {
    headers: { cookie: `__Host-recoup-fan-${hashFanValue(state).slice(0, 16)}=${browser}` },
  });
};
it("never exchanges a code for an unclaimed or replayed session", async () => {
  m.consume.mockResolvedValue(null);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await finishFanConnection(callbackRequest())).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
  expect(m.complete).not.toHaveBeenCalled();
});
it("saves provider identity and actual scopes before reporting success", async () => {
  m.consume.mockResolvedValue({
    state_hash: hashFanValue("a".repeat(64)),
    site_id: id,
    return_url: config.return_url,
    config_revision: 1,
    verifier: "verifier",
    scopes: ["user-read-email", "user-read-private"],
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        access_token: "private-provider-token",
        scope: "user-read-email user-read-private",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ id: "fan-123", display_name: "Fan", email: "fan@example.com" }),
    );
  vi.stubGlobal("fetch", fetch);
  const response = await finishFanConnection(callbackRequest());
  expect(m.complete).toHaveBeenCalledWith(
    expect.objectContaining({
      spotifyId: "fan-123",
      email: "fan@example.com",
      scopes: ["user-read-email", "user-read-private"],
    }),
  );
  expect(response.headers.get("location")).toBe(`${config.return_url}?recoup_spotify=connected`);
  expect(JSON.stringify(m.complete.mock.calls)).not.toContain("private-provider-token");
  m.complete.mockRejectedValue(new Error("Database unavailable"));
  fetch
    .mockResolvedValueOnce(
      Response.json({ access_token: "t", scope: "user-read-email user-read-private" }),
    )
    .mockResolvedValueOnce(Response.json({ id: "fan-123" }));
  expect((await finishFanConnection(callbackRequest())).headers.get("location")).toContain(
    "recoup_spotify=failed",
  );
});
it("does not record partial Spotify grants as complete", async () => {
  m.consume.mockResolvedValue({
    state_hash: "hash",
    site_id: id,
    return_url: config.return_url,
    config_revision: 1,
    verifier: "v",
    scopes: ["user-read-email", "user-read-private"],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ access_token: "t", scope: "user-read-private" })),
  );
  expect((await finishFanConnection(callbackRequest())).headers.get("location")).toContain(
    "recoup_spotify=failed",
  );
  expect(m.complete).not.toHaveBeenCalled();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps concurrently opened agreement pages independent", async () => {
  const first = await startFanConnection(new NextRequest(url), id);
  const second = await startFanConnection(new NextRequest(url), id);
  expect(first.cookies.getAll()[0].name).not.toBe(second.cookies.getAll()[0].name);
});

it("attributes a URL-only saved draft before enabling fan capture", async () => {
  const saved = { id, owner_id: "owner", artist_id: null, revision: 2, draft: {} };
  m.site.mockResolvedValue(saved);
  vi.mocked(resolveSiteArtist).mockResolvedValue("artist");
  vi.mocked(updateSite).mockResolvedValue({ ...saved, artist_id: "artist", revision: 3 } as never);
  m.saveConfig.mockResolvedValue(config);
  const response = await fanConnectionHandler(
    new NextRequest(`${origin}/api/sites/${id}/fan-connection`, {
      method: "PUT",
      body: JSON.stringify({
        returnUrl: config.return_url,
        marketingText: config.marketing_text,
        enabled: true,
        revision: 0,
      }),
    }),
    id,
    "configure",
  );
  expect(response.status).toBe(200);
  expect(updateSite).toHaveBeenCalledWith(id, "owner", 2, { artist_id: "artist" });
  expect((await response.json()).artistId).toBe("artist");
});
