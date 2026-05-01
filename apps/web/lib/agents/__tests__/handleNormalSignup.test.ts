import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleNormalSignup } from "@/lib/agents/handleNormalSignup";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agents/createAccountWithEmail", () => ({
  createAccountWithEmail: vi.fn(),
}));

vi.mock("@/lib/agents/storeVerificationCode", () => ({
  storeVerificationCode: vi.fn(),
}));

describe("handleNormalSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new account, sends a verification code, and returns null api_key", async () => {
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc_new");

    const result = await handleNormalSignup("user@example.com");
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.account_id).toBe("acc_new");
    expect(body.api_key).toBeNull();
    expect(createAccountWithEmail).toHaveBeenCalledWith("user@example.com");
    expect(storeVerificationCode).toHaveBeenCalledWith("user@example.com");
  });
});
