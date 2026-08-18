import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync, createPublicKey, verify as cryptoVerify } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const decode = (segment: string) => JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));

/** Fresh module instance so the module-scope token cache starts empty. */
const loadFresh = async () => {
  vi.resetModules();
  return (await import("../generateDeveloperToken")).generateDeveloperToken;
};

describe("generateDeveloperToken", () => {
  beforeEach(() => {
    process.env.APPLE_MUSIC_PRIVATE_KEY = privateKey;
    process.env.APPLE_MUSIC_KEY_ID = "TESTKEYID1";
    process.env.APPLE_MUSIC_TEAM_ID = "TESTTEAM01";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.APPLE_MUSIC_PRIVATE_KEY;
    delete process.env.APPLE_MUSIC_KEY_ID;
    delete process.env.APPLE_MUSIC_TEAM_ID;
  });

  it("builds a three-segment JWT with ES256 and the configured key id in the header", async () => {
    const generateDeveloperToken = await loadFresh();

    const token = generateDeveloperToken();
    const segments = token.split(".");

    expect(segments).toHaveLength(3);
    expect(decode(segments[0])).toEqual({ alg: "ES256", kid: "TESTKEYID1" });
  });

  it("issues the token to the team id with an expiry roughly one hour out", async () => {
    const generateDeveloperToken = await loadFresh();

    const payload = decode(generateDeveloperToken().split(".")[1]);
    const now = Math.floor(Date.now() / 1000);

    expect(payload.iss).toBe("TESTTEAM01");
    expect(payload.iat).toBeLessThanOrEqual(now);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  // Apple rejects a DER-encoded signature with a bare 401 and no error body.
  it("signs with raw R||S (IEEE P1363), not DER", async () => {
    const generateDeveloperToken = await loadFresh();

    const [header, payload, signature] = generateDeveloperToken().split(".");
    const raw = Buffer.from(signature, "base64url");

    expect(raw).toHaveLength(64);
    expect(
      cryptoVerify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: createPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
        raw,
      ),
    ).toBe(true);
  });

  it("caches the token across calls inside the validity window", async () => {
    const generateDeveloperToken = await loadFresh();

    expect(generateDeveloperToken()).toBe(generateDeveloperToken());
  });

  it("mints a new token once the cached one is within five minutes of expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T00:00:00Z"));
    const generateDeveloperToken = await loadFresh();

    const first = generateDeveloperToken();
    vi.setSystemTime(new Date("2026-08-17T00:56:00Z"));

    expect(generateDeveloperToken()).not.toBe(first);
  });

  it("throws a named error when a credential is missing", async () => {
    delete process.env.APPLE_MUSIC_TEAM_ID;
    const generateDeveloperToken = await loadFresh();

    expect(() => generateDeveloperToken()).toThrow(/APPLE_MUSIC_TEAM_ID/);
  });

  // A .p8 pasted through a shell, a CI secret store, or a JSON blob often arrives
  // with literal backslash-n instead of real line breaks. createPrivateKey rejects
  // that, and the resulting 500 says nothing about why.
  it("accepts a private key whose newlines arrived escaped", async () => {
    process.env.APPLE_MUSIC_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
    const generateDeveloperToken = await loadFresh();

    const [header, payload, signature] = generateDeveloperToken().split(".");

    expect(decode(header).alg).toBe("ES256");
    expect(
      cryptoVerify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: createPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
  });

  it("tolerates a key wrapped in quotes by a copy-paste", async () => {
    process.env.APPLE_MUSIC_PRIVATE_KEY = `"${privateKey}"`;
    const generateDeveloperToken = await loadFresh();

    expect(() => generateDeveloperToken()).not.toThrow();
  });
});
