import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, OPTIONS, dynamic, fetchCache, revalidate } from "../route";
import { RECOUP_ORG_ID } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { getEmailByAuthToken } from "@/lib/privy/getEmailByAuthToken";

const forbidden = vi.hoisted(() => ({
  createAccount: vi.fn(),
  welcome: vi.fn(),
  resetCredits: vi.fn(),
  initializeCredits: vi.fn(),
  insertCredits: vi.fn(),
  updateCredits: vi.fn(),
  refillCredits: vi.fn(),
  autoTopUp: vi.fn(),
}));
vi.mock("@/lib/agents/createAccountWithEmail", () => ({
  createAccountWithEmail: forbidden.createAccount,
}));
vi.mock("@/lib/emails/sendWelcomeEmail", () => ({ sendWelcomeEmail: forbidden.welcome }));
vi.mock("@/lib/credits/checkAndResetCredits", () => ({
  checkAndResetCredits: forbidden.resetCredits,
}));
vi.mock("@/lib/credits/initializeAccountCredits", () => ({
  initializeAccountCredits: forbidden.initializeCredits,
}));
vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({
  insertCreditsUsage: forbidden.insertCredits,
}));
vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: forbidden.updateCredits,
}));
vi.mock("@/lib/supabase/credits_usage/refillCreditsToFloor", () => ({
  refillCreditsToFloor: forbidden.refillCredits,
}));
vi.mock("@/lib/credits/maybeAutoTopUp", () => ({ maybeAutoTopUp: forbidden.autoTopUp }));
vi.mock("@/lib/supabase/account_api_keys/selectAccountApiKeys", () => ({
  selectAccountApiKeys: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));
vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));
vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: vi.fn() }));
vi.mock("@/lib/privy/getEmailByAuthToken", () => ({ getEmailByAuthToken: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const SELF = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";
const rawRow = Object.freeze({
  id: 7,
  account_id: SELF,
  remaining_credits: 123456,
  timestamp: "2020-01-01T00:00:00Z",
  auto_topup_enabled: true,
  auto_topup_amount: 100,
  auto_topup_threshold: 20,
  auto_topup_last_error: null,
  auto_topup_last_run_at: null,
});
function request(
  query = `accountId=${SELF}`,
  headers: Record<string, string> = { "x-api-key": "recoup_sk_synthetic" },
) {
  return new NextRequest(`https://synthetic.invalid/api/credits/get?${query}`, { headers });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectAccountApiKeys).mockResolvedValue([{ account: SELF, expires_at: null }] as never);
  vi.mocked(getEmailByAuthToken).mockResolvedValue("synthetic@example.invalid");
  vi.mocked(selectAccountEmails).mockResolvedValue([
    { account_id: SELF, email: "synthetic@example.invalid" },
  ] as never);
  vi.mocked(getAccountOrganizations).mockResolvedValue([]);
  vi.mocked(selectAccountOrganizationIds).mockResolvedValue([]);
  vi.mocked(selectCreditsUsage).mockResolvedValue([rawRow]);
});
afterEach(() => {
  for (const mutation of Object.values(forbidden)) expect(mutation).not.toHaveBeenCalled();
});

describe("GET /api/credits/get read-only compatibility", () => {
  it.each([
    { "x-api-key": "recoup_sk_synthetic" },
    { authorization: "Bearer recoup_sk_synthetic" },
    { authorization: "Bearer synthetic-privy-token" },
  ])("returns the unchanged stored row with auth %j", async headers => {
    const response = await GET(request(`accountId=${SELF}`, headers));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: rawRow });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(selectCreditsUsage).toHaveBeenCalledExactlyOnceWith({ account_id: SELF });
    expect(getAccountOrganizations).not.toHaveBeenCalled();
  });

  it("returns data:null without seeding when the account has no credits row", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
  });

  it.each(["shared member", "organization", "admin"])(
    "retains existing %s target access",
    async access => {
      const organization = access === "admin" ? RECOUP_ORG_ID : ORG;
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        { organization_id: organization },
      ] as never);
      vi.mocked(selectAccountOrganizationIds).mockResolvedValue([
        { account_id: TARGET, organization_id: ORG },
      ] as never);
      const target = access === "organization" ? ORG : TARGET;
      const response = await GET(request(`accountId=${target}`));
      expect(response.status).toBe(200);
      expect(selectCreditsUsage).toHaveBeenCalledExactlyOnceWith({ account_id: target });
      expect(getAccountOrganizations).toHaveBeenCalledExactlyOnceWith({ accountId: SELF });
      if (access === "shared member") {
        expect(selectAccountOrganizationIds).toHaveBeenCalledWith(TARGET, [ORG]);
      }
    },
  );

  it("denies unrelated targets before reading their credits", async () => {
    const response = await GET(request(`accountId=${TARGET}`));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      status: "error",
      error: "Access denied to specified account_id",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(selectCreditsUsage).not.toHaveBeenCalled();
  });

  it.each([{}, { "x-api-key": "synthetic", authorization: "Bearer synthetic" }])(
    "requires exactly one auth mechanism %j",
    async headers => {
      const response = await GET(request(`accountId=${SELF}`, headers));
      expect(response.status).toBe(401);
      expect(selectAccountApiKeys).not.toHaveBeenCalled();
      expect(getEmailByAuthToken).not.toHaveBeenCalled();
      expect(selectCreditsUsage).not.toHaveBeenCalled();
    },
  );

  it.each([{ keys: [] }, { keys: [{ account: SELF, expires_at: "2000-01-01T00:00:00Z" }] }])(
    "rejects unknown/expired API keys $keys",
    async ({ keys }) => {
      vi.mocked(selectAccountApiKeys).mockResolvedValue(keys as never);
      const response = await GET(request());
      expect(response.status).toBe(401);
      expect(selectCreditsUsage).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown Privy account without onboarding or sending email", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
    const response = await GET(
      request(`accountId=${SELF}`, { authorization: "Bearer synthetic-privy-token" }),
    );
    expect(response.status).toBe(401);
    expect(getEmailByAuthToken).toHaveBeenCalledWith("synthetic-privy-token");
    expect(selectAccountEmails).toHaveBeenCalledWith({ emails: ["synthetic@example.invalid"] });
    expect(selectCreditsUsage).not.toHaveBeenCalled();
  });

  it("rejects failed identity verification without a credits read", async () => {
    vi.mocked(getEmailByAuthToken).mockRejectedValue(new Error("synthetic private identity error"));
    const response = await GET(
      request(`accountId=${SELF}`, { authorization: "Bearer synthetic-privy-token" }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("synthetic private identity error");
    expect(selectCreditsUsage).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "accountId=",
    "accountId=bad",
    `accountId=${SELF}&accountId=${TARGET}`,
    `account_id=${SELF}`,
  ])("rejects invalid query %s before auth or credits lookup", async query => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      status: "error",
      error: "accountId must be a single valid UUID",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(selectAccountApiKeys).not.toHaveBeenCalled();
    expect(selectCreditsUsage).not.toHaveBeenCalled();
  });

  it("returns a sanitized typed read error without pretending the row is absent", async () => {
    vi.mocked(selectCreditsUsage).mockRejectedValue(
      new Error("synthetic database connection detail"),
    );
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Failed to load credits usage",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps preflight and route configuration uncached and read-free", () => {
    const response = OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(selectCreditsUsage).not.toHaveBeenCalled();
    expect(dynamic).toBe("force-dynamic");
    expect(fetchCache).toBe("force-no-store");
    expect(revalidate).toBe(0);
  });
});
