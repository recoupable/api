import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const executeConnectorActionBodySchema = z.object({
  actionSlug: z
    .string({ message: "actionSlug is required" })
    .min(
      1,
      "actionSlug cannot be empty (e.g., 'GMAIL_FETCH_EMAILS', 'GOOGLESHEETS_WRITE_SPREADSHEET')",
    ),
  parameters: z.record(z.string(), z.unknown(), { message: "parameters is required" }),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type ExecuteConnectorActionBody = z.infer<typeof executeConnectorActionBodySchema>;

/**
 * Validates request body for POST /api/connectors/actions.
 *
 * Body shape: { actionSlug, parameters, account_id? }.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateExecuteConnectorActionBody(
  body: unknown,
): NextResponse | ExecuteConnectorActionBody {
  const result = executeConnectorActionBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
