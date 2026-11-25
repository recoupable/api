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
    clientId: "agent",
    grantId: "grant",
    expiresAt: 9999999999,
    resource: "https://api.example/mcp",
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

it("fails closed for present malformed selected context and limited grant upgrades", async () => {
  for (const selectedContext of [
    null,
    {},
    { version: 2 },
    {
      version: 1,
      capabilityVersion: "context-workspace-v1",
      mode: "selected_context",
      kind: "personal",
      ownerId: "00000000-0000-4000-8000-000000000001",
      organizationId: null,
    },
  ]) {
    const f = fixture();
    Object.assign(f.attribution.extra, { selectedContext });
    expect(await resolveOAuthAccess(f.options, "secret")).toBeUndefined();
  }
});

it("preserves valid selected workspace attribution and rejects a different personal owner", async () => {
  const f = fixture();
  const actor = "00000000-0000-4000-8000-000000000001";
  f.token.accountId = f.grant.accountId = f.attribution.accountId = actor;
  f.token.scope = "mcp:tools";
  f.grant.getResourceScope = () => "mcp:tools";
  f.attribution.extra.scopes = ["mcp:tools"];
  const selectedContext = {
    version: 1,
    capabilityVersion: "context-workspace-v1",
    mode: "selected_context",
    kind: "personal",
    ownerId: actor,
    organizationId: null,
  };
  Object.assign(f.attribution.extra, { selectedContext });
  expect(await resolveOAuthAccess(f.options, "secret")).toBeUndefined();
  f.attribution.extra.context = "selected_context_v1";
  expect(await resolveOAuthAccess(f.options, "secret")).toMatchObject({ selectedContext });
  f.token.scope = "mcp:read";
  f.grant.getResourceScope = () => "mcp:read";
  f.attribution.extra.scopes = ["mcp:read"];
  expect(await resolveOAuthAccess(f.options, "secret")).toBeUndefined();
  f.token.scope = "mcp:tools";
  f.grant.getResourceScope = () => "mcp:tools";
  f.attribution.extra.scopes = ["mcp:tools"];
  selectedContext.ownerId = "00000000-0000-4000-8000-000000000002";
  expect(await resolveOAuthAccess(f.options, "secret")).toBeUndefined();
});

it("uses only the Privy subject recorded on the validated grant", async () => {
  const f = fixture();
  Object.assign(f.attribution.extra, { subject: "did:privy:verified-staff" });
  expect(await resolveOAuthAccess(f.options, "secret")).toMatchObject({
    subject: "did:privy:verified-staff",
  });
  Object.assign(f.attribution.extra, { subject: "staff@recoupable.com" });
  expect(await resolveOAuthAccess(f.options, "secret")).not.toHaveProperty("subject");
});
