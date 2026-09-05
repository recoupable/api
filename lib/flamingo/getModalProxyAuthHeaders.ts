/**
 * Modal proxy-auth headers for the Music Flamingo web endpoints.
 *
 * Read from MODAL_PROXY_TOKEN_ID / MODAL_PROXY_TOKEN_SECRET (a proxy auth
 * token minted in the Modal workspace). Returns an empty object when either
 * is unset so environments without the token still reach an endpoint that
 * does not yet require proxy auth.
 */
export function getModalProxyAuthHeaders(): Record<string, string> {
  const id = process.env.MODAL_PROXY_TOKEN_ID;
  const secret = process.env.MODAL_PROXY_TOKEN_SECRET;
  if (!id || !secret) return {};
  return { "Modal-Key": id, "Modal-Secret": secret };
}
