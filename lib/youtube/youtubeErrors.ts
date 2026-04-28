/**
 * Centralised error codes + messages for the YouTube token validation /
 * refresh flow. Kept in parity with chat's `lib/youtube/error-builder.ts`
 * messages so callers see identical strings.
 */
export const YouTubeErrorMessages = {
  NO_TOKENS: "No YouTube tokens found for this account. Please authenticate first.",
  EXPIRED_TOKENS_NO_REFRESH:
    "YouTube access token has expired, and no refresh token is available. Please re-authenticate.",
  FETCH_ERROR: "Failed to validate YouTube tokens. Please try again.",
  DB_UPDATE_FAILED: "Failed to save refreshed YouTube token to the database.",
  REFRESH_INCOMPLETE_CREDENTIALS:
    "Failed to refresh token: incomplete credentials received from Google.",
  REFRESH_GENERAL_FAILURE: "Failed to refresh YouTube token. Please try re-authenticating.",
  REFRESH_INVALID_GRANT:
    "YouTube refresh token is invalid or has been revoked. Please re-authenticate your YouTube account.",
} as const;

export type YouTubeUtilityErrorCode =
  | "NO_TOKENS"
  | "EXPIRED_NO_REFRESH"
  | "FETCH_ERROR"
  | "DB_UPDATE_FAILED"
  | "REFRESH_INCOMPLETE_CREDENTIALS"
  | "REFRESH_GENERAL_FAILURE"
  | "REFRESH_INVALID_GRANT";

export interface YouTubeUtilityError {
  success: false;
  error: {
    code: YouTubeUtilityErrorCode;
    message: string;
  };
}

/**
 * Builds the standard `{ success: false, error: { code, message } }` shape
 * used by token-validator / token-refresher.
 *
 * @param code - The error code.
 * @param message - The human-readable error message.
 * @returns A YouTubeUtilityError object.
 */
export function buildYouTubeUtilityError(
  code: YouTubeUtilityErrorCode,
  message: string,
): YouTubeUtilityError {
  return {
    success: false,
    error: { code, message },
  };
}
