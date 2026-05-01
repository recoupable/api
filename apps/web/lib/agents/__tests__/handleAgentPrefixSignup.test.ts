import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAgentPrefixSignup } from "@/lib/agents/handleAgentPrefixSignup";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { generateAndStoreApiKey } from "@/lib/agents/generateAndStoreApiKey";
import { createPrivyUser } from "@/lib/privy/createPrivyUser";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agents/createAccountWithEmail", () => ({
  createAccountWithEmail: vi.fn(),
}));

vi.mock("@/lib/agents/generateAndStoreApiKey", () => ({
  generateAndStoreApiKey: vi.fn(),
}));

vi.mock("@/lib/privy/createPrivyUser", () => ({
  createPrivyUser: vi.fn(() => ({ id: "privy_abc" })),
}));

vi.mock("@/lib/privy/setPrivyCustomMetadata", () => ({
  setPrivyCustomMetadata: vi.fn(),
}));

describe("handleAgentPrefixSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates account, creates Privy user with empty metadata, and returns api_key", async () => {
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc_new");
    vi.mocked(generateAndStoreApiKey).mockResolvedValue("recoup_sk_new");

    const result = await handleAgentPrefixSignup("agent+bot@example.com");
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.account_id).toBe("acc_new");
    expect(body.api_key).toBe("recoup_sk_new");
    expect(createAccountWithEmail).toHaveBeenCalledWith("agent+bot@example.com");
    expect(createPrivyUser).toHaveBeenCalledWith("agent+bot@example.com");
    expect(setPrivyCustomMetadata).toHaveBeenCalledWith("privy_abc", {});
    expect(generateAndStoreApiKey).toHaveBeenCalledWith("acc_new");
  });
});
