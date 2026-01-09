import { z } from "zod";

export const sendEmailSchema = z.object({
  to: z.array(z.email()).describe("Recipient email address or array of addresses"),
  cc: z
    .array(z.email())
    .describe(
      "Optional array of CC email addresses. active_account_email should always be included unless already in 'to'.",
    )
    .default([])
    .optional(),
  subject: z.string().describe("Email subject line"),
  text: z
    .string()
    .describe("Plain text body of the email. Use context to make this creative and engaging.")
    .optional(),
  html: z
    .string()
    .describe("HTML body of the email. Use context to make this creative and engaging.")
    .default("")
    .optional(),
  headers: z
    .record(z.string(), z.string())
    .describe("Optional custom headers for the email")
    .default({})
    .optional(),
  room_id: z
    .string()
    .describe(
      "Room ID to include in the email footer link. Use the active_conversation_id from context.",
    ),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
