import { expect, it, vi } from "vitest";
import type { AdapterFactory, Provider } from "oidc-provider";
import { resolveOAuthAccess } from "../resolveOAuthAccess";

function fixture() {
  const token = {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    aud: "https://api.example/mcp",
    scope: "mcp:read mcp:write",
    exp: 9999999999,
    isExpired: false,
  };
  const grant = {
    accountId: "alice",
    clientId: "agent",
    isExpired: false,
    getResourceScope: () => "mcp:read mcp:write",
  };
  const attribution = {
    accountId: "alice",
    clientId: "agent",
    grantId: "grant",
    extra: { context: "personal", scopes: ["mcp:read", "mcp:write"] },
  };
  const findGrant = vi.fn(async () => grant);
  const options = {
    provider: {
      AccessToken: { find: async () => token },
      Grant: { find: findGrant },
    } as unknown as Provider,
    adapter: (() => ({ find: async () => attribution })) as unknown as AdapterFactory,
    resource: token.aud,
    accountExists: vi.fn(async () => true),
  };
  return { options, token, grant, attribution, findGrant };
}
it("accepts a live token bound to the selected account, client, resource and approved scopes", async () => {
  const { options } = fixture();
  expect(await resolveOAuthAccess(options, "secret")).toMatchObject({
    accountId: "alice",
    context: "personal",
    scopes: ["mcp:read", "mcp:write"],
  });
});
it("rejects expired/revoked tokens, wrong audience, changed authority and scope escalation", async () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => {
      f.token.isExpired = true;
    },
    (f: ReturnType<typeof fixture>) => {
      f.token.aud = "https://evil.example/mcp";
    },
    (f: ReturnType<typeof fixture>) => {
      f.grant.accountId = "bob";
    },
    (f: ReturnType<typeof fixture>) => {
      f.attribution.clientId = "other";
    },
    (f: ReturnType<typeof fixture>) => {
      f.attribution.extra.context = "organization";
    },
    (f: ReturnType<typeof fixture>) => {
      f.token.scope = "mcp:delete";
    },
    (f: ReturnType<typeof fixture>) => {
      f.options.accountExists.mockResolvedValue(false);
    },
    (f: ReturnType<typeof fixture>) => {
      f.findGrant.mockResolvedValue(undefined!);
    },
  ]) {
    const f = fixture();
    change(f);
    expect(await resolveOAuthAccess(f.options, "secret")).toBeUndefined();
  }
});
