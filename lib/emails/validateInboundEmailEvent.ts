import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const resendAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  content_disposition: z.string(),
  content_id: z.string(),
});

const resendEmailDataSchema = z.object({
  email_id: z.string(),
  created_at: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  bcc: z.array(z.string()),
  cc: z.array(z.string()),
  message_id: z.string(),
  subject: z.string(),
  attachments: z.array(resendAttachmentSchema),
});

export const resendEmailReceivedEventSchema = z.object({
  type: z.literal("email.received"),
  created_at: z.string(),
  data: resendEmailDataSchema,
});

export type ResendEmailReceivedEvent = z.infer<typeof resendEmailReceivedEventSchema>;

/**
 * Validates the inbound Resend email webhook event against the expected schema.
 *
 * @param body - The parsed JSON body of the inbound request.
 * @returns A NextResponse with an error if validation fails, or the validated event if validation passes.
 */
export function validateInboundEmailEvent(body: unknown): NextResponse | ResendEmailReceivedEvent {
  const validationResult = resendEmailReceivedEventSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid inbound email event",
        errors: validationResult.error.issues.map(err => ({
          field: err.path.join("."),
          message: err.message,
        })),
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
