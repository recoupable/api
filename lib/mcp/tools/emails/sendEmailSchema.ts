import { z } from "zod";

export const sendEmailSchema = z.object({
  to: z
    .array(z.string().email())
    .min(1, "At least one recipient is required")
    .describe("Array of recipient email addresses"),
  subject: z.string().min(1, "Subject cannot be empty").describe("Email subject line"),
  body: z.string().min(1, "Body cannot be empty").describe("Email body content (can include HTML)"),
  room_id: z.string().optional().describe("Optional room ID to include in the email footer link"),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
