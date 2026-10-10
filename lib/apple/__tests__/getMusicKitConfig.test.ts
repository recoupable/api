import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const limiter = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sites/activity/limitSiteRequest", () => ({ limitSiteRequest: limiter }));
const get = async () => (await import("@/app/api/sites/apple/config/route")).GET();
beforeEach(() => {
  vi.resetModules();
  limiter.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("returns a truthful unavailable response without leaking credentials", async () => {
  vi.stubEnv("APPLE_MUSIC_PRIVATE_KEY", "");
  expect(await (await get()).json()).toEqual({ configured: false });
});
it("mints a correctly signed, short-lived token restricted to Recoup's player", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  vi.stubEnv(
    "APPLE_MUSIC_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  vi.stubEnv("APPLE_MUSIC_KEY_ID", "key");
  vi.stubEnv("APPLE_MUSIC_TEAM_ID", "team");
  const response = await get();
  const { developerToken, configured } = await response.json();
  const segments = developerToken.split(".");
  expect(segments).toHaveLength(3);
  expect(JSON.parse(Buffer.from(segments[0], "base64url").toString())).toEqual({
    alg: "ES256",
    kid: "key",
  });
  const claims = JSON.parse(Buffer.from(segments[1], "base64url").toString());
  expect(configured).toBe(true);
  expect(claims.origin).toEqual(["https://app.recoupable.dev"]);
  expect(claims.exp - claims.iat).toBe(600);
  expect(
    verify(
      "sha256",
      Buffer.from(segments.slice(0, 2).join(".")),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(segments[2], "base64url"),
    ),
  ).toBe(true);
  expect(limiter).toHaveBeenCalledWith("recoup-musickit-player", "browser-config", 600);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("redacts signing failures and records a safe server diagnostic", async () => {
  vi.stubEnv("APPLE_MUSIC_PRIVATE_KEY", "malformed-private-key");
  vi.stubEnv("APPLE_MUSIC_KEY_ID", "key");
  vi.stubEnv("APPLE_MUSIC_TEAM_ID", "team");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await get();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ configured: false });
  expect(log).toHaveBeenCalled();
  expect(JSON.stringify(log.mock.calls)).not.toContain("malformed-private-key");
});
it("throttles before signing", async () => {
  vi.stubEnv("APPLE_MUSIC_PRIVATE_KEY", "malformed-private-key");
  vi.stubEnv("APPLE_MUSIC_KEY_ID", "key");
  vi.stubEnv("APPLE_MUSIC_TEAM_ID", "team");
  const { SiteError } = await import("@/lib/sites/SiteError");
  limiter.mockRejectedValueOnce(new SiteError(429, "Rate limited"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await get();
  expect(response.status).toBe(429);
});
