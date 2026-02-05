import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const disconnectConnectorBodySchema = z.object({
  connected_account_id: z.string().min(1, "connected_account_id is required"),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type DisconnectConnectorBody = z.infer<typeof disconnectConnectorBodySchema>;

/**
 * Validates request body for DELETE /api/connectors.
 *
 * - User disconnect: { connected_account_id: "ca_xxx" }
 * - Entity disconnect: { connected_account_id: "ca_xxx", account_id: "account-uuid" }
 *
 * When account_id is provided, verifies the connection belongs to that entity.
 * When not provided, verifies the connection belongs to the authenticated account.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateDisconnectConnectorBody(
  body: unknown,
): NextResponse | DisconnectConnectorBody {
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
