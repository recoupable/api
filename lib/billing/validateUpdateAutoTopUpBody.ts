import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const MIN_AUTO_TOP_UP_CENTS = 500;
export const MAX_AUTO_TOP_UP_CENTS = 100000;

const bodySchema = z
  .object({
    enabled: z.boolean({ message: "enabled must be a boolean" }),
    amountCents: z
      .number({ message: "amountCents must be an integer" })
      .int("amountCents must be an integer")
      .min(MIN_AUTO_TOP_UP_CENTS, "amountCents must be between 500 and 100000")
      .max(MAX_AUTO_TOP_UP_CENTS, "amountCents must be between 500 and 100000"),
    thresholdCents: z
      .number({ message: "thresholdCents must be an integer" })
      .int("thresholdCents must be an integer")
      .min(0, "thresholdCents must be 0 or more"),
  })
  .strict()
  .refine(b => b.thresholdCents < b.amountCents, {
    message: "thresholdCents must be below amountCents",
    path: ["thresholdCents"],
  });

export type UpdateAutoTopUpBody = z.infer<typeof bodySchema>;

/**
 * Parses the PUT /api/accounts/{id}/auto-top-up body. All three fields are
 * required on every call (no partial update); the card-on-file rule for
 * `enabled: true` is checked by the handler, not here.
 */
export async function validateUpdateAutoTopUpBody(
  request: NextRequest,
): Promise<UpdateAutoTopUpBody | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message =
      issue.code === "invalid_type" &&
      issue.path.length > 0 &&
      issue.message.startsWith("Invalid input")
        ? `${issue.path.join(".")} is required`
        : issue.message;
    return NextResponse.json({ error: message }, { status: 400, headers: getCorsHeaders() });
  }

  return parsed.data;
}
