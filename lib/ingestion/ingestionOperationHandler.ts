import { NextRequest, NextResponse } from "next/server";
import { getIngestionFailure } from "./getIngestionFailure";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createIngestionDependencies } from "./createIngestionDependencies";
import { dispatchIngestionJob } from "./dispatchIngestionJob";
import { processIngestionOperation } from "./processIngestionOperation";
import { readIngestionRequestBody } from "./readIngestionRequestBody";
import { readIngestionQuery } from "./readIngestionQuery";

/** Authenticated, bounded and uncached JSON transport for private ingestion operations. */
export async function ingestionOperationHandler(request: NextRequest) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  if (process.env.INGESTION_ENABLED !== "true")
    return NextResponse.json({ error: "Ingestion unavailable" }, { status: 404, headers });
  const auth = await validateAuthContext(request, { allowAccountCreation: false });
  if (auth instanceof NextResponse) {
    auth.headers.set("Cache-Control", "private, no-store");
    return auth;
  }
  try {
    const input =
      request.method === "GET"
        ? readIngestionQuery(request.url)
        : await readIngestionRequestBody(request);
    const result = await processIngestionOperation(
      auth.accountId,
      input,
      createIngestionDependencies(dispatchIngestionJob),
    );
    return NextResponse.json(result, {
      status:
        typeof input === "object" &&
        input !== null &&
        "action" in input &&
        input.action === "create"
          ? 202
          : 200,
      headers,
    });
  } catch (error) {
    const failure = getIngestionFailure(error);
    console.error("[ingestion] operation failed", { reason: failure.reason });
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers });
  }
}
