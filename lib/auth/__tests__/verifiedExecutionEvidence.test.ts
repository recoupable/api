import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { assessExecutionRecovery } from "../assessExecutionRecovery";
import { buildRunAgentInput } from "@/lib/chat/buildRunAgentInput";
import { validateAuthContext } from "../validateAuthContext";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  keys: vi.fn(),
  emails: vi.fn(),
  memberships: vi.fn(),
  shared: vi.fn(),
  onboard: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/const", () => ({
  PRIVY_PROJECT_SECRET: "synthetic-secret",
  RECOUP_ORG_ID: "admin-org",
}));
vi.mock("@/lib/privy/client", () => ({
  default: { utils: () => ({ auth: () => ({ verifyAuthToken: mocks.verify }) }) },
}));
vi.mock("@/lib/supabase/account_api_keys/selectAccountApiKeys", () => ({
  selectAccountApiKeys: mocks.keys,
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: mocks.emails }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: mocks.memberships,
}));
vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: mocks.shared,
}));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: mocks.onboard,
}));

async function evidence(headers = { authorization: "Bearer synthetic-token" }, input = {}) {
  const result = await validateAuthContext(
    new NextRequest("https://synthetic.invalid", { headers }),
    {
      includeVerificationEvidence: true,
      ...input,
    },
  );
  if (result instanceof NextResponse) throw new Error(`Auth rejected ${result.status}`);
  return result.verificationEvidence!;
}

