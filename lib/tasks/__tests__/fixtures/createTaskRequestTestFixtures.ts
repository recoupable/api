export const ACCOUNT_A = "123e4567-e89b-12d3-a456-426614174000";
export const ACCOUNT_B = "223e4567-e89b-12d3-a456-426614174000";
export const ARTIST_ID = "323e4567-e89b-12d3-a456-426614174000";

/**
 * Valid Create Body.
 *
 * @param overrides - Optional override values.
 * @returns - Computed result.
 */
export function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Daily report",
    prompt: "Summarize fans",
    schedule: "0 9 * * *",
    artist_account_id: ARTIST_ID,
    ...overrides,
  };
}

export const authOk = {
  accountId: ACCOUNT_A,
  orgId: null as string | null,
  authToken: "token",
};
