import { beforeEach, expect, it, vi } from "vitest";
import { createOAuthAdapter } from "../createOAuthAdapter";
import { createOAuthCipher } from "../createOAuthCipher";
import type { OAuthStore, OAuthStoredRecord } from "../OAuthStore";
const cipher = createOAuthCipher({ activeKeyId: "test", keys: { test: Buffer.alloc(32, 2) } });
const store = {
  upsert: vi.fn(),
  find: vi.fn(),
  consume: vi.fn(),
  destroy: vi.fn(),
  revokeGrant: vi.fn(),
} satisfies OAuthStore;
const invalidGrant = () => Object.assign(new Error("invalid_grant"), { error: "invalid_grant" });
const factory = () =>
  createOAuthAdapter({
    namespace: "issuer",
    indexKey: Buffer.alloc(32, 1),
    cipher,
    store,
    invalidGrant,
  });
beforeEach(() => vi.resetAllMocks());
it("stores only ciphertext and keyed hashes, and preserves records across adapter instances", async () => {
  await factory()("AuthorizationCode").upsert(
    "code-secret",
    { accountId: "account-secret", grantId: "grant-secret" },
    60,
  );
  const saved = store.upsert.mock.calls[0][0];
  expect(JSON.stringify(saved)).not.toMatch(/code-secret|account-secret|grant-secret/);
  expect(saved.idHash).toMatch(/^[a-f0-9]{64}$/);
  store.find.mockResolvedValue({ id_hash: saved.idHash, payload: saved.payload, consumed: null });
  expect(await factory()("AuthorizationCode").find("code-secret")).toEqual({
    accountId: "account-secret",
    grantId: "grant-secret",
  });
});
it("uses authoritative database consumption and throws invalid_grant when atomic redemption loses", async () => {
  await factory()("AuthorizationCode").upsert("code", { consumed: 123 }, 60);
  const saved = store.upsert.mock.calls[0][0];
  store.find.mockResolvedValue({ id_hash: saved.idHash, payload: saved.payload, consumed: null });
  expect(await factory()("AuthorizationCode").find("code")).not.toHaveProperty("consumed");
  store.find.mockResolvedValue({ id_hash: saved.idHash, payload: saved.payload, consumed: 456 });
  expect(await factory()("AuthorizationCode").find("code")).toHaveProperty("consumed", 456);
  store.consume.mockResolvedValue(false);
  await expect(factory()("AuthorizationCode").consume("code")).rejects.toMatchObject({
    error: "invalid_grant",
  });
});
it("authenticates secondary lookups and rejects misrouted database records", async () => {
  await factory()("Session").upsert("session", { uid: "secondary" }, 60);
  const saved = store.upsert.mock.calls[0][0];
  store.find.mockResolvedValue({ id_hash: saved.idHash, payload: saved.payload, consumed: null });
  expect(await factory()("Session").findByUid("secondary")).toEqual({ uid: "secondary" });
  await expect(factory()("Session").findByUid("wrong")).rejects.toThrow();
  await expect(factory()("Session").find("wrong-id")).rejects.toThrow();
});
it("fails closed on corrupt data and storage outages without leaking backend errors", async () => {
  store.find.mockResolvedValue({
    id_hash: "a".repeat(64),
    payload: "corrupt",
    consumed: null,
  } satisfies OAuthStoredRecord);
  await expect(factory()("Session").find("id")).rejects.toThrow();
  store.find.mockRejectedValue(new Error("sensitive backend detail"));
  await expect(factory()("Session").find("id")).rejects.toThrow("OAuth storage unavailable");
});
it("allows permanent clients only and hashes grant revocation consistently", async () => {
  await expect(factory()("AccessToken").upsert("id", {})).rejects.toThrow();
  await factory()("Client").upsert("id", {});
  await factory()("Grant").upsert("grant", {}, 60);
  const grant = store.upsert.mock.calls[1][0];
  await factory()("AccessToken").revokeByGrantId("grant");
  expect(store.revokeGrant).toHaveBeenCalledWith("issuer", grant.idHash);
});
