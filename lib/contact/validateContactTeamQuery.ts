import { z } from "zod";

export const contactTeamQuerySchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long")
    .describe("The message to send to the team"),
  active_account_email: z.string().optional().describe("The email of the active account"),
  active_conversation_id: z.string().optional().describe("The ID of the active conversation"),
  active_conversation_name: z.string().optional().describe("The name of the active conversation"),
});

export type ContactTeamQuery = z.infer<typeof contactTeamQuerySchema>;
