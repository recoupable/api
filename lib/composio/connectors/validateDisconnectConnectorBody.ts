import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const disconnectConnectorBodySchema = z.object({
  connected_account_id: z.string().min(1, "connected_account_id is required"),
});

export type DisconnectConnectorBody = z.infer<typeof disconnectConnectorBodySchema>;

/**
 * Validates request body for POST /api/connectors/disconnect.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateDisconnectConnectorBody(body: unknown): NextResponse | DisconnectConnectorBody {
  const result = disconnectConnectorBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
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
