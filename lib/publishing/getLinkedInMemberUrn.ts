import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

/**
 * The connected member's person URN.
 *
 * @param connection - LinkedIn connected account id.
 * @returns `urn:li:person:<id>`.
 */
export async function getLinkedInMemberUrn(connection: string): Promise<string> {
  const me = await proxyLinkedIn(connection, "GET", "https://api.linkedin.com/v2/userinfo");
  if (typeof me.data.sub !== "string")
    throw new Error("LinkedIn member id not found on the connection");
  return `urn:li:person:${me.data.sub}`;
}
