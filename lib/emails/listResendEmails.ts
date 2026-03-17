import { getResendClient } from "@/lib/emails/client";

/**
 * Lists recent emails from Resend.
 *
 * @param limit - Maximum number of emails to return (1-100, default 100)
 * @returns Array of email objects or empty array on error
 */
export async function listResendEmails(limit = 100) {
  try {
    const resend = getResendClient();
    const { data } = await resend.emails.list({ limit });
    return data?.data ?? [];
  } catch {
    return [];
  }
}
