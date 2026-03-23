import { z } from "zod";

export const adminPeriodSchema = z.enum(["all", "daily", "weekly", "monthly"]);

export type AdminPeriod = z.infer<typeof adminPeriodSchema>;
