import { getResendClient } from "@/lib/emails/client";
import type { GetEmailResponseSuccess } from "resend";

/**
 * Fetches a single email from Resend by ID.
 *
 * @param emailId - The Resend email ID
 * @returns The full Resend email object or null if not found
 */
export async function fetchResendEmail(
  emailId: string,
): Promise<GetEmailResponseSuccess | null> {
  try {
    const resend = getResendClient();
    const { data } = await resend.emails.get(emailId);
    return data ?? null;
  } catch {
    return null;
  }
}
