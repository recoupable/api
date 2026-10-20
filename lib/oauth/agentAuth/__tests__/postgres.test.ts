import { expect, it } from "vitest";
import { createPostgresTestStore } from "../../../../scripts/mcp-oauth/fixtures/createPostgresTestStore";
import { fixture, identity } from "./fixture";
import { createOAuthConnections } from "../../createOAuthConnections";
import { resolveOAuthAccess } from "../../resolveOAuthAccess";

it.skipIf(!process.env.OAUTH_TEST_PG_SOCKET)(
  "claims once across processes and revokes every credential in PostgreSQL",
  async () => {
    const store = createPostgresTestStore();
    const first = fixture(43335, store);
    const second = fixture(43335, createPostgresTestStore());
    const registration = await first.service.create("alice@example.com");
    const attempt = new URL(registration.claim.verification_uri).searchParams.get(
      "claim_attempt_token",
    )!;
    const [consent1, consent2] = await Promise.all([
      first.service.load(attempt, identity),
      second.service.load(attempt, identity),
    ]);
    const approve = (csrf: string) => ({
      csrf,
      decision: "approve",
      user_code: registration.claim.user_code,
    });
    const claims = await Promise.allSettled([
      first.service.decide(attempt, approve(consent1.csrf), identity),
      second.service.decide(attempt, approve(consent2.csrf), identity),
    ]);
    expect(claims.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const token = await second.service.poll(registration.claim_token, {});
    expect(await resolveOAuthAccess(first, token.access_token)).toMatchObject({
      scopes: ["mcp:read"],
      accountId: identity.accountId,
    });
    const renewed = await first.service.exchange(token.identity_assertion, {});
    const connections = createOAuthConnections(second.config, store, second.adapter);
    const listed = await connections.list(identity.accountId);
    expect(listed.connections).toHaveLength(1);
    await connections.revoke(identity.accountId, listed.connections[0].id);
    expect(await resolveOAuthAccess(first, renewed.access_token)).toBeUndefined();
    await expect(first.service.exchange(token.identity_assertion, {})).rejects.toMatchObject({
      error: "invalid_grant",
    });
  },
);
