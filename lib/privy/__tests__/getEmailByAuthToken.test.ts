import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEmailByAuthToken } from "@/lib/privy/getEmailByAuthToken";

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

function mockUserFetch({
  email,
  userId = "did:privy:abc",
  status = 200,
}: {
  email: string | null;
  userId?: string;
  status?: number;
}) {
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

describe("getEmailByAuthToken", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVY_APP_ID = "test-app-id";
    process.env.PRIVY_PROJECT_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the user's email when token verifies and Privy returns a linked email", async () => {
    verifyAuthToken.mockResolvedValue({ user_id: "did:privy:abc" });
    mockUserFetch({ email: "user@example.com" });

    const email = await getEmailByAuthToken("token");

    expect(email).toBe("user@example.com");
  });

  it("throws when token verification fails", async () => {
    verifyAuthToken.mockResolvedValueOnce(undefined);

    await expect(getEmailByAuthToken("bad-token")).rejects.toThrow("Invalid authentication token");
  });

  it("throws when the Privy /v1/users fetch is not ok", async () => {
    verifyAuthToken.mockResolvedValue({ user_id: "did:privy:abc" });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 502 })) as unknown as typeof fetch;

    await expect(getEmailByAuthToken("token")).rejects.toThrow(
      "Failed to fetch user data from Privy",
    );
  });

  it("throws when no email is linked on Privy", async () => {
    verifyAuthToken.mockResolvedValue({ user_id: "did:privy:abc" });
    mockUserFetch({ email: null });

    await expect(getEmailByAuthToken("token")).rejects.toThrow("No email found in user account");
  });
});
