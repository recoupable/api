import { afterEach, expect, it, vi } from "vitest";
import * as resourceMetadata from "../getOAuthResourceMetadata";
import { GET, OPTIONS } from "../../../app/.well-known/oauth-authorization-server/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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
  expect(OPTIONS().status).toBe(404);
});

it.each([
  "https://attacker.invalid/other",
  "https://api.recoupable.dev/api/oauth?issuer=other",
  "http://api.recoupable.dev/api/oauth",
  "invalid",
])("rejects invalid configured issuer %s", async issuer => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", issuer);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET();
  expect(log.mock.calls).toEqual([
    ["OAuth discovery alias unavailable", { event: "oauth_discovery_unavailable" }],
  ]);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
  expect(response.status).toBe(503);
  expect(response.headers.has("location")).toBe(false);
  expect(await response.json()).toEqual({ error: "oauth_unavailable" });
});

it("permits anonymous metadata preflight without credentials", () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  const response = OPTIONS();
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
  expect(response.headers.has("access-control-allow-credentials")).toBe(false);
});

it("does not log malformed operator configuration retained by URL errors", async () => {
  const issuer = "synthetic-malformed-issuer-canary";
  let urlError: unknown;
  try {
    new URL(issuer);
  } catch (error) {
    urlError = error;
  }
  expect(urlError).toHaveProperty("input", issuer);
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", issuer);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "oauth_unavailable" });
  expect(log.mock.calls).toEqual([
    ["OAuth discovery alias unavailable", { event: "oauth_discovery_unavailable" }],
  ]);
});

it("logs no raw exception fields or cause when metadata resolution throws", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  const error = Object.assign(
    new Error("synthetic-token-canary", { cause: new Error("synthetic-cause-canary") }),
    {
      input: "synthetic-issuer-canary",
      accountId: "synthetic-account-canary",
    },
  );
  vi.spyOn(resourceMetadata, "getOAuthResourceMetadata").mockImplementation(() => {
    throw error;
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.has("location")).toBe(false);
  expect(await response.json()).toEqual({ error: "oauth_unavailable" });
  expect(log.mock.calls).toEqual([
    ["OAuth discovery alias unavailable", { event: "oauth_discovery_unavailable" }],
  ]);
});

it("does not emit a failure event for successful discovery, preflight or disabled OAuth", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.stubEnv("OAUTH_ISSUER", "https://api.recoupable.dev/api/oauth");
  expect((await GET()).status).toBe(308);
  expect(OPTIONS().status).toBe(204);
  vi.stubEnv("OAUTH_ENABLED", "false");
  expect((await GET()).status).toBe(404);
  expect(OPTIONS().status).toBe(404);
  expect(log).not.toHaveBeenCalled();
});
