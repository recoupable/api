import { expect, it, vi } from "vitest";
import { createOAuthStore } from "../createOAuthStore";
it("maps storage writes to the scoped migration contract", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const store = createOAuthStore(rpc);
  await store.upsert({
    namespace: "issuer",
    model: "Client",
    idHash: "hash",
    payload: "ciphertext",
    expiresIn: null,
    grantHash: null,
    uidHash: null,
    userCodeHash: null,
  });
  expect(rpc).toHaveBeenCalledWith("oauth_store_upsert", {
    p_namespace: "issuer",
    p_model: "Client",
    p_id_hash: "hash",
    p_payload: "ciphertext",
    p_expires_in: null,
    p_grant_hash: null,
    p_uid_hash: null,
    p_user_code_hash: null,
  });
  await store.destroy({ namespace: "issuer", model: "Grant", idHash: "grant" });
  expect(rpc).toHaveBeenLastCalledWith("oauth_store_destroy", {
    p_namespace: "issuer",
    p_model: "Grant",
    p_id_hash: "grant",
  });
  await store.revokeGrant("issuer", "grant");
  expect(rpc).toHaveBeenLastCalledWith("oauth_store_revoke_grant", {
    p_namespace: "issuer",
    p_grant_hash: "grant",
  });
});
it("preserves false consumption and rejects ambiguous backend responses", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
  const store = createOAuthStore(rpc);
  const key = { namespace: "issuer", model: "AuthorizationCode", idHash: "hash" };
  expect(await store.consume(key)).toBe(false);
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(store.consume(key)).rejects.toThrow("Invalid OAuth storage response");
  rpc.mockResolvedValue({ data: true, error: { message: "sensitive" } });
  await expect(store.consume(key)).rejects.toThrow("OAuth storage unavailable");
});
it("validates stored rows and treats only null as absent", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const store = createOAuthStore(rpc);
  const query = { namespace: "issuer", model: "Session", index: "uid" as const, hash: "hash" };
  expect(await store.find(query)).toBeNull();
  rpc.mockResolvedValue({ data: { payload: "ciphertext" }, error: null });
  await expect(store.find(query)).rejects.toThrow("Invalid OAuth storage response");
  rpc.mockResolvedValue({
    data: { id_hash: "a".repeat(64), payload: "ciphertext", consumed: 123 },
    error: null,
  });
  expect(await store.find(query)).toHaveProperty("consumed", 123);
});
