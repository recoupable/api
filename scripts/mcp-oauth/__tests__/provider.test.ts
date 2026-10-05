import { afterEach, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { startOAuthLab } from "../fixtures/startOAuthLab";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

async function setup() {
  const lab = await startOAuthLab();
  cleanup.push(lab.close);
  const discovery = await fetch(`${lab.issuer}/.well-known/openid-configuration`).then(r =>
    r.json(),
  );
  const register = async (redirectUris = ["https://agent.example/callback"], native = false) => {
    const response = await fetch(discovery.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Recoup compatibility fixture (not a verified vendor)",
        redirect_uris: redirectUris,
        application_type: native ? "native" : "web",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    return { response, client: await response.json() };
  };
  const { response, client } = await register();
  expect(response.status).toBe(201);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = async (overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      response_type: "code",
      scope: "mcp:read mcp:write offline_access",
      resource: lab.resource,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: randomBytes(16).toString("hex"),
      ...overrides,
    });
    // The fixture completes explicit synthetic login/consent. No Privy or customer account is used.
    return lab.authorize(`${discovery.authorization_endpoint}?${params}`);
  };
  const exchange = async (code: string, overrides: Record<string, string> = {}) => {
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.client_id,
        redirect_uri: client.redirect_uris[0],
        code,
        code_verifier: verifier,
        resource: lab.resource,
        ...overrides,
      }),
    });
    return { response, body: await response.json() };
  };
  return { lab, discovery, client, register, authorize, exchange };
}

