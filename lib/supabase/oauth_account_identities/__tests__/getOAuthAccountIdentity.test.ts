import { expect, it, vi } from "vitest";
import { getOAuthAccountIdentity } from "../getOAuthAccountIdentity";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
it("calls only the immutable existing-account resolver", async () => {
  rpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000001", error: null });
  const identity = {
    appId: "app",
    subject: "did:privy:subject",
    verifiedEmails: ["alice@example.test"],
  };
  expect(await getOAuthAccountIdentity(identity)).toBe("00000000-0000-4000-8000-000000000001");
  expect(rpc).toHaveBeenCalledWith("resolve_oauth_account", {
    p_app_id: "app",
    p_subject: "did:privy:subject",
    p_verified_emails: ["alice@example.test"],
  });
});
it("rejects failed and malformed responses without leaking details", async () => {
  for (const response of [
    { data: null, error: { message: "private-account-details" } },
    { data: "not-an-id", error: null },
  ]) {
    rpc.mockResolvedValue(response);
    await expect(
      getOAuthAccountIdentity({ appId: "app", subject: "subject", verifiedEmails: [] }),
    ).rejects.toHaveProperty("message", "OAuth requires an available existing account");
  }
});
