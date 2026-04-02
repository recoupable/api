import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { triggerPrimitive } from "@/lib/trigger/triggerPrimitive";
import { validatePrimitiveBody } from "./validatePrimitiveBody";

/**
 * Creates a request handler for an async content primitive.
 * Validates body, triggers the Trigger.dev task, returns { runId, status }.
 *
 * @param taskId - Trigger.dev task identifier to run for this primitive.
 * @param schema - Zod schema used to parse and validate the JSON body.
 * @returns Async route function that accepts a NextRequest and returns a NextResponse.
 */
export function createPrimitiveHandler(taskId: string, schema: z.ZodSchema) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validated = await validatePrimitiveBody(request, schema);
    if (validated instanceof NextResponse) return validated;

    try {
      const handle = await triggerPrimitive(taskId, {
        ...(validated.data as Record<string, unknown>),
        accountId: validated.accountId,
      });

      return NextResponse.json(
        { runId: handle.id, status: "triggered" },
        { status: 202, headers: getCorsHeaders() },
      );
    } catch (error) {
      console.error(`Failed to trigger ${taskId}:`, error);
      return NextResponse.json(
        { status: "error", error: `Failed to trigger ${taskId}` },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  };
}
