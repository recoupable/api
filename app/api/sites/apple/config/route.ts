import { createPrivateKey, sign } from "node:crypto";
/**
 * Public MusicKit browser token. Signing credentials never leave the API.
 *
 * @returns Origin-bound browser token, or an unavailable status.
 */
export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://app.recoupable.dev",
  };
  const key = process.env.APPLE_MUSIC_PRIVATE_KEY;
  const kid = process.env.APPLE_MUSIC_KEY_ID;
  const iss = process.env.APPLE_MUSIC_TEAM_ID;
  if (!key || !kid || !iss) return Response.json({ configured: false }, { headers });
  try {
    const iat = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({ alg: "ES256", kid })}.${encode({ iss, iat, exp: iat + 600, origin: ["https://app.recoupable.dev"] })}`;
    const developerToken = `${input}.${sign("sha256", Buffer.from(input), {
      key: createPrivateKey(
        key
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\\n/g, "\n"),
      ),
      dsaEncoding: "ieee-p1363",
    }).toString("base64url")}`;
    return Response.json({ configured: true, developerToken }, { headers });
  } catch {
    return Response.json({ configured: false }, { headers, status: 503 });
  }
}
