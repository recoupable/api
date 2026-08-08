import { PrivyClient } from "@privy-io/node";

/**
 * Privy "Verify with key instead" value may be:
 * - Raw PEM (-----BEGIN ...-----) — paste as-is
 * - Base64 of that PEM — legacy / docs format
 * If unset, @privy-io/node fetches JWKS from Privy (works locally; slightly slower first verify).
 */
function resolveJwtVerificationKey(): string | undefined {
  const raw = process.env.PRIVY_JWT_VERIFICATION_KEY?.trim();
  if (!raw) return undefined;
  if (raw.includes("BEGIN")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.includes("BEGIN")) return decoded;
  } catch {
    /* ignore */
  }
  return raw;
}

const jwtVerificationKey = resolveJwtVerificationKey();

const privyClient = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_PROJECT_SECRET!,
  ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
});

export default privyClient;
