import { createPrivateKey, sign as cryptoSign } from "node:crypto";

/** Apple caps developer tokens at six months; an hour is ample and cheap to re-mint. */
const TOKEN_TTL_SECONDS = 3600;

/** Re-mint this far ahead of expiry so an in-flight request never carries a dead token. */
const REFRESH_MARGIN_SECONDS = 300;

let cached: { token: string; expiresAt: number } | null = null;

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Normalizes a PEM that lost its real line breaks in transit.
 *
 * A `.p8` routed through a shell, a CI secret store, or a JSON blob commonly
 * arrives with literal `\n` and sometimes wrapping quotes. `createPrivateKey`
 * rejects both, and the resulting 500 gives no hint why, so accept either form.
 */
function normalizePem(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

/**
 * Mints (and caches) an Apple Music API developer token.
 *
 * Apple authenticates with a self-signed ES256 JWT rather than a
 * client-credentials exchange, so this does not follow the Spotify
 * `generateAccessToken` pattern. Two details Apple rejects with a bare 401 and
 * no error body when wrong: the signature must be raw R||S (IEEE P1363) rather
 * than Node's default DER, and the key id belongs in the JWT header while the
 * team id is the issuer.
 *
 * Reads `APPLE_MUSIC_PRIVATE_KEY` (the PEM body itself — Vercel has no
 * filesystem to read a `.p8` from), `APPLE_MUSIC_KEY_ID`, and
 * `APPLE_MUSIC_TEAM_ID`.
 *
 * @returns A signed developer token, reused until it nears expiry.
 * @throws If any of the three credentials is missing.
 */
export function generateDeveloperToken(): string {
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) {
    return cached.token;
  }

  const privateKey = createPrivateKey(normalizePem(requireEnv("APPLE_MUSIC_PRIVATE_KEY")));
  const keyId = requireEnv("APPLE_MUSIC_KEY_ID");
  const teamId = requireEnv("APPLE_MUSIC_TEAM_ID");
  const expiresAt = now + TOKEN_TTL_SECONDS;

  const signingInput = [
    base64url(JSON.stringify({ alg: "ES256", kid: keyId })),
    base64url(JSON.stringify({ iss: teamId, iat: now, exp: expiresAt })),
  ].join(".");

  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const token = `${signingInput}.${base64url(signature)}`;
  cached = { token, expiresAt };

  return token;
}
