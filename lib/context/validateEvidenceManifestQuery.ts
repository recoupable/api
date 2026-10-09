import { NextResponse } from "next/server";
import { evidenceManifestOperationSchema } from "./evidenceManifestSchemas";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Strict retrieval parameters; repeated fields cannot choose a different scope or cursor. */
export function validateEvidenceManifestQuery(query: URLSearchParams) {
  const keys = [...query.keys()];
  const parsed = evidenceManifestOperationSchema
    .omit({ action: true })
    .safeParse(Object.fromEntries(query));
  return parsed.success && new Set(keys).size === keys.length
    ? parsed.data
    : NextResponse.json(
        { error: "Invalid evidence query" },
        {
          status: 400,
          headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" },
        },
      );
}
