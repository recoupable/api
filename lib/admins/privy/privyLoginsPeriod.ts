import { z } from "zod";

export const privyLoginsPeriodSchema = z.enum(["all", "daily", "weekly", "monthly"]);

export type PrivyLoginsPeriod = z.infer<typeof privyLoginsPeriodSchema>;
