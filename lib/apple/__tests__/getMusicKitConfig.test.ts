import { generateKeyPairSync } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { GET } from "@/app/api/sites/apple/config/route";
afterEach(() => {
  delete process.env.APPLE_MUSIC_PRIVATE_KEY;
  delete process.env.APPLE_MUSIC_KEY_ID;
  delete process.env.APPLE_MUSIC_TEAM_ID;
});
it("returns a truthful unavailable response without leaking credentials", async () => {
  delete process.env.APPLE_MUSIC_PRIVATE_KEY;
  const response = await GET();
  expect(await response.json()).toEqual({ configured: false });
});
it("mints a short lived browser token restricted to Recoup's player", async () => {
  process.env.APPLE_MUSIC_PRIVATE_KEY = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.APPLE_MUSIC_KEY_ID = "key";
  process.env.APPLE_MUSIC_TEAM_ID = "team";
  const response = await GET();
  const { developerToken, configured } = await response.json();
  const claims = JSON.parse(Buffer.from(developerToken.split(".")[1], "base64url").toString());
  expect(configured).toBe(true);
  expect(claims.origin).toEqual(["https://app.recoupable.dev"]);
  expect(claims.exp - claims.iat).toBe(600);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
