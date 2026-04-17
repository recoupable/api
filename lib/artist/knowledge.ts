import { z } from "zod";

export const knowledgeSchema = z.object({
  name: z.string(),
  url: z.string().url("knowledges.url must be a valid URL"),
  type: z.string(),
});

export type Knowledge = z.infer<typeof knowledgeSchema>;
