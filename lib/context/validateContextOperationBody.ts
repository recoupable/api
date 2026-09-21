import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { contextOperationSchema } from "./processContextOperation";
/** Strict input validation shared by the Context HTTP handler. */
export function validateContextOperationBody(body: unknown) {
  const parsed = contextOperationSchema.safeParse(body);
  return parsed.success
    ? parsed.data
    : NextResponse.json(
        { error: "Invalid context request", issues: parsed.error.issues },
        { status: 400, headers: getCorsHeaders() },
      );
}
