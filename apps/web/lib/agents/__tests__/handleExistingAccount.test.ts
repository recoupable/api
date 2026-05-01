import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleExistingAccount } from "@/lib/agents/handleExistingAccount";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agents/storeVerificationCode", () => ({
  storeVerificationCode: vi.fn(),
}));

describe("handleExistingAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a verification code and returns null api_key with the existing account_id", async () => {
    const result = await handleExistingAccount("acc_existing", "user@example.com");
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.account_id).toBe("acc_existing");
    expect(body.api_key).toBeNull();
    expect(storeVerificationCode).toHaveBeenCalledWith("user@example.com");
  });
});
