import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const scopeSchema = z
  .object({
    catalog_id: z.string().uuid("scope.catalog_id must be a valid UUID").optional(),
    album_ids: z.array(z.string()).min(1).optional(),
    isrcs: z.array(z.string()).min(1).optional(),
  })
  .refine(s => [s.catalog_id, s.album_ids, s.isrcs].filter(Boolean).length === 1, {
    message: "Provide exactly one of scope.catalog_id, scope.album_ids, scope.isrcs",
  });

export const createMeasurementJobBodySchema = z.object({
  scope: scopeSchema,
  source: z.enum(["current", "historical"], { message: "source must be current or historical" }),
  platforms: z.array(z.enum(["spotify"])).default(["spotify"]),
});

export type CreateMeasurementJobBody = z.infer<typeof createMeasurementJobBodySchema>;

export type ValidatedCreateMeasurementJobRequest = {
  accountId: string;
  body: CreateMeasurementJobBody;
};

/**
 * Validates `POST /api/research/measurement-jobs` — auth + body: a `scope`
 * (exactly one of `catalog_id` / `album_ids` / `isrcs`) and a `source`
 * (`current` = Apify capture, `historical` = Songstats backfill).
 *
 * @param request - The incoming HTTP request.
 */
export async function validateCreateMeasurementJobRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateMeasurementJobRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const raw = await request.json().catch(() => null);
  const result = createMeasurementJobBodySchema.safeParse(raw);
  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  return { accountId: authResult.accountId, body: result.data };
}
