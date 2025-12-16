import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is not configured");
}

/**
 * Returns a configured Resend client instance using the RESEND_API_KEY
 * environment variable. Logs an error and returns null if the key
 * is not configured.
 *
 * @returns Resend client instance or null if not configured
 */
export function getResendClient(): Resend {
  return new Resend(apiKey);
}
