const knownCodes = new Set([
  "access_denied",
  "invalid_client",
  "invalid_client_metadata",
  "invalid_grant",
  "invalid_redirect_uri",
  "invalid_request",
  "invalid_scope",
  "invalid_target",
  "login_required",
  "consent_required",
  "unauthorized_client",
  "unsupported_grant_type",
  "unsupported_response_type",
  "server_error",
]);

/** Reduce a provider error to a standard, nonsecret OAuth error code for diagnostics. */
export function getOAuthErrorCode(error: unknown): string {
  const code = (error as { error?: unknown } | undefined)?.error;
  return typeof code === "string" && knownCodes.has(code) ? code : "other";
}