describe("opt-in verified execution evidence through the actual shared auth path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PRIVY_APP_ID", "synthetic-app");
    mocks.verify.mockResolvedValue({
      user_id: "did:privy:original",
      app_id: "synthetic-app",
      issuer: "privy.io",
    });
    mocks.fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "did:privy:original",
            linked_accounts: [{ type: "email", address: "synthetic@example.invalid" }],
          }),
        ),
    );
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.emails.mockResolvedValue([{ account_id: "actor" }]);
    mocks.keys.mockResolvedValue([{ id: "key-row", account: "actor", expires_at: null }]);
    mocks.memberships.mockResolvedValue([{ organization_id: "org-a" }]);
    mocks.shared.mockResolvedValue([{ organization_id: "org-a" }]);
    mocks.onboard.mockRejectedValue(new Error("onboarding forbidden in evidence mode"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("preserves verified principal before override without a second verification or onboarding", async () => {
    const result = await evidence(undefined, { accountId: "effective", organizationId: "org-a" });
    expect(result.principal).toEqual({
      mechanism: "privy",
      actorAccountId: "actor",
      appId: "synthetic-app",
      issuer: "privy.io",
      subject: "did:privy:original",
    });
    expect(result.effectiveAccountId).toBe("effective");
    expect(result.accountAccess).toEqual({ basis: "shared_membership", organizationId: "org-a" });
    expect(result.organizationAccess).toEqual({ basis: "membership", organizationId: "org-a" });
    expect(result.executionResources).toEqual({
      status: "unresolved",
      reason: "resource_authorization_contract_missing",
    });
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.onboard).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("synthetic-token");
  });
  it("same Privy actor refreshed bytes produce identical non-secret evidence", async () => {
    const original = await evidence();
    expect(await evidence({ authorization: "Bearer refreshed-bytes" })).toEqual(original);
  });
  it("a changed verified subject or account mapping is not the same principal", async () => {
    const original = await evidence();
    mocks.verify.mockResolvedValue({
      user_id: "did:privy:other",
      app_id: "synthetic-app",
      issuer: "privy.io",
    });
    mocks.fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "did:privy:other",
            linked_accounts: [{ type: "email", address: "synthetic@example.invalid" }],
          }),
        ),
    );
    expect((await evidence()).principal).not.toEqual(original.principal);
    mocks.emails.mockResolvedValue([{ account_id: "remapped" }]);
    expect((await evidence()).principal.actorAccountId).toBe("remapped");
  });
  it("x-api-key and Bearer Recoup key preserve the same verified row identity", async () => {
    const a = await evidence({ "x-api-key": "recoup_sk_synthetic" } as never);
    const b = await evidence({ authorization: "Bearer recoup_sk_synthetic" });
    expect(a).toEqual(b);
    expect(a.principal).toEqual({
      mechanism: "recoup_api_key",
      actorAccountId: "actor",
      keyId: "key-row",
    });
    expect(mocks.verify).not.toHaveBeenCalled();
    mocks.keys.mockResolvedValue([{ id: "replacement-row", account: "actor", expires_at: null }]);
    expect((await evidence({ authorization: "Bearer recoup_sk_other" })).principal).not.toEqual(
      a.principal,
    );
  });
  it("denies removed access and records a changed admin basis without inventing a grant version", async () => {
    const previous = await evidence(undefined, { accountId: "effective" });
    mocks.memberships.mockResolvedValue([]);
    await expect(evidence(undefined, { accountId: "effective" })).rejects.toThrow("403");
    mocks.memberships.mockResolvedValue([{ organization_id: "admin-org" }]);
    const expanded = await evidence(undefined, { accountId: "effective" });
    expect(expanded.accountAccess).toEqual({
      basis: "admin_membership",
      organizationId: "admin-org",
    });
    expect(expanded.accountAccess).not.toEqual(previous.accountAccess);
    expect(expanded.executionResources.status).toBe("unresolved");
    expect(expanded).not.toHaveProperty("grantVersion");
  });
  it("rejects missing identity metadata and mismatched Privy profile subject", async () => {
    mocks.verify.mockResolvedValue({ user_id: "did:privy:original" });
    await expect(evidence()).rejects.toThrow("401");
    mocks.verify.mockResolvedValue({
      user_id: "did:privy:original",
      app_id: "synthetic-app",
      issuer: "privy.io",
    });
    mocks.fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            id: "different",
            linked_accounts: [{ type: "email", address: "synthetic@example.invalid" }],
          }),
        ),
    );
    await expect(evidence()).rejects.toThrow("401");
  });
  it("blocks execution when sandbox routing and authenticated organization disagree", async () => {
    const authOrg = "11111111-1111-4111-8111-111111111111";
    const routeOrg = "22222222-2222-4222-8222-222222222222";
    const current = await evidence(undefined, { organizationId: authOrg });
    const cloneUrl = `https://github.com/recoupable/org-synthetic-${routeOrg}`;
    const built = buildRunAgentInput({
      messages: [],
      chatId: "chat",
      sessionId: "session",
      accountId: "actor",
      modelId: "model",
      cloneUrl,
      sandboxState: {} as never,
      workingDirectory: "/workspace",
      skills: [],
    });
    expect(built.agentContext.recoupOrgId).toBe(routeOrg);
    expect(assessExecutionRecovery(current, current, cloneUrl)).toEqual({
      allowed: false,
      reason: "routing_organization_unverified",
    });
    const matching = `https://github.com/recoupable/org-synthetic-${authOrg}`;
    expect(assessExecutionRecovery(current, current, matching)).toEqual({
      allowed: false,
      reason: "resource_authorization_contract_missing",
    });
  });
  it("blocks changed principals and observed authorization changes, and never treats equality as a grant", async () => {
    const original = await evidence(undefined, { accountId: "effective" });
    mocks.emails.mockResolvedValue([{ account_id: "different-actor" }]);
    expect(
      assessExecutionRecovery(original, await evidence(undefined, { accountId: "effective" }), null)
        .reason,
    ).toBe("principal_changed");
    mocks.emails.mockResolvedValue([{ account_id: "actor" }]);
    mocks.memberships.mockResolvedValue([{ organization_id: "admin-org" }]);
    const expanded = await evidence(undefined, { accountId: "effective" });
    expect(assessExecutionRecovery(original, expanded, null).reason).toBe(
      "authorization_observation_changed",
    );
    expect(assessExecutionRecovery(expanded, expanded, null)).toEqual({
      allowed: false,
      reason: "resource_authorization_contract_missing",
    });
  });
  it("rejects transport expansion, expired keys and ignores body token as authentication", async () => {
    const bodyOnly = new NextRequest("https://synthetic.invalid", {
      method: "POST",
      body: JSON.stringify({ recoupAccessToken: "synthetic-body" }),
    });
    expect(
      ((await validateAuthContext(bodyOnly, { includeVerificationEvidence: true })) as NextResponse)
        .status,
    ).toBe(401);
    const conflicting = new NextRequest("https://synthetic.invalid", {
      headers: { "x-api-key": "recoup_sk_synthetic", authorization: "Bearer synthetic" },
    });
    expect(
      (
        (await validateAuthContext(conflicting, {
          includeVerificationEvidence: true,
        })) as NextResponse
      ).status,
    ).toBe(401);
    mocks.keys.mockResolvedValue([
      { id: "expired", account: "actor", expires_at: "2000-01-01T00:00:00Z" },
    ]);
    await expect(evidence({ authorization: "Bearer recoup_sk_expired" })).rejects.toThrow("401");
  });
  it("does not mistake unchanged allowing branch for a complete unchanged resource scope", async () => {
    const original = await evidence(undefined, { accountId: "effective" });
    mocks.memberships.mockResolvedValue([
      { organization_id: "org-a" },
      { organization_id: "new-resource-org" },
    ]);
    const expanded = await evidence(undefined, { accountId: "effective" });
    expect(expanded.accountAccess).toEqual(original.accountAccess);
    expect(assessExecutionRecovery(original, expanded, null)).toEqual({
      allowed: false,
      reason: "resource_authorization_contract_missing",
    });
    mocks.memberships.mockResolvedValue([]);
    await expect(evidence(undefined, { organizationId: "org-a" })).rejects.toThrow("403");
  });
  it("never onboards even when caller requests creation in evidence mode", async () => {
    mocks.emails.mockResolvedValue([]);
    await expect(evidence(undefined, { allowAccountCreation: true })).rejects.toThrow("401");
    expect(mocks.onboard).not.toHaveBeenCalled();
  });
});
