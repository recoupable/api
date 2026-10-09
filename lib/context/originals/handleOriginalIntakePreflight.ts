import { NextResponse } from "next/server";
import { getOriginalIntakeHeaders } from "./getOriginalIntakeHeaders";

/** Advertise the disabled pilot contract without reading bodies or authorizing operations. */
export function handleOriginalIntakePreflight(request: Request) {
  const headers = getOriginalIntakeHeaders();
  if (process.env.CONTEXT_ORIGINAL_INTAKE_ENABLED !== "true")
    return new NextResponse(null, { status: 503, headers });
  if (!["GET", "POST"].includes(request.headers.get("access-control-request-method") ?? ""))
    return new NextResponse(null, { status: 405, headers });
  const allowed = new Set(
    headers["Access-Control-Allow-Headers"]
      .toLowerCase()
      .split(",")
      .map(value => value.trim()),
  );
  const requested =
    request.headers
      .get("access-control-request-headers")
      ?.split(",")
      .map(value => value.trim().toLowerCase()) ?? [];
  if (requested.some(value => !allowed.has(value)))
    return new NextResponse(null, { status: 400, headers });
  return new NextResponse(null, { status: 204, headers });
}
