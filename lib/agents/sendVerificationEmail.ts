import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

/**
 * Sends a 6-digit verification code to the given email address.
 *
 * @param email - The recipient email address
 * @param code - The 6-digit verification code
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const result = await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to: email,
    subject: "Your Recoup verification code",
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 24 hours.</p>`,
  });

  if (result instanceof Response) {
    throw new Error("Failed to send verification email");
  }
}
