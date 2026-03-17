import { getResendClient } from "@/lib/emails/client";
import type { ListEmail } from "resend";

/**
 * Lists recent emails from Resend.
 *
 * @param limit - Maximum number of emails to return (1-100, default 100)
 * @returns Array of ListEmail objects or empty array on error
 */
export async function listResendEmails(
  limit = 100,
): Promise<ListEmail[]> {
  try {
    const resend = getResendClient();
    const { data } = await resend.emails.list({ limit });
    return data?.data ?? [];
  } catch {
    return [];
  }
}
