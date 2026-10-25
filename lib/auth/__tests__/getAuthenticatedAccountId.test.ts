import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { getExistingAccountIdByAuthToken } from "@/lib/privy/getExistingAccountIdByAuthToken";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: vi.fn() }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("@/lib/privy/getExistingAccountIdByAuthToken", () => ({
  getExistingAccountIdByAuthToken: vi.fn(),
}));

function req(bearer?: string) {
  const headers = new Headers();
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new NextRequest("https://x.test/api", { headers });
}

describe("getAuthenticatedAccountId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when no bearer token", async () => {
    const res = await getAuthenticatedAccountId(req());
    expect((res as Response).status).toBe(401);
  });

  it("validates a recoup_sk_ Bearer token as an API key (no Privy call)", async () => {
    vi.mocked(getAccountIdByApiKey).mockResolvedValue("acc-key");

    const res = await getAuthenticatedAccountId(req("recoup_sk_abc"));

    expect(res).toBe("acc-key");
    expect(getAccountIdByApiKey).toHaveBeenCalledWith("recoup_sk_abc");
    expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  });

  it("401 when a recoup_sk_ Bearer key is unknown/expired", async () => {
    vi.mocked(getAccountIdByApiKey).mockResolvedValue(null);

    const res = await getAuthenticatedAccountId(req("recoup_sk_bad"));

    expect((res as Response).status).toBe(401);
    expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  });

  it("treats a non-recoup_sk_ token as a Privy JWT (no API-key call)", async () => {
    vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("acc-privy");

    const res = await getAuthenticatedAccountId(req("eyJhbGci.jwt.value"));

    expect(res).toBe("acc-privy");
    expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledWith("eyJhbGci.jwt.value");
    expect(getAccountIdByApiKey).not.toHaveBeenCalled();
  });

  it("does not provision an account when account creation is disabled", async () => {
    vi.mocked(getExistingAccountIdByAuthToken).mockResolvedValue(null);
    vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("would-create-account");
    const res = await getAuthenticatedAccountId(req("synthetic-privy-token"), {
      allowAccountCreation: false,
    });
    expect((res as Response).status).toBe(401);
    expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  });

  it("resolves an existing Privy account when creation is disabled", async () => {
    vi.mocked(getExistingAccountIdByAuthToken).mockResolvedValue("existing-account");
    expect(
      await getAuthenticatedAccountId(req("synthetic-privy-token"), {
        allowAccountCreation: false,
      }),
    ).toBe("existing-account");
    expect(getExistingAccountIdByAuthToken).toHaveBeenCalledWith("synthetic-privy-token");
    expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  });

  it("keeps explicit creation enabled and the default behavior equivalent", async () => {
    vi.mocked(getOrCreateAccountIdByAuthToken).mockResolvedValue("onboarded-account");
    expect(
      await getAuthenticatedAccountId(req("synthetic-privy-token"), { allowAccountCreation: true }),
    ).toBe("onboarded-account");
    expect(getOrCreateAccountIdByAuthToken).toHaveBeenCalledOnce();
    expect(getExistingAccountIdByAuthToken).not.toHaveBeenCalled();
  });
});
