import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getVerifiedOAuthIdentity } from "../getVerifiedOAuthIdentity";
const { verify, get } = vi.hoisted(() => ({ verify: vi.fn(), get: vi.fn() }));
vi.mock("../client", () => ({
  default: {
    utils: () => ({ auth: () => ({ verifyAuthToken: verify }) }),
    users: () => ({ _get: get }),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PRIVY_APP_ID", "trusted-app");
  verify.mockResolvedValue({ user_id: "did:privy:subject" });
});
afterEach(() => vi.unstubAllEnvs());
it("uses the verified subject and only verified direct email links", async () => {
  get.mockResolvedValue({
    id: "did:privy:subject",
    linked_accounts: [
      { type: "email", address: " Alice@Example.Test ", latest_verified_at: 1700000000 },
      {
        type: "email",
        address: "unverified@example.test",
        latest_verified_at: null,
        verified_at: 1700000000,
      },
      { type: "google_oauth", email: "profile@example.test", latest_verified_at: 1700000000 },
    ],
  });
  expect(await getVerifiedOAuthIdentity("token")).toEqual({
    appId: "trusted-app",
    subject: "did:privy:subject",
    verifiedEmails: ["alice@example.test"],
  });
  expect(verify).toHaveBeenCalledWith("token");
  expect(get).toHaveBeenCalledWith(
    "did:privy:subject",
    expect.objectContaining({ timeout: 10000 }),
  );
});
it("rejects a mismatched subject and never exposes backend details", async () => {
  get.mockResolvedValue({ id: "did:privy:other", linked_accounts: [] });
  await expect(getVerifiedOAuthIdentity("token")).rejects.toHaveProperty(
    "message",
    "Unable to verify OAuth identity",
  );
  verify.mockRejectedValue(new Error("token-secret"));
  get.mockClear();
  await expect(getVerifiedOAuthIdentity("token-secret")).rejects.toHaveProperty(
    "message",
    "Unable to verify OAuth identity",
  );
  expect(get).not.toHaveBeenCalled();
});
it("allows an established mapping to resolve without any current verified email", async () => {
  get.mockResolvedValue({ id: "did:privy:subject", linked_accounts: [] });
  expect((await getVerifiedOAuthIdentity("token")).verifiedEmails).toEqual([]);
});
