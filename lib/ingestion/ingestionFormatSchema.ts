import { z } from "zod";
export const ingestionFormatSchema = z.enum(["csv", "tsv", "json", "jsonl", "xlsx", "pdf"]);
