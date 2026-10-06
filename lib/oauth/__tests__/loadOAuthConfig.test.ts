import { generateKeyPairSync } from "node:crypto";
import { expect, it } from "vitest";
import { loadOAuthConfig } from "../loadOAuthConfig";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = Buffer.alloc(32, 1).toString("base64");
const environment = {
  OAUTH_ISSUER: "https://api.example.test/api/oauth",
  OAUTH_CONSENT_URL: "https://app.example.test/oauth/authorize",
  OAUTH_SIGNING_JWKS: JSON.stringify({
    keys: [{ ...privateKey.export({ format: "jwk" }), kid: "test", alg: "RS256", use: "sig" }],
  }),
  OAUTH_COOKIE_KEYS: JSON.stringify([Buffer.alloc(32, 2).toString("base64")]),
  OAUTH_INDEX_KEY: Buffer.alloc(32, 3).toString("base64"),
  OAUTH_ENCRYPTION_KEYS: JSON.stringify({ test: key }),
  OAUTH_ACTIVE_ENCRYPTION_KEY: "test",
};
it("loads only explicit stable secrets and canonical URLs", () => {
  const result = loadOAuthConfig(environment);
  expect(result.issuer).toBe(environment.OAUTH_ISSUER);
  expect(result.resource).toBe("https://api.example.test/mcp");
  expect(result.indexKey.length).toBe(32);
});
it.each([
  { OAUTH_ISSUER: "http://api.example.test/api/oauth" },
  { OAUTH_ISSUER: "https://api.example.test/api/oauth?evil=1" },
  { OAUTH_CONSENT_URL: "https://attacker@example.test/oauth/authorize" },
  { OAUTH_INDEX_KEY: "weak-key" },
  { OAUTH_COOKIE_KEYS: '["short"]' },
  { OAUTH_SIGNING_JWKS: '{"keys":[]}' },
  { OAUTH_ACTIVE_ENCRYPTION_KEY: "missing" },
  { OAUTH_INDEX_KEY: key },
])("fails closed on invalid configuration without printing secrets %j", overrides => {
  expect(() => loadOAuthConfig({ ...environment, ...overrides })).toThrow(
    /^Invalid OAuth configuration$/,
  );
});
