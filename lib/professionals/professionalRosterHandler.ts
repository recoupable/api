import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { confirmProfessionalSchema, listProfessionalsSchema } from "./schema";
import { processProfessionalRoster } from "./processProfessionalRoster";
import { ProfessionalRosterError } from "./ProfessionalRosterError";

/** Authenticate every read/write; the RPC rechecks membership inside its transaction. */
export async function professionalRosterHandler(request: NextRequest) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const action = request.method === "GET" ? "list" : "confirm";
    const raw =
      action === "list"
        ? Object.fromEntries(request.nextUrl.searchParams)
        : await safeParseJson(request);
    const input =
      action === "list" ? listProfessionalsSchema.parse(raw) : confirmProfessionalSchema.parse(raw);
    const auth = await validateAuthContext(request, { organizationId: input.organization_id });
    if (auth instanceof NextResponse) return auth;
    const result = await processProfessionalRoster(auth.accountId, action, input);
    return NextResponse.json(result, {
      status: "created" in result && result.created ? 201 : 200,
      headers,
    });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof ProfessionalRosterError
          ? error.status
          : 503;
    const message =
      error instanceof z.ZodError
        ? "Invalid professional roster request"
        : error instanceof ProfessionalRosterError
          ? error.message
          : "Could not access the professional roster";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
