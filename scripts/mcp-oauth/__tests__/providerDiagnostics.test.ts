import { generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { AdapterFactory } from "oidc-provider";
import { afterEach, expect, it, vi } from "vitest";
import { createRecoupOAuthProvider } from "../../../lib/oauth/createRecoupOAuthProvider";
import { createOAuthNodeHandler } from "../../../lib/oauth/createOAuthNodeHandler";
import { loadOAuthConfig } from "../../../lib/oauth/loadOAuthConfig";

vi.mock("../../../lib/oauth/createOAuthMetadataFetch", () => ({
  createOAuthMetadataFetch: () => async () => {
    throw new Error("External metadata requests are forbidden in this fixture");
  },
}));
afterEach(() => vi.restoreAllMocks());

async function fixture() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const upsert = vi.fn(async () => {});
  const adapter: AdapterFactory = () => ({
    upsert,
    find: async () => undefined,
    findByUid: async () => undefined,
    findByUserCode: async () => undefined,
    consume: async () => {},
    destroy: async () => {},
    revokeByGrantId: async () => {},
  });
  try {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const config = loadOAuthConfig({
      OAUTH_ISSUER: `${origin}/api/oauth`,
      OAUTH_CONSENT_URL: `${origin}/oauth/authorize`,
      OAUTH_SIGNING_JWKS: JSON.stringify({
        keys: [{ ...privateKey.export({ format: "jwk" }), kid: "test", use: "sig", alg: "RS256" }],
      }),
      OAUTH_COOKIE_KEYS: JSON.stringify([Buffer.alloc(32, 1).toString("base64")]),
      OAUTH_INDEX_KEY: Buffer.alloc(32, 2).toString("base64"),
      OAUTH_ENCRYPTION_KEYS: JSON.stringify({ test: Buffer.alloc(32, 3).toString("base64") }),
      OAUTH_ACTIVE_ENCRYPTION_KEY: "test",
    });
    const provider = createRecoupOAuthProvider(config, adapter, async () => false);
    server.on("request", createOAuthNodeHandler(config.issuer, provider.callback()));
  } catch (error) {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw error;
  }
  return {
    log,
    upsert,
    register: (body: unknown) =>
      fetch(`${origin}/api/oauth/reg`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      }),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

const metadata = {
  redirect_uris: ["https://agent.example/callback"],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code"],
  response_types: ["code"],
};

it("reports provider-handled registration failure with only a fixed nonsecret event", async () => {
  const f = await fixture();
  try {
    f.upsert.mockRejectedValue(
      Object.assign(new Error("synthetic-backend-token-canary"), {
        cause: new Error("synthetic-cause-canary"),
        accountId: "synthetic-private-account",
      }),
    );
    const response = await f.register(metadata);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "server_error",
      error_description: "oops! something went wrong",
    });
    expect(f.upsert).toHaveBeenCalledOnce();
    expect(f.log.mock.calls).toEqual([
      ["OAuth provider unavailable", { event: "oauth_provider_unavailable" }],
    ]);
  } finally {
    await f.close();
  }
});

it("keeps expected registration denials and successful registration out of failure events", async () => {
  const f = await fixture();
  try {
    const invalid = await f.register({
      ...metadata,
      redirect_uris: ["https://agent.example/cb#fragment"],
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toBe("invalid_redirect_uri");
    expect(f.upsert).not.toHaveBeenCalled();
    const success = await f.register(metadata);
    expect(success.status).toBe(201);
    await success.json();
    expect(f.upsert).toHaveBeenCalledOnce();
    expect(f.log).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
