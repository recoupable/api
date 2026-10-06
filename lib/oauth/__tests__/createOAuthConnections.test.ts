import { expect, it, vi } from "vitest";
import { createOAuthConnections } from "../createOAuthConnections";
import { createOAuthAdapter } from "../createOAuthAdapter";
import { createOAuthCipher } from "../createOAuthCipher";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { OAuthStore } from "../OAuthStore";

it("authenticates encrypted connection ownership before listing or revoking a grant", async () => {
  const config = {
    issuer: "issuer",
    indexKey: Buffer.alloc(32, 1),
    cipher: createOAuthCipher({ activeKeyId: "test", keys: { test: Buffer.alloc(32, 2) } }),
  } as OAuthRuntimeConfig;
  const store = {
    upsert: vi.fn(),
    find: vi.fn(),
    consume: vi.fn(),
    destroy: vi.fn(),
    revokeGrant: vi.fn(),
    listConnections: vi.fn(),
  } satisfies OAuthStore;
  const adapter = createOAuthAdapter({
    ...config,
    namespace: config.issuer,
    store,
    invalidGrant: () => new Error(),
  });
  const accountId = "00000000-0000-4000-8000-000000000001";
  await adapter("RecoupGrant").upsert(
    "secret-grant",
    {
      accountId,
      clientId: "client",
      grantId: "secret-grant",
      extra: {
        context: "personal",
        clientName: "Agent",
        scopes: ["recoup:read"],
        createdAt: 1,
        expiresAt: 100,
      },
    },
    60,
  );
  const saved = store.upsert.mock.calls[0][0];
  const record = { id_hash: saved.idHash, payload: saved.payload, consumed: null };
  store.listConnections.mockResolvedValue([record]);
  store.find.mockResolvedValue(record);
  const connections = createOAuthConnections(config, store, adapter);
  const result = await connections.list(accountId);
  expect(store.listConnections).toHaveBeenCalledWith("issuer", saved.accountHash);
  expect(JSON.stringify(result)).not.toContain("secret-grant");
  expect(result.connections[0]).toMatchObject({ id: saved.idHash, clientName: "Agent" });
  await expect(connections.list("00000000-0000-4000-8000-000000000002")).rejects.toThrow();
  await expect(
    connections.revoke("00000000-0000-4000-8000-000000000002", saved.idHash),
  ).rejects.toThrow();
  expect(store.revokeGrant).not.toHaveBeenCalled();
  await connections.revoke(accountId, saved.idHash);
  expect(store.revokeGrant).toHaveBeenCalledWith("issuer", saved.idHash);
  store.find.mockResolvedValue(null);
  await connections.revoke(accountId, saved.idHash);
  expect(store.revokeGrant).toHaveBeenCalledTimes(1);
});
