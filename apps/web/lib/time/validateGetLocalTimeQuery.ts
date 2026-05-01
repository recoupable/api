import { z } from "zod";

export const getLocalTimeQuerySchema = z.object({
  timezone: z
    .string()
    .describe(
      "Optional IANA timezone like 'America/New_York'. If omitted, server local timezone is used.",
    )
    .optional(),
});

export type GetLocalTimeQuery = z.infer<typeof getLocalTimeQuerySchema>;
