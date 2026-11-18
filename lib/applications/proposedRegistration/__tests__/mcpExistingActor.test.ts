import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase/serverClient";
import { fixture } from "../../../../scripts/application-registration-proposal/setup";

const leaves = vi.hoisted(() => ({
  verifyAccess: vi.fn(),
  privy: vi.fn(),
  provision: vi.fn(),
  runtimeImports: 0,
  subject: "synthetic-subject",
  appId: "synthetic-app",
  profileId: "synthetic-subject",
}));
vi.mock("@/lib/privy/client", () => ({
  default: { utils: () => ({ auth: () => ({ verifyAuthToken: leaves.privy }) }) },
}));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: leaves.provision,
}));
const request = (token = fixture.key, extra: Record<string, string> = {}, body?: unknown) =>
  new NextRequest("https://fixture.invalid/mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, ...extra },
    body: JSON.stringify(body ?? {}),
  });
async function verify(req = request()) {
  const { verifyExistingApplicationMcpActor } = await import(
    "@/lib/mcp/applications/verifyExistingApplicationMcpActor"
  );
  return verifyExistingApplicationMcpActor(req);
}
async function denied(req: NextRequest, status: number) {
  const result = await verify(req);
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(status);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const text = await response.text();
  expect(JSON.parse(text).status).toBe("error");
  expect(text).not.toMatch(/recoup_sk_|synthetic-privy|PRIVATE_SENTINEL|fixture@example|Basic /);
}
beforeEach(() => {
  vi.resetModules();
  leaves.runtimeImports = 0;
  leaves.subject = leaves.profileId = "synthetic-subject";
  leaves.appId = "synthetic-app";
  fixture.keyId = "22222222-2222-4222-8222-222222222222";
  vi.stubEnv("OAUTH_ENABLED", "false");
  leaves.verifyAccess.mockReset().mockResolvedValue(undefined);
  leaves.provision.mockReset().mockImplementation(() => {
    throw new Error("PRIVATE_SENTINEL forbidden provisioning");
  });
  leaves.privy.mockReset().mockImplementation(async (token: string) => {
    if (token !== "synthetic-privy") throw new Error("PRIVATE_SENTINEL invalid token");
    return { app_id: leaves.appId, issuer: "privy.io", user_id: leaves.subject };
  });
  vi.doMock("@/lib/oauth/getOAuthRuntime", () => {
    leaves.runtimeImports++;
    if (process.env.OAUTH_ENABLED !== "true") throw new Error("Disabled runtime import");
    return { getOAuthRuntime: () => ({ verifyAccess: leaves.verifyAccess }) };
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, options?: RequestInit) => {
      expect(url).toBe(`https://api.privy.io/v1/users/${leaves.subject}`);
      expect(options?.method).toBe("GET");
      expect(options?.headers).toEqual({
        "privy-app-id": "synthetic-app",
        Authorization: `Basic ${btoa("synthetic-app:synthetic-registration-secret")}`,
      });
      return {
        ok: true,
        json: async () => ({
          id: leaves.profileId,
          linked_accounts: [{ type: "email", address: "fixture@example.invalid" }],
        }),
      };
    }),
  );
});
afterEach(() => {
  expect(leaves.provision).not.toHaveBeenCalled();
  expect(fixture.sends).toBe(0);
  vi.unstubAllEnvs();
});

