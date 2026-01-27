import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyBearerToken } from "../verifyApiKey";

vi.mock("@/lib/privy/getAccountIdByAuthToken", () => ({
  getAccountIdByAuthToken: vi.fn(),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

import { getAccountIdByAuthToken } from "@/lib/privy/getAccountIdByAuthToken";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";

describe("verifyBearerToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when no token provided", async () => {
    const result = await verifyBearerToken(new Request("http://localhost"), undefined);
    expect(result).toBeUndefined();
  });

  it("returns auth info with orgId: null for Privy JWT", async () => {
    vi.mocked(getAccountIdByAuthToken).mockResolvedValue("privy-account-123");

    const result = await verifyBearerToken(new Request("http://localhost"), "privy-jwt-token");

    expect(result).toEqual({
      token: "privy-jwt-token",
      scopes: ["mcp:tools"],
      clientId: "privy-account-123",
      extra: {
        accountId: "privy-account-123",
        orgId: null,
      },
    });
  });

  it("returns auth info with orgId for org API key", async () => {
    vi.mocked(getAccountIdByAuthToken).mockRejectedValue(new Error("Invalid JWT"));
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: "org-account-123",
      orgId: "org-account-123",
    });

    const result = await verifyBearerToken(new Request("http://localhost"), "org-api-key");

    expect(result).toEqual({
      token: "org-api-key",
      scopes: ["mcp:tools"],
      clientId: "org-account-123",
      extra: {
        accountId: "org-account-123",
        orgId: "org-account-123",
      },
    });
  });

  it("returns auth info with orgId: null for personal API key", async () => {
    vi.mocked(getAccountIdByAuthToken).mockRejectedValue(new Error("Invalid JWT"));
    vi.mocked(getApiKeyDetails).mockResolvedValue({
      accountId: "personal-account-123",
      orgId: null,
    });

    const result = await verifyBearerToken(new Request("http://localhost"), "personal-api-key");

    expect(result).toEqual({
      token: "personal-api-key",
      scopes: ["mcp:tools"],
      clientId: "personal-account-123",
      extra: {
        accountId: "personal-account-123",
        orgId: null,
      },
    });
  });

  it("returns undefined for invalid API key", async () => {
    vi.mocked(getAccountIdByAuthToken).mockRejectedValue(new Error("Invalid JWT"));
    vi.mocked(getApiKeyDetails).mockResolvedValue(null);

    const result = await verifyBearerToken(new Request("http://localhost"), "invalid-key");

    expect(result).toBeUndefined();
  });
});
