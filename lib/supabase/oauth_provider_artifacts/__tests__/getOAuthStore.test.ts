import { expect, it, vi } from "vitest";
import { getOAuthStore } from "../getOAuthStore";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
it("uses the existing server client through the database access boundary", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect(
    await getOAuthStore().consume({
      namespace: "issuer",
      model: "AuthorizationCode",
      idHash: "a".repeat(64),
    }),
  ).toBe(false);
  expect(rpc).toHaveBeenCalledWith("oauth_store_consume", {
    p_namespace: "issuer",
    p_model: "AuthorizationCode",
    p_id_hash: "a".repeat(64),
  });
});
