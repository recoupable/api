import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/emails/client";
import { CreateEmailOptions, CreateEmailRequestOptions } from "resend";

/**
 * Sends an email via Resend using a shared client.
 * Returns a NextResponse on error, or the Resend data object on success.
 *
 * @param payload - The email payload to send via Resend.
 * @param options - The options to pass to the Resend API.
 * @returns A NextResponse on error, or an object containing the Resend data on success.
 */
export async function sendEmailWithResend(
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions,
): Promise<NextResponse | { data: unknown }> {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send(payload, options);

  if (error) {
    console.error("Error sending email via Resend:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error,
      },
      { status: 502 },
    );
  }

  return { data };
}
