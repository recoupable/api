import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomInt } from "crypto";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { createPrivyUser } from "@/lib/privy/createPrivyUser";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";
import { sendVerificationEmail } from "@/lib/agents/sendVerificationEmail";

vi.mock("@/lib/privy/getPrivyUserByEmail", () => ({
  getPrivyUserByEmail: vi.fn(),
}));

vi.mock("@/lib/privy/createPrivyUser", () => ({
  createPrivyUser: vi.fn(() => ({ id: "privy_new" })),
}));

vi.mock("@/lib/privy/setPrivyCustomMetadata", () => ({
  setPrivyCustomMetadata: vi.fn(),
}));

vi.mock("@/lib/agents/sendVerificationEmail", () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((input: string) => `hashed_${input}`),
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomInt: vi.fn(() => 123456),
  };
});

describe("storeVerificationCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_SECRET = "test-secret";
  });

  it("generates a 6-digit code, stores its hash in Privy metadata, and emails it", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue({ id: "privy_existing" });

    await storeVerificationCode("user@example.com");

    expect(randomInt).toHaveBeenCalledWith(100000, 1000000);
    expect(setPrivyCustomMetadata).toHaveBeenCalledWith(
      "privy_existing",
      expect.objectContaining({
        verification_code_hash: "hashed_123456",
        verification_attempts: 0,
      }),
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith("user@example.com", "123456");
  });

  it("creates a Privy user if none exists, then stores the code", async () => {
    vi.mocked(getPrivyUserByEmail).mockResolvedValue(null);

    await storeVerificationCode("new@example.com");

    expect(createPrivyUser).toHaveBeenCalledWith("new@example.com");
    expect(setPrivyCustomMetadata).toHaveBeenCalledWith("privy_new", expect.any(Object));
  });
});
