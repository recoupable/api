import { NextRequest, NextResponse } from "next/server";
import { getPackOperationError } from "./getPackOperationError";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import {
  processPackOperation,
  packOperationSchemas,
  type PackOperation,
} from "./processPackOperation";
/** HTTP-only parsing and authentication; MCP calls the exact same authenticated domain operations. */
export async function handlePackRequest(
  request: NextRequest,
  operation: PackOperation,
  jobId?: string,
) {
  try {
    const raw =
      request.method === "GET"
        ? Object.fromEntries(request.nextUrl.searchParams)
        : await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid request body");
    if (jobId && raw.job_id && raw.job_id !== jobId)
      throw new Error("Job id does not match request URL");
    const input = packOperationSchemas[operation].parse({
      ...raw,
      ...(jobId ? { job_id: jobId } : {}),
    });
    const auth = await validateAuthContext(request, { organizationId: input.organization_id });
    if (auth instanceof NextResponse) return auth;
    const result = await processPackOperation(auth.accountId, operation, input, auth.orgId);
    return NextResponse.json(result, { headers: getCorsHeaders() });
  } catch (error) {
    const failure = getPackOperationError(error);
    return NextResponse.json(failure.body, {
      status: failure.httpStatus,
      headers: getCorsHeaders(),
    });
  }
}
