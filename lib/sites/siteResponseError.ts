import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { SiteError } from "./SiteError";
export function siteResponseError(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof SiteError
          ? error.message
          : error instanceof ZodError
            ? "Invalid site input"
            : "Site temporarily unavailable",
    },
    {
      status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
      headers: getCorsHeaders(),
    },
  );
}
