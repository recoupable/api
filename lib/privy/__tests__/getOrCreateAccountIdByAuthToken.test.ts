import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import privyClient from "@/lib/privy/client";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";

const verifyAuthToken = vi.fn();

vi.mock("@/lib/privy/client", () => ({
  default: {
    utils: () => ({
      auth: () => ({
        verifyAuthToken: (...args: unknown[]) => verifyAuthToken(...args),
      }),
    }),
  },
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/agents/createAccountWithEmail", () => ({
  createAccountWithEmail: vi.fn(),
}));

function mockPrivyProfile({
  email = "user@example.com",
  userId = "did:privy:abc",
  status = 200,
}: { email?: string; userId?: string; status?: number } = {}) {
  verifyAuthToken.mockResolvedValue({ user_id: userId });
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: userId,
        linked_accounts: email ? [{ type: "email", address: email }] : [],
      }),
      { status, headers: { "Content-Type": "application/json" } },
    ),
  ) as unknown as typeof fetch;
}

describe("getOrCreateAccountIdByAuthToken", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVY_APP_ID = "test-app-id";
    process.env.PRIVY_PROJECT_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Touch the import so coverage tooling doesn't report it as unused — we
  // mock its instance via the chained accessor mock above.
  it("uses the mocked privy client", () => {
    expect(typeof privyClient).toBe("object");
  });

  it("returns existing accountId when account_emails has a row", async () => {
    mockPrivyProfile({ email: "existing@example.com" });
    vi.mocked(selectAccountEmails).mockResolvedValue([
      { account_id: "acc-existing", email: "existing@example.com" } as never,
    ]);

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(accountId).toBe("acc-existing");
    expect(createAccountWithEmail).not.toHaveBeenCalled();
  });

  it("creates an account and returns the new accountId when email is unknown", async () => {
    mockPrivyProfile({ email: "new@example.com" });
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc-new");

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(createAccountWithEmail).toHaveBeenCalledWith("new@example.com");
    expect(accountId).toBe("acc-new");
  });

  it("creates an account when account_emails returns null", async () => {
    mockPrivyProfile({ email: "new@example.com" });
    vi.mocked(selectAccountEmails).mockResolvedValue(null as never);
    vi.mocked(createAccountWithEmail).mockResolvedValue("acc-new");

    const accountId = await getOrCreateAccountIdByAuthToken("token");

    expect(createAccountWithEmail).toHaveBeenCalledWith("new@example.com");
    expect(accountId).toBe("acc-new");
  });

  it("throws when token verification fails", async () => {
    verifyAuthToken.mockResolvedValueOnce(undefined);

    await expect(getOrCreateAccountIdByAuthToken("bad-token")).rejects.toThrow(
      "Invalid authentication token",
    );
  });

  it("throws when Privy has no email linked", async () => {
    mockPrivyProfile({ email: "" });

    await expect(getOrCreateAccountIdByAuthToken("token")).rejects.toThrow(
      "No email found in user account",
    );
  });

  it("throws when the Privy /v1/users fetch is not ok", async () => {
    verifyAuthToken.mockResolvedValueOnce({ user_id: "did:privy:abc" });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 502 })) as unknown as typeof fetch;

    await expect(getOrCreateAccountIdByAuthToken("token")).rejects.toThrow(
      "Failed to fetch user data from Privy",
    );
  });
});
