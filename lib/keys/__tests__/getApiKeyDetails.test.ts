import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApiKeyDetails } from "../getApiKeyDetails";

import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

// Mock dependencies
vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock("@/lib/const", () => ({
  PRIVY_PROJECT_SECRET: "test_secret",
}));

vi.mock("@/lib/supabase/account_api_keys/selectAccountApiKeys", () => ({
  selectAccountApiKeys: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

describe("getApiKeyDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("valid API keys", () => {
    it("returns accountId and null orgId for personal API key", async () => {
      const personalAccountId = "personal-account-123";

      vi.mocked(selectAccountApiKeys).mockResolvedValue([
        {
          id: "key-1",
          account: personalAccountId,
          name: "My API Key",
          key_hash: "hashed_test_api_key",
          created_at: "2024-01-01T00:00:00Z",
          last_used: null,
        },
      ]);

      // Mock getAccountOrganizations to return empty array (not an org)
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);

      const result = await getApiKeyDetails("test_api_key");

      expect(result).toEqual({
        accountId: personalAccountId,
        orgId: null,
      });
      expect(getAccountOrganizations).toHaveBeenCalledWith({
        organizationId: personalAccountId,
      });
    });

    it("returns accountId and orgId for organization API key", async () => {
      const orgId = "org-123";

      vi.mocked(selectAccountApiKeys).mockResolvedValue([
        {
          id: "key-1",
          account: orgId,
          name: "Org API Key",
          key_hash: "hashed_org_api_key",
          created_at: "2024-01-01T00:00:00Z",
          last_used: null,
        },
      ]);

      // Mock getAccountOrganizations to return members (is an org)
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "member-1",
          organization_id: orgId,
          organization: null,
        },
      ]);

      const result = await getApiKeyDetails("org_api_key");

      expect(result).toEqual({
        accountId: orgId,
        orgId: orgId,
      });
      expect(getAccountOrganizations).toHaveBeenCalledWith({
        organizationId: orgId,
      });
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty API key", async () => {
      const result = await getApiKeyDetails("");

      expect(result).toBeNull();
    });

    it("returns null for undefined API key", async () => {
      const result = await getApiKeyDetails(undefined as unknown as string);

      expect(result).toBeNull();
    });

    it("returns null when API key not found in database", async () => {
      vi.mocked(selectAccountApiKeys).mockResolvedValue([]);

      const result = await getApiKeyDetails("invalid_api_key");

      expect(result).toBeNull();
    });

    it("returns null when selectAccountApiKeys returns null (error)", async () => {
      vi.mocked(selectAccountApiKeys).mockResolvedValue(null);

      const result = await getApiKeyDetails("test_api_key");

      expect(result).toBeNull();
    });

    it("returns null when API key record has null account", async () => {
      vi.mocked(selectAccountApiKeys).mockResolvedValue([
        {
          id: "key-1",
          account: null,
          name: "Broken Key",
          key_hash: "hashed_test_key",
          created_at: "2024-01-01T00:00:00Z",
          last_used: null,
        },
      ]);

      const result = await getApiKeyDetails("test_key");

      expect(result).toBeNull();
    });
  });
});
