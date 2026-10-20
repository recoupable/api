import { afterEach, expect, it, vi } from "vitest";
import { GET, OPTIONS } from "../../../app/.well-known/oauth-authorization-server/route";

afterEach(() => vi.unstubAllEnvs());

it("links the root discovery URL to the existing path-based issuer metadata", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.recoupable.dev/api/oauth");
  const response = await GET();
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(
    "https://api.recoupable.dev/.well-known/oauth-authorization-server/api/oauth",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
});

it("does not advertise an issuer when OAuth is disabled", async () => {
  vi.stubEnv("OAUTH_ENABLED", "false");
  expect((await GET()).status).toBe(404);
});

it.each([
  "https://attacker.invalid/other",
  "https://api.recoupable.dev/api/oauth?issuer=other",
  "http://api.recoupable.dev/api/oauth",
  "invalid",
])("rejects invalid configured issuer %s", async issuer => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", issuer);
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.has("location")).toBe(false);
  expect(await response.json()).toEqual({ error: "oauth_unavailable" });
});

it("permits anonymous metadata preflight without credentials", () => {
  const response = OPTIONS();
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
});
