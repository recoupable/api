import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createIngestionDependencies } from "./createIngestionDependencies";
import { dispatchIngestionJob } from "./dispatchIngestionJob";
import { processIngestionOperation } from "./processIngestionOperation";

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
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (!reader)
      return NextResponse.json({ error: "JSON body required" }, { status: 400, headers });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 3 * 1024 * 1024)
        return NextResponse.json({ error: "Request too large" }, { status: 413, headers });
      chunks.push(value);
    }
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }
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
    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? "Invalid ingestion arguments"
            : "Ingestion operation unavailable. Check scope, job state and configuration.",
      },
      { status: error instanceof ZodError ? 400 : 409, headers },
    );
  } finally {
    await reader?.cancel().catch(() => undefined);
  }
}