it.each([undefined, "false", "TRUE"])("disabled OAuth %s never imports its runtime", async flag => {
  vi.stubEnv("OAUTH_ENABLED", flag);
  const result = await verify();
  expect(result).toEqual({
    actor: fixture.actor,
    workspace: fixture.actor,
    verificationEvidence: {
      principal: {
        mechanism: "recoup_api_key",
        keyId: fixture.keyId,
        actorAccountId: fixture.actor,
      },
      effectiveAccountId: fixture.actor,
      accountAccess: { basis: "self" },
      organizationAccess: null,
      executionResources: {
        status: "unresolved",
        reason: "resource_authorization_contract_missing",
      },
    },
  });
  expect(JSON.stringify(result)).not.toContain(fixture.key);
  expect(JSON.stringify(result)).not.toMatch(/authToken|linked_accounts|fixture@example/);
  expect(leaves.runtimeImports).toBe(0);
  expect(leaves.verifyAccess).not.toHaveBeenCalled();
  expect(fixture.queries).toEqual(["account_api_keys"]);
  expect(leaves.privy).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("disabled OAuth rejects opaque tokens without importing runtime or provisioning", async () => {
  await denied(request("synthetic-opaque"), 401);
  expect(leaves.runtimeImports).toBe(0);
  expect(leaves.verifyAccess).not.toHaveBeenCalled();
  expect(fixture.queries).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
it("standard storage failure produces only a bounded unavailable result", async () => {
  const failure = vi.spyOn(supabase, "from").mockImplementationOnce(() => {
    throw new Error("PRIVATE_SENTINEL storage detail");
  });
  try {
    await denied(request(), 503);
  } finally {
    failure.mockRestore();
  }
});
it.each([["mcp:tools"], ["mcp:read"]])(
  "denies valid delegated %j before standard verification",
  async scopes => {
    vi.stubEnv("OAUTH_ENABLED", "true");
    leaves.verifyAccess.mockResolvedValue({
      accountId: fixture.actor,
      scopes,
      grantId: "grant",
      clientId: "client",
      resource: "https://fixture.invalid/mcp",
      context: "personal",
      expiresAt: 9999999999,
    });
    await denied(request("synthetic-oauth"), 403);
    expect(leaves.runtimeImports).toBe(1);
    expect(leaves.verifyAccess).toHaveBeenCalledExactlyOnceWith("synthetic-oauth");
    expect(leaves.privy).not.toHaveBeenCalled();
    expect(fixture.queries).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("enabled undefined classification requires independent supported verification", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  expect(await verify()).toMatchObject({ actor: fixture.actor });
  await denied(request("synthetic-invalid-or-revoked-opaque"), 401);
  expect(leaves.verifyAccess).toHaveBeenCalledTimes(2);
  expect(fixture.queries).toEqual(["account_api_keys"]);
});
it("runtime failure denies without any legacy fallback or secret error", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  leaves.verifyAccess.mockRejectedValue(new Error("PRIVATE_SENTINEL"));
  await denied(request(), 503);
  expect(fixture.queries).toEqual([]);
  expect(leaves.privy).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("returns only copied internal evidence for an existing Privy account", async () => {
  const result = await verify(request("synthetic-privy"));
  expect(Object.keys(result).sort()).toEqual(["actor", "verificationEvidence", "workspace"]);
  expect(result).toEqual({
    actor: fixture.actor,
    workspace: fixture.actor,
    verificationEvidence: {
      principal: {
        mechanism: "privy",
        subject: leaves.subject,
        appId: leaves.appId,
        issuer: "privy.io",
        actorAccountId: fixture.actor,
      },
      effectiveAccountId: fixture.actor,
      accountAccess: { basis: "self" },
      organizationAccess: null,
      executionResources: {
        status: "unresolved",
        reason: "resource_authorization_contract_missing",
      },
    },
  });
  expect(JSON.stringify(result)).not.toMatch(
    /synthetic-privy|authToken|linked_accounts|fixture@example/,
  );
  expect(fixture.queries).toEqual(["account_emails"]);
  expect(leaves.privy).toHaveBeenCalledExactlyOnceWith("synthetic-privy");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("denies an unknown existing account without provisioning", async () => {
  fixture.accountPresent = false;
  await denied(request("synthetic-privy"), 401);
  expect(fixture.queries).toEqual(["account_emails"]);
});
it.each(["app", "profile"])("denies mismatched Privy %s evidence", async field => {
  if (field === "app") leaves.appId = "wrong-app";
  else leaves.profileId = "wrong-profile";
  await denied(request("synthetic-privy"), 401);
  expect(fixture.queries).toEqual([]);
});
it("denies absent/malformed keys and a malformed actor through the actual strict guard", async () => {
  fixture.keyPresent = false;
  await denied(request(), 401);
  fixture.keyPresent = true;
  fixture.keyId = "PRIVATE_SENTINEL";
  await denied(request(), 503);
  fixture.keyId = "22222222-2222-4222-8222-222222222222";
  fixture.actor = "PRIVATE_SENTINEL";
  await denied(request(), 503);
});
it("rejects unsupported headers before auth and ignores body principal/token assertions", async () => {
  for (const headers of [
    {},
    { "x-api-key": fixture.key },
    { authorization: "Basic PRIVATE_SENTINEL" },
    { authorization: `Bearer ${fixture.key}`, "x-api-key": "" },
    { authorization: `Bearer ${fixture.key}`, "x-api-key": fixture.key },
  ]) {
    await denied(
      new NextRequest("https://fixture.invalid/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify({ account_id: fixture.actor, token: fixture.key }),
      }),
      401,
    );
  }
  expect(fixture.queries).toEqual([]);
  expect(
    await verify(request(fixture.key, {}, { account_id: "foreign", oauth: {}, token: "foreign" })),
  ).toMatchObject({ actor: fixture.actor, workspace: fixture.actor });
});
it("fresh calls detect changed key rows, subjects and mappings without retaining prior observations", async () => {
  const first = await verify();
  fixture.keyId = "33333333-3333-4333-8333-333333333333";
  const second = await verify();
  expect(second).not.toEqual(first);
  const privy = await verify(request("synthetic-privy"));
  leaves.subject = leaves.profileId = "synthetic-other-subject";
  expect(await verify(request("synthetic-privy"))).not.toEqual(privy);
  fixture.actor = "44444444-4444-4444-8444-444444444444";
  expect(await verify(request("synthetic-privy"))).toMatchObject({ actor: fixture.actor });
  expect(fixture.queries).toEqual([
    "account_api_keys",
    "account_api_keys",
    "account_emails",
    "account_emails",
    "account_emails",
  ]);
});
