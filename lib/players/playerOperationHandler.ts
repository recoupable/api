import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { ZodError } from "zod";
import { SiteError } from "@/lib/sites/SiteError";
import { processPlayerOperation } from "./processPlayerOperation";
import type { PlayerOperation } from "./operationSchemas";
export async function playerOperationHandler(
  request: NextRequest,
  operation: PlayerOperation,
  input: unknown,
) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await processPlayerOperation(auth.accountId, operation, input), {
      status: operation === "create" ? 201 : 200,
      headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SiteError
            ? error.message
            : error instanceof ZodError
              ? "Invalid player input"
              : "Player operation unavailable",
      },
      {
        status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
        headers: getCorsHeaders(),
      },
    );
  }
}
