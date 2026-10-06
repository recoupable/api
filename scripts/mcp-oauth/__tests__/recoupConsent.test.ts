import { createHash, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { AdapterFactory, AdapterPayload } from "oidc-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { registerOAuthTools } from "../../../lib/mcp/oauth/registerOAuthTools";
import { resolveOAuthAccess } from "../../../lib/oauth/resolveOAuthAccess";
import { getOAuthResourceMetadata } from "../../../lib/oauth/getOAuthResourceMetadata";
import { expect, it, vi } from "vitest";
import { apiResolver } from "next/dist/server/api-utils/node/api-resolver.js";
import { loadOAuthConfig } from "../../../lib/oauth/loadOAuthConfig";
import { createRecoupOAuthProvider } from "../../../lib/oauth/createRecoupOAuthProvider";
import { createOAuthNodeHandler } from "../../../lib/oauth/createOAuthNodeHandler";
import { createOAuthConsentHandler } from "../../../lib/oauth/consent/createOAuthConsentHandler";
import { createPostgresTestAdapter } from "../fixtures/createPostgresTestAdapter";

// Protocol-only fallback; the PostgreSQL harness injects the real encrypted adapter.
function memoryAdapter(): AdapterFactory {
  const records = new Map<string, AdapterPayload>();
  return model => ({
    upsert: async (id, payload) => {
      records.set(`${model}:${id}`, payload);
    },
    find: async id => records.get(`${model}:${id}`),
    findByUid: async uid =>
      [...records.entries()].find(
        ([key, value]) => key.startsWith(`${model}:`) && value.uid === uid,
      )?.[1],
    findByUserCode: async () => undefined,
    consume: async id => {
      const record = records.get(`${model}:${id}`);
      if (!record || record.consumed) throw new Error("invalid_grant");
      record.consumed = Math.floor(Date.now() / 1000);
    },
    destroy: async id => {
      records.delete(`${model}:${id}`);
    },
    revokeByGrantId: async id => {
      for (const [key, value] of records)
        if (key === `Grant:${id}` || value.grantId === id) records.delete(key);
    },
  });
}

it("requires browser cookie, trusted origin, matching identity, and one-use consent before issuing tokens", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const secret = Buffer.alloc(32, 7).toString("base64");
  try {
    const config = loadOAuthConfig({
      OAUTH_ISSUER: `${origin}/api/oauth`,
      OAUTH_CONSENT_URL: `${origin}/oauth/authorize`,
      OAUTH_SIGNING_JWKS: JSON.stringify({
        keys: [{ ...privateKey.export({ format: "jwk" }), kid: "test", use: "sig", alg: "RS256" }],
      }),
      OAUTH_COOKIE_KEYS: JSON.stringify([Buffer.alloc(32, 8).toString("base64")]),
      OAUTH_INDEX_KEY: Buffer.alloc(32, 9).toString("base64"),
      OAUTH_ENCRYPTION_KEYS: JSON.stringify({ test: secret }),
      OAUTH_ACTIVE_ENCRYPTION_KEY: "test",
    });
    const adapter = process.env.OAUTH_TEST_PG_SOCKET
      ? createPostgresTestAdapter(config.issuer)
      : memoryAdapter();
    const accountId = "00000000-0000-4000-8000-000000000001";
    const provider = createRecoupOAuthProvider(config, adapter, async id => id === accountId);
    const consent = createOAuthConsentHandler({
      config,
      provider,
      adapter,
      resolveIdentity: async token => {
        if (token === "alice") return { accountId, subject: "did:privy:alice" };
        if (token === "bob")
          return { accountId: "00000000-0000-4000-8000-000000000002", subject: "did:privy:bob" };
        throw new Error("invalid login");
      },
    });
    const callback = provider.callback();
    const handler = createOAuthNodeHandler(config.issuer, async (req, res) => {
      const match = /^\/interaction\/([^/?]+)$/.exec(req.url ?? "");
      if (match) await consent(req, res, match[1]);
      else await callback(req, res);
    });
    const verify = (bearer: string) =>
      resolveOAuthAccess(
        {
          provider,
          adapter,
          resource: config.resource,
          accountExists: async id => id === accountId,
        },
        bearer,
      );
    const createArtist = vi.fn(async (owner: string, name: string) => ({
      id: "fixture-artist",
      owner,
      name,
    }));
    const services = {
      listArtists: async () => [],
      createArtist,
      updateArtist: async () => ({}),
      getSocials: async () => [],
      getChats: async () => [],
    };
    server.on("request", async (req, res) => {
      if (req.url === "/.well-known/oauth-protected-resource/mcp") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(getOAuthResourceMetadata(config.issuer)));
        return;
      }
      if (req.url === "/mcp") {
        const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "")?.[1];
        const access = bearer ? await verify(bearer) : undefined;
        if (!access) {
          res.writeHead(401);
          res.end();
          return;
        }
        const mcp = new McpServer({ name: "recoup-delegated-integration", version: "1" });
        registerOAuthTools(mcp, services, verify);
        Object.assign(req, {
          auth: {
            token: bearer,
            clientId: access.clientId,
            scopes: access.scopes,
            extra: { accountId: access.accountId, oauth: access },
          },
        });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        res.on("close", () => {
          void transport.close();
          void mcp.close();
        });
        await mcp.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }
      void apiResolver(
        req,
        res,
        {},
        { default: handler, config: { api: { bodyParser: false, externalResolver: true } } },
        {
          previewModeId: "fixture",
          previewModeEncryptionKey: "fixture",
          previewModeSigningKey: "fixture",
          dev: false,
        },
        false,
      );
    });
    const registered = await fetch(`${config.issuer}/reg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Synthetic agent",
        redirect_uris: ["https://agent.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(registered.status).toBe(201);
    const client = await registered.json();
    const cookies = new Map<string, { pair: string; path: string }>();
    const browserFetch = async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      const cookie = [...cookies.values()]
        .filter(
          c => path === c.path || path.startsWith(c.path.endsWith("/") ? c.path : `${c.path}/`),
        )
        .map(c => c.pair)
        .join("; ");
      const response = await fetch(url, {
        ...init,
        redirect: "manual",
        headers: { cookie, ...init.headers },
      });
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(";")[0];
        cookies.set(pair.split("=")[0], { pair, path: /; path=([^;]+)/i.exec(raw)?.[1] ?? "/" });
      }
      return response;
    };
    const verifier = "v".repeat(43);
    const authorize = `${config.issuer}/auth?${new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: "https://agent.example/callback",
      response_type: "code",
      scope: "mcp:read mcp:write",
      resource: config.resource,
      state: "state",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    })}`;
    const start = await browserFetch(authorize);
    expect(start.status).toBe(303);
    const interactionUrl = start.headers.get("location")!;
    expect(interactionUrl).toContain(`${config.issuer}/interaction/`);
    expect((await browserFetch(interactionUrl)).headers.get("location")).toContain(
      `${config.consentUrl}?interaction=`,
    );
    const headers = {
      Origin: config.consentOrigin,
      Authorization: "Bearer alice",
      "Content-Type": "application/json",
    };
    expect((await fetch(interactionUrl, { headers })).status).toBe(400);
    expect(
      (
        await browserFetch(interactionUrl, {
          headers: { ...headers, Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    const metadataResponse = await browserFetch(interactionUrl, { headers });
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.headers.get("access-control-allow-origin")).toBe(origin);
    const metadata = await metadataResponse.json();
    expect(metadata.permissions.map((p: { scope: string }) => p.scope)).toEqual([
      "mcp:read",
      "mcp:write",
    ]);
    const submit = (extra: object = {}, auth = "alice") =>
      browserFetch(interactionUrl, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ decision: "approve", csrf: metadata.csrf, ...extra }),
      });
    expect((await submit({}, "bob")).status).toBe(400);
    expect((await submit({ scopes: ["mcp:delete"] })).status).toBe(400);
    const approved = await submit();
    expect(approved.status).toBe(200);
    expect((await submit()).status).toBe(400);
    const { redirectUrl } = await approved.json();
    const resumed = await browserFetch(redirectUrl);
    expect(resumed.status).toBe(303);
    const redirect = new URL(resumed.headers.get("location")!);
    expect(redirect.origin).toBe("https://agent.example");
    expect(redirect.searchParams.get("error")).toBeNull();
    const tokensResponse = await fetch(`${config.issuer}/token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: client.client_id,
        grant_type: "authorization_code",
        code: redirect.searchParams.get("code")!,
        redirect_uri: "https://agent.example/callback",
        code_verifier: verifier,
        resource: config.resource,
      }),
    });
    expect(tokensResponse.status).toBe(200);
    const tokens = await tokensResponse.json();
    expect(tokens.scope).toBe("mcp:read mcp:write");
    expect(tokens.refresh_token).toEqual(expect.any(String));
    const delegated = await verify(tokens.access_token);
    expect(delegated).toMatchObject({ accountId, scopes: ["mcp:read", "mcp:write"] });
    const mcpClient = new Client({ name: "synthetic-agent", version: "1" });
    await mcpClient.connect(
      new StreamableHTTPClientTransport(new URL(config.resource), {
        requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      }),
    );
    try {
      const inventory = await mcpClient.listTools();
      expect(inventory.tools.map(tool => tool.name)).toEqual([
        "list_artists",
        "create_new_artist",
        "update_account_info",
        "get_artist_socials",
        "get_chats",
      ]);
      expect(
        (
          await mcpClient.callTool({
            name: "create_new_artist",
            arguments: { name: "OAuth fixture artist" },
          })
        ).isError,
      ).not.toBe(true);
      expect(createArtist).toHaveBeenCalledWith(accountId, "OAuth fixture artist");
      const forged = await mcpClient.callTool({
        name: "create_new_artist",
        arguments: { name: "bad", account_id: "other" },
      });
      expect(forged.isError).toBe(true);
      expect(createArtist).toHaveBeenCalledTimes(1);
    } finally {
      await mcpClient.close();
    }

    const access = await provider.AccessToken.find(tokens.access_token);
    expect(access?.accountId).toBe(accountId);
    expect(access?.aud).toBe(config.resource);
    const attribution = await adapter("RecoupGrant").find(access!.grantId);
    expect(attribution && attribution.extra?.subject).toBe("did:privy:alice");
    expect(attribution && attribution.extra?.expiresAt).toEqual(expect.any(Number));
    const refresh = await fetch(`${config.issuer}/token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: client.client_id,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        resource: config.resource,
      }),
    });
    expect(refresh.status).toBe(200);
    const renewed = await refresh.json();
    expect(renewed.refresh_token).not.toBe(tokens.refresh_token);
    const oldRefresh = await provider.RefreshToken.find(tokens.refresh_token);
    const newRefresh = await provider.RefreshToken.find(renewed.refresh_token);
    expect(newRefresh!.exp).toBeLessThanOrEqual(oldRefresh!.exp!);
    // A new authorization request still requires consent, even with an existing browser session.
    const nextInteraction = (await browserFetch(authorize)).headers.get("location")!;
    expect(nextInteraction).toContain("/interaction/");
    const nextMetadata = await (await browserFetch(nextInteraction, { headers })).json();
    const denied = await browserFetch(nextInteraction, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "deny", csrf: nextMetadata.csrf }),
    });
    expect(denied.status).toBe(200);
    const deniedResume = await browserFetch((await denied.json()).redirectUrl);
    const denial = new URL(deniedResume.headers.get("location")!);
    expect(denial.searchParams.get("error")).toBe("access_denied");
    expect(denial.searchParams.has("code")).toBe(false);
    await adapter("Grant").revokeByGrantId(access!.grantId);
    expect(await verify(tokens.access_token)).toBeUndefined();
    expect(await verify(renewed.access_token)).toBeUndefined();
    expect(
      (
        await fetch(config.resource, {
          headers: { Authorization: `Bearer ${renewed.access_token}` },
        })
      ).status,
    ).toBe(401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
