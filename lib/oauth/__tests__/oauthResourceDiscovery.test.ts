import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as rootDiscovery } from "../../../app/.well-known/oauth-protected-resource/route";
import { GET as mcpDiscovery } from "../../../app/.well-known/oauth-protected-resource/mcp/route";

beforeEach(() => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  ["root", rootDiscovery],
  ["MCP alias", mcpDiscovery],
] as const)("%s protected-resource discovery", (_name, GET) => {
  it.each([
    "malformed-issuer-private-canary",
    "https://synthetic-account:synthetic-secret@api.example/api/oauth",
  ])("reports a fixed event for invalid configuration without logging %s", async issuer => {
    vi.stubEnv("OAUTH_ISSUER", issuer);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "oauth_unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["OAuth resource discovery unavailable", { event: "oauth_resource_discovery_unavailable" }],
    ]);
  });

  it("keeps valid discovery quiet", async () => {
    vi.stubEnv("OAUTH_ISSUER", "https://api.example/api/oauth");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      resource: "https://api.example/mcp",
      authorization_servers: ["https://api.example/api/oauth"],
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps disabled discovery quiet even with malformed configuration", async () => {
    vi.stubEnv("OAUTH_ENABLED", "false");
    vi.stubEnv("OAUTH_ISSUER", "disabled-private-canary");
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(console.error).not.toHaveBeenCalled();
  });
});
