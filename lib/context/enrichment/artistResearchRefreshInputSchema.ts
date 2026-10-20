import { z } from "zod";
import { normalizedContextResearchSourceSchema } from "./artistResearchTypes";

const count = z.number().int().min(0);

/** Input to the artist-research refresh planner. Prior claims are not needed to decide reuse, so they are not read. */
export const artistResearchRefreshInputSchema = z.strictObject({
  artistSubjectId: z.string().trim().min(1).max(200),
  now: z.iso.datetime(),
  prior: z
    .object({
      resultId: z.string().min(1).max(200),
      version: z.number().int().min(1),
      retrievedAt: z.iso.datetime(),
      sourceUrls: z.array(z.string().min(1).max(2048)).max(100),
      withdrawn: z.boolean(),
    })
    .nullable(),
  search: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("ok"),
      calls: count.max(10),
      normalized: z.object({
        retrievedAt: z.iso.datetime(),
        sources: z.array(normalizedContextResearchSourceSchema).max(20),
        rejected: z.array(
          z.object({ url: z.string(), reason: z.enum(["invalid_url", "non_https"]) }),
        ),
        counts: z.object({
          candidates: count,
          rejected: count,
          underlyingSources: count,
          copiesCollapsed: count,
          truncated: count,
        }),
      }),
    }),
    z.object({ status: z.literal("failed"), calls: count.max(10), error: z.string().max(2000) }),
  ]),
  policy: z
    .object({
      maxAgeDays: z.number().int().min(1).max(3650).default(90),
      maxSources: z.number().int().min(1).max(20).default(20),
      maxSearchCalls: z.number().int().min(0).max(1).default(1),
      maxModelCalls: z.number().int().min(0).max(1).default(1),
    })
    .prefault({}),
});
