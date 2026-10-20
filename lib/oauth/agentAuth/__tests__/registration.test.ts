import { describe, expect, it } from "vitest";
import { decodeJwt, importJWK, SignJWT, type JWK } from "jose";
import { fixture, identity } from "./fixture";
import { createOAuthConnections } from "../../createOAuthConnections";
import { resolveOAuthAccess } from "../../resolveOAuthAccess";

async function start(f = fixture()) {
  const registration = await f.service.create("Alice@Example.com");
  const attempt = new URL(registration.claim.verification_uri).searchParams.get(
    "claim_attempt_token",
  )!;
  const consent = await f.service.load(attempt, identity);
  return { ...f, registration, attempt, consent };
}
async function approve(f: Awaited<ReturnType<typeof start>>) {
  return f.service.decide(
    f.attempt,
    { csrf: f.consent.csrf, decision: "approve", user_code: f.registration.claim.user_code },
    identity,
  );
}

describe("user-verified personal read-only agent registration", () => {
  it("returns only claim handles before approval and stores no raw secrets", async () => {
    const f = await start();
    expect(f.registration).toMatchObject({
      registration_type: "service_auth",
      post_claim_scopes: ["mcp:read"],
      claim: { expires_in: 600, interval: 5 },
    });
    expect(f.registration).not.toHaveProperty("identity_assertion");
    expect(f.registration).not.toHaveProperty("access_token");
    expect(f.consent).toMatchObject({
      context: "personal",
      accessDurationSeconds: 3600,
      permissions: [{ scope: "mcp:read" }],
    });
    const stored = JSON.stringify([...f.records.values()]);
    for (const secret of [
      f.registration.claim_token,
      f.attempt,
      f.registration.claim.user_code,
      "alice@example.com",
    ])
      expect(stored).not.toContain(secret);
    await expect(f.service.poll(f.registration.claim_token, {})).rejects.toMatchObject({
      error: "authorization_pending",
    });
  });

  it("requires a verified matching email, server-resolved account, and consent", async () => {
    const f = await start();
    for (const wrong of [
      { ...identity, verifiedEmails: ["bob@example.com"] },
      { ...identity, verifiedEmails: [] },
      { ...identity, accountId: "00000000-0000-4000-8000-000000000002", subject: "did:privy:bob" },
    ]) {
      if (wrong.verifiedEmails.includes("alice@example.com")) {
        await expect(
          f.service.decide(
            f.attempt,
            {
              csrf: f.consent.csrf,
              decision: "approve",
              user_code: f.registration.claim.user_code,
            },
            wrong,
          ),
        ).rejects.toThrow();
      } else {
        await expect(f.service.load(f.attempt, wrong)).rejects.toMatchObject({
          error: "account_mismatch",
        });
      }
    }
    await expect(
      f.service.decide(f.attempt, { csrf: f.consent.csrf, decision: "approve" }, identity),
    ).rejects.toThrow();
    await approve(f);
    const token = await f.service.poll(f.registration.claim_token, {});
    expect(token).not.toHaveProperty("refresh_token");
    expect(token).toMatchObject({ token_type: "Bearer", scope: "mcp:read", expires_in: 300 });
    expect(await resolveOAuthAccess(f, token.access_token)).toMatchObject({
      accountId: identity.accountId,
      context: "personal",
      scopes: ["mcp:read"],
    });
  });

  it("locks a ceremony after five wrong codes, including concurrent guesses", async () => {
    const f = await start();
    const wrong = f.registration.claim.user_code === "000000" ? "111111" : "000000";
    await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        f.service.decide(
          f.attempt,
          { csrf: f.consent.csrf, decision: "approve", user_code: wrong },
          identity,
        ),
      ),
    );
    await expect(approve(f)).rejects.toThrow();
    await expect(f.service.poll(f.registration.claim_token, {})).rejects.toMatchObject({
      error: "access_denied",
    });
  });

  it("permits only one simultaneous approval and never widens its grant", async () => {
    const f = await start();
    const results = await Promise.allSettled([approve(f), approve(f)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      f.service.poll(f.registration.claim_token, { scope: "mcp:tools" }),
    ).rejects.toMatchObject({ error: "invalid_scope" });
    await expect(
      f.service.poll(f.registration.claim_token, { resource: "https://attacker.example/mcp" }),
    ).rejects.toMatchObject({ error: "invalid_target" });
    expect([...f.records.values()].filter(r => r.model === "Grant")).toHaveLength(1);
  });

  it("enforces polling backoff across concurrent polls", async () => {
    const f = await start();
    const results = await Promise.allSettled([
      f.service.poll(f.registration.claim_token, {}),
      f.service.poll(f.registration.claim_token, {}),
    ]);
    expect(results.map(r => r.status === "rejected" && r.reason.error).sort()).toEqual([
      "authorization_pending",
      "slow_down",
    ]);
    f.tick(5);
    await expect(f.service.poll(f.registration.claim_token, {})).rejects.toMatchObject({
      error: "slow_down",
    });
    f.tick(15);
    await expect(f.service.poll(f.registration.claim_token, {})).rejects.toMatchObject({
      error: "authorization_pending",
    });
  });

  it("expires pending ceremonies and retains explicit denial", async () => {
    const expired = await start();
    expired.tick(601);
    await expect(approve(expired)).rejects.toThrow();
    await expect(expired.service.poll(expired.registration.claim_token, {})).rejects.toMatchObject({
      error: "expired_token",
    });
    const denied = await start();
    await denied.service.decide(
      denied.attempt,
      { csrf: denied.consent.csrf, decision: "deny" },
      identity,
    );
    await expect(denied.service.poll(denied.registration.claim_token, {})).rejects.toMatchObject({
      error: "access_denied",
    });
    await expect(approve(denied)).rejects.toThrow();
  });

  it("exchanges signed assertions only for the approved resource and fixed deadline", async () => {
    const f = await start();
    await approve(f);
    const first = await f.service.poll(f.registration.claim_token, {});
    const claims = decodeJwt(first.identity_assertion);
    expect(claims).toMatchObject({
      iss: f.config.issuer,
      aud: f.config.issuer,
      sub: f.registration.registration_id,
    });
    const second = await f.service.exchange(first.identity_assertion, {
      resource: f.config.resource,
    });
    expect(second.scope).toBe("mcp:read");
    await expect(
      f.service.exchange(`${first.identity_assertion.slice(0, -12)}invalid`, {}),
    ).rejects.toMatchObject({ error: "invalid_grant" });
    f.tick(3601);
    await expect(f.service.exchange(first.identity_assertion, {})).rejects.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("rejects signed assertions with another issuer, audience, type, scope, or future authentication time", async () => {
    const f = await start();
    await approve(f);
    const token = await f.service.poll(f.registration.claim_token, {});
    const claims = decodeJwt(token.identity_assertion);
    const signingKey = f.config.jwks!.keys[0] as JWK;
    const key = await importJWK(signingKey, "RS256");
    for (const change of [
      { iss: "https://attacker.example" },
      { aud: "https://other.example" },
      { scope: "mcp:tools" },
      { client_id: "other" },
      { iat: claims.iat! + 300 },
      { exp: claims.iat! - 1 },
      { sub: `reg_${"a".repeat(43)}` },
    ]) {
      const assertion = await new SignJWT({ ...claims, ...change })
        .setProtectedHeader({ alg: "RS256", kid: signingKey.kid, typ: "oauth-id-jag+jwt" })
        .sign(key);
      await expect(f.service.exchange(assertion, {})).rejects.toMatchObject({
        error: "invalid_grant",
      });
    }
    const wrongType = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: signingKey.kid, typ: "JWT" })
      .sign(key);
    await expect(f.service.exchange(wrongType, {})).rejects.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("revokes individual access tokens and disconnects the entire registration", async () => {
    const f = await start();
    await approve(f);
    const token = await f.service.poll(f.registration.claim_token, {});
    await f.service.revokeToken(token.access_token);
    await f.service.revokeToken(token.access_token);
    await f.service.revokeToken("unknown");
    expect(await resolveOAuthAccess(f, token.access_token)).toBeUndefined();
    const replacement = await f.service.exchange(token.identity_assertion, {});
    const connections = createOAuthConnections(f.config, f.store, f.adapter);
    const list = await connections.list(identity.accountId);
    expect(list.connections).toHaveLength(1);
    await connections.revoke(identity.accountId, list.connections[0].id);
    expect(await resolveOAuthAccess(f, replacement.access_token)).toBeUndefined();
    await expect(f.service.exchange(token.identity_assertion, {})).rejects.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("rejects deleted accounts and never accepts extra registration permissions", async () => {
    const f = await start();
    await approve(f);
    f.deleteAccount();
    await expect(f.service.poll(f.registration.claim_token, {})).rejects.toMatchObject({
      error: "invalid_grant",
    });
    await expect(f.service.create("not-an-email")).rejects.toThrow();
  });
});