describe("OAuth provider compatibility spike (synthetic identity, isolated MCP tools)", () => {
  it("discovers PKCE, registration, issuer identification and the protected MCP resource", async () => {
    const { discovery, lab } = await setup();
    expect(discovery.code_challenge_methods_supported).toEqual(["S256"]);
    expect(discovery.authorization_response_iss_parameter_supported).toBe(true);
    expect(discovery.client_id_metadata_document_supported).toBe(true);
    const response = await fetch(lab.resource);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    const metadata = await fetch(`${lab.issuer}/.well-known/oauth-protected-resource`).then(r =>
      r.json(),
    );
    expect(metadata.resource).toBe(lab.resource);
    expect(metadata.authorization_servers).toEqual([lab.issuer]);
  });

  it("registers, logs in, consents, exchanges PKCE, reads and writes through the MCP SDK", async () => {
    const { lab, authorize, exchange } = await setup();
    const callback = await authorize();
    expect(callback.searchParams.get("iss")).toBe(lab.issuer);
    const token = await exchange(callback.searchParams.get("code")!);
    expect(token.response.status).toBe(200);
    expect(token.body.refresh_token).toBeTypeOf("string");
    const result = await lab.exerciseMcp(token.body.access_token);
    expect(result.before).toBe("initial");
    expect(result.after).toBe("updated by agent");
    expect(result.tools).toEqual(["read_fixture", "write_fixture"]);
    expect(JSON.stringify(result)).not.toContain(token.body.access_token);
  });

  it("denies writes for a read-only grant without changing the fixture", async () => {
    const { lab, authorize, exchange } = await setup();
    const callback = await authorize({ scope: "mcp:read" });
    const token = await exchange(callback.searchParams.get("code")!);
    const result = await lab.exerciseMcp(token.body.access_token);
    expect(result.writeDenied).toBe(true);
    expect(result.after).toBe("initial");
  });

  it.each([
    ["Claude", ["https://claude.ai/api/mcp/auth_callback"], false],
    ["ChatGPT", ["https://chatgpt.com/connector_platform_oauth_redirect"], false],
    ["ChatGPT callback ID", ["https://chatgpt.com/connector/oauth/example-id"], false],
    ["Codex", ["http://127.0.0.1:43123/callback/example-id"], true],
    ["Cursor desktop", ["http://localhost:8787/callback"], true],
    ["Cursor cloud", ["https://www.cursor.com/agents/mcp/oauth/callback"], false],
    [
      "Cursor combined",
      ["http://localhost:8787/callback", "https://www.cursor.com/agents/mcp/oauth/callback"],
      true,
    ],
  ])(
    "accepts documented %s redirect registration (not a live client test)",
    async (_name, uris, native) => {
      const { register, authorize, exchange } = await setup();
      const registered = await register(uris, native);
      expect(registered.response.status).toBe(201);
      for (const redirect of uris) {
        const callback = await authorize({
          client_id: registered.client.client_id,
          redirect_uri: redirect,
        });
        expect(callback.searchParams.get("code")).toBeTypeOf("string");
        expect(
          (
            await exchange(callback.searchParams.get("code")!, {
              client_id: registered.client.client_id,
              redirect_uri: redirect,
            })
          ).response.status,
        ).toBe(200);
      }
    },
  );

  it("rejects an unregistered callback without redirecting to it", async () => {
    const { authorize, lab } = await setup();
    const result = await authorize({ redirect_uri: "https://attacker.example/callback" });
    expect(result.origin).toBe(lab.issuer);
    expect(result.searchParams.get("code")).toBeNull();
  });

  it.each([
    { code_challenge_method: "plain" },
    { code_challenge: "", code_challenge_method: "" },
    { resource: "https://other.example/mcp" },
  ])("rejects invalid authorization parameters %j", async overrides => {
    const { authorize } = await setup();
    const result = await authorize(overrides);
    expect(result.searchParams.get("code")).toBeNull();
  });

  it("rejects wrong PKCE verifier and authorization code replay", async () => {
    const { authorize, exchange } = await setup();
    const callback = await authorize();
    const code = callback.searchParams.get("code")!;
    expect((await exchange(code, { code_verifier: "x".repeat(43) })).response.status).toBe(400);
    expect((await exchange(code)).response.status).toBe(200);
    expect((await exchange(code)).response.status).toBe(400);
  });

  it("rejects token exchange with another resource or redirect", async () => {
    const { authorize, exchange } = await setup();
    const callback = await authorize();
    const code = callback.searchParams.get("code")!;
    expect(
      (await exchange(code, { redirect_uri: "https://other.example/callback" })).response.status,
    ).toBe(400);
    expect((await exchange(code, { resource: "https://other.example/mcp" })).response.status).toBe(
      400,
    );
  });

  it("rotates refresh tokens and rejects a revoked grant at the MCP boundary", async () => {
    const { lab, discovery, client, authorize, exchange } = await setup();
    const callback = await authorize();
    const token = await exchange(callback.searchParams.get("code")!);
    const refresh = await fetch(discovery.token_endpoint, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: client.client_id,
        refresh_token: token.body.refresh_token,
        resource: lab.resource,
      }),
    });
    expect(refresh.status).toBe(200);
    const renewed = await refresh.json();
    expect(renewed.refresh_token).not.toBe(token.body.refresh_token);
    await lab.revokeGrant(renewed.access_token);
    const denied = await fetch(lab.resource, {
      headers: { Authorization: `Bearer ${renewed.access_token}` },
    });
    expect(denied.status).toBe(401);
  });
  it("resolves a CIMD client and completes exchange using a synthetic HTTPS metadata response", async () => {
    const { lab, authorize, exchange } = await setup();
    const clientId = "https://agent.example/oauth/client.json";
    lab.metadataDocuments.set(clientId, {
      client_id: clientId,
      client_name: "Synthetic CIMD client",
      redirect_uris: ["https://agent.example/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    const callback = await authorize({ client_id: clientId });
    expect(callback.searchParams.get("code")).toBeTypeOf("string");
    const result = await exchange(callback.searchParams.get("code")!, { client_id: clientId });
    expect(result.response.status).toBe(200);
    expect((await lab.exerciseMcp(result.body.access_token)).after).toBe("updated by agent");
  });

  it("rejects mismatched CIMD identity and refuses unknown metadata fetches", async () => {
    const { lab, authorize } = await setup();
    const clientId = "https://agent.example/oauth/client.json";
    lab.metadataDocuments.set(clientId, {
      client_id: "https://different.example/client.json",
      redirect_uris: ["https://agent.example/callback"],
      token_endpoint_auth_method: "none",
    });
    expect((await authorize({ client_id: clientId })).searchParams.get("code")).toBeNull();
    expect(
      (await authorize({ client_id: "https://127.0.0.1/client.json" })).searchParams.get("code"),
    ).toBeNull();
  });

  it("supports a pre-registered client without dynamic registration", async () => {
    const { authorize, exchange } = await setup();
    const callback = await authorize({ client_id: "pre-registered-agent" });
    const result = await exchange(callback.searchParams.get("code")!, {
      client_id: "pre-registered-agent",
    });
    expect(result.response.status).toBe(200);
  });

  it("rejects a replayed refresh token and invalidates its grant", async () => {
    const { lab, discovery, client, authorize, exchange } = await setup();
    const callback = await authorize();
    const token = await exchange(callback.searchParams.get("code")!);
    const refresh = () =>
      fetch(discovery.token_endpoint, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: client.client_id,
          refresh_token: token.body.refresh_token,
          resource: lab.resource,
        }),
      });
    const first = await refresh();
    expect(first.status).toBe(200);
    const renewed = await first.json();
    expect((await refresh()).status).toBe(400);
    expect(
      (await fetch(lab.resource, { headers: { Authorization: `Bearer ${renewed.access_token}` } }))
        .status,
    ).toBe(401);
  });
  it("returns state and issuer on denied consent without issuing a code", async () => {
    const { lab, authorize } = await setup();
    lab.denyConsent();
    const callback = await authorize({ state: "synthetic-request-state" });
    expect(callback.searchParams.get("state")).toBe("synthetic-request-state");
    expect(callback.searchParams.get("iss")).toBe(lab.issuer);
    expect(callback.searchParams.get("error")).toBe("access_denied");
    expect(callback.searchParams.get("code")).toBeNull();
  });
});
