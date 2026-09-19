import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processSiteOperation } from "./processSiteOperation";
import type { SiteOperation } from "./siteOperationSchemas";
import { SiteError } from "./SiteError";
/** HTTP adapter; authorization and all domain changes are shared with MCP. */
export async function siteOperationHandler(
  request: NextRequest,
  operation: SiteOperation,
  input: unknown,
) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await processSiteOperation(auth.accountId, operation, input);
    return NextResponse.json(result, {
      status: operation === "create" ? 201 : 200,
      headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? "Invalid site input"
            : error instanceof SiteError
              ? error.message
              : "Could not finish this action. Your saved site is unchanged; please try again.",
      },
      {
        status: error instanceof ZodError ? 400 : error instanceof SiteError ? error.status : 503,
        headers: getCorsHeaders(),
      },
    );
  }
}
