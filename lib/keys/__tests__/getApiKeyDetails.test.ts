import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApiKeyDetails } from "../getApiKeyDetails";

import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

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

describe("getApiKeyDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("valid API keys", () => {
    it("returns accountId for a valid API key", async () => {
      const accountId = "personal-account-123";

      vi.mocked(selectAccountApiKeys).mockResolvedValue([
        {
          id: "key-1",
          account: accountId,
          name: "My API Key",
          key_hash: "hashed_test_api_key",
          created_at: "2024-01-01T00:00:00Z",
          last_used: null,
        },
      ]);

      const result = await getApiKeyDetails("test_api_key");

      expect(result).toEqual({
        accountId,
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
