import { Resend } from "resend";

/**
 * Returns a configured Resend client instance using the RESEND_API_KEY
 * environment variable. Throws an error if the key
 * is not configured.
 *
 * @returns Resend client instance
 */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}
