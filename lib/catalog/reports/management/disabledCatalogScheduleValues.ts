import { z } from "zod";

/** Exact offline SQL grammar; timezone existence remains PostgreSQL's decision. */
export const disabledCatalogScheduleValues = {
  uuid: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\s\S])/),
  revision: z.number().int().min(1).max(2147483647),
  schedule: z.string().regex(/^([0-9]|[1-5][0-9]) ([0-9]|1[0-9]|2[0-3]) \* \* [0-6](?![\s\S])/),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .regex(/^(UTC|[A-Za-z_]+\/[A-Za-z_]+(\/[A-Za-z_]+)?)(?![\s\S])/),
};
