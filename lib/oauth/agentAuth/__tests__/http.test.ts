import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { fixture, identity } from "./fixture";
import { createOAuthNodeHandler } from "../../createOAuthNodeHandler";
import { createAgentRegistrationHandler } from "../createAgentRegistrationHandler";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

async function setup() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(
    () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  const f = fixture((server.address() as AddressInfo).port);
  const agent = createAgentRegistrationHandler({
    config: f.config,
    service: f.service,
    resolveIdentity: async token => {
      if (token !== "alice-session") throw new Error("invalid login");
      return identity;
    },
  });
  const callback = f.provider.callback();
  server.on(
    "request",
    createOAuthNodeHandler(f.config.issuer, async (req, res) => {
      if (!(await agent(req, res))) await callback(req, res);
    }),
  );
  const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${f.config.issuer}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { ...f, json };
}

it("serves a complete registration through the standard token endpoint with real provider tokens", async () => {
  const f = await setup();
  const discovery = await fetch(`${f.config.issuer}/.well-known/openid-configuration`).then(r =>
    r.json(),
  );
  expect(discovery.agent_auth).toMatchObject({
    identity_endpoint: `${f.config.issuer}/agent/identity`,
    identity_types_supported: ["service_auth"],
  });
  expect(discovery.grant_types_supported).toEqual(
    expect.arrayContaining([
      "authorization_code",
      "urn:workos:agent-auth:grant-type:claim",
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    ]),
  );
  const response = await f.json("/agent/identity", {
    type: "service_auth",
    login_hint: "alice@example.com",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const registration = await response.json();
  const attempt = new URL(registration.claim.verification_uri).searchParams.get(
    "claim_attempt_token",
  );
  const headers = { Origin: f.config.consentOrigin, Authorization: "Bearer alice-session" };
  const loaded = await f.json("/agent/identity/claim", { claim_attempt_token: attempt }, headers);
  const consent = await loaded.json();
  expect(loaded.status).toBe(200);
  expect(
    (
      await f.json(
        "/agent/identity/claim/complete",
        {
          claim_attempt_token: attempt,
          csrf: consent.csrf,
          decision: "approve",
          user_code: registration.claim.user_code,
        },
        headers,
      )
    ).status,
  ).toBe(200);
  const token = await fetch(discovery.token_endpoint, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:workos:agent-auth:grant-type:claim",
      claim_token: registration.claim_token,
    }),
  }).then(r => r.json());
  expect(token).toMatchObject({ token_type: "Bearer", scope: "mcp:read" });
  const access = await f.provider.AccessToken.find(token.access_token);
  expect(access?.aud).toBe(f.config.resource);
  const revoke = await fetch(discovery.revocation_endpoint, {
    method: "POST",
    body: new URLSearchParams({ token: token.access_token }),
  });
  expect(revoke.status).toBe(200);
  expect(await f.provider.AccessToken.find(token.access_token)).toBeUndefined();
});

it("requires the exact consent origin and a verified sign-in, never cookies alone", async () => {
  const f = await setup();
  for (const headers of [
    {},
    { Origin: "https://attacker.example", Authorization: "Bearer alice-session" },
    { Origin: f.config.consentOrigin },
    { Origin: f.config.consentOrigin, Authorization: "Bearer fake" },
  ])
    expect(
      (
        await f.json(
          "/agent/identity/claim",
          { claim_attempt_token: `cla_${"a".repeat(43)}` },
          headers,
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
});

it("rejects unsupported identity types, caller authority, duplicate form fields, and DPoP downgrade", async () => {
  const f = await setup();
  for (const body of [
    { type: "anonymous" },
    { type: "identity_assertion", assertion: "fake" },
    { type: "service_auth", login_hint: "alice@example.com", scope: "mcp:tools" },
    { type: "service_auth", login_hint: "alice@example.com", account_id: identity.accountId },
  ])
    expect((await f.json("/agent/identity", body)).status).toBe(400);
  const form = new URLSearchParams({
    grant_type: "urn:workos:agent-auth:grant-type:claim",
    claim_token: `clm_${"a".repeat(43)}`,
  });
  form.append("grant_type", "authorization_code");
  expect((await fetch(`${f.config.issuer}/token`, { method: "POST", body: form })).status).toBe(
    400,
  );
  form.delete("grant_type");
  form.set("grant_type", "urn:workos:agent-auth:grant-type:claim");
  expect(
    (
      await fetch(`${f.config.issuer}/token`, {
        method: "POST",
        headers: { DPoP: "proof" },
        body: form,
      })
    ).status,
  ).toBe(400);
});

it("preserves ordinary OAuth parsing and registration while the extension is mounted", async () => {
  const f = await setup();
  const registered = await f.json("/reg", {
    redirect_uris: ["https://agent.example/callback"],
    response_types: ["code"],
    grant_types: ["authorization_code"],
    token_endpoint_auth_method: "none",
  });
  expect(registered.status).toBe(201);
  const client = await registered.json();
  const token = await fetch(`${f.config.issuer}/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.client_id,
      code: "missing",
      code_verifier: "x".repeat(43),
      redirect_uri: "https://agent.example/callback",
    }),
  });
  expect(token.status).toBe(400);
  expect(await token.json()).toMatchObject({ error: "invalid_grant" });
  const grant = new f.provider.Grant({ accountId: identity.accountId, clientId: client.client_id });
  grant.addResourceScope(f.config.resource, "mcp:read");
  const grantId = await grant.save();
  const verifier = randomBytes(32).toString("base64url");
  const code = new f.provider.AuthorizationCode({
    accountId: identity.accountId,
    clientId: client.client_id,
    grantId,
    redirectUri: "https://agent.example/callback",
    scope: "mcp:read",
    resource: f.config.resource,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    codeChallengeMethod: "S256",
  });
  const valid = await fetch(`${f.config.issuer}/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.client_id,
      code: await code.save(),
      code_verifier: verifier,
      redirect_uri: "https://agent.example/callback",
      resource: f.config.resource,
    }),
  });
  expect(valid.status).toBe(200);
  expect(await valid.json()).toMatchObject({ scope: "mcp:read", token_type: "Bearer" });
});

it("does not allow the reserved registration client to use ordinary OAuth grants", async () => {
  const f = await setup();
  const response = await fetch(`${f.config.issuer}/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "recoup-service-auth",
      code: "arbitrary",
    }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: "invalid_request" });
});

it("keeps revocation idempotent and treats token_type_hint as a hint", async () => {
  const f = await setup();
  const registration = await f.service.create("alice@example.com");
  const attempt = new URL(registration.claim.verification_uri).searchParams.get(
    "claim_attempt_token",
  )!;
  const consent = await f.service.load(attempt, identity);
  await f.service.decide(
    attempt,
    { csrf: consent.csrf, decision: "approve", user_code: registration.claim.user_code },
    identity,
  );
  const token = await f.service.poll(registration.claim_token, {});
  const revoke = () =>
    fetch(`${f.config.issuer}/token/revocation`, {
      method: "POST",
      body: new URLSearchParams({ token: token.access_token, token_type_hint: "refresh_token" }),
    });
  expect((await revoke()).status).toBe(200);
  expect((await revoke()).status).toBe(200);
  expect(await f.provider.AccessToken.find(token.access_token)).toBeUndefined();
});
