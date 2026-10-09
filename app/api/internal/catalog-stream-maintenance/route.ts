import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { catalogStreamsMaintenanceWorkflow } from "@/app/workflows/catalogStreamsMaintenanceWorkflow";
/**
 * Cron-only dispatch for opted-in daily catalog streams.
 *
 * @param request - Incoming authenticated request.
 * @returns The catalog response or an authentication/validation error.
 */
export async function GET(request: NextRequest) {
  const denied = validateCronRequest(request);
  if (denied) return denied;
  if (
    !process.env.LUMINATE_API_KEY ||
    !process.env.LUMINATE_USERNAME ||
    !process.env.LUMINATE_PASSWORD
  )
    return NextResponse.json({ error: "Luminate is not configured" }, { status: 503 });
  try {
    const run = await start(catalogStreamsMaintenanceWorkflow);
    return NextResponse.json({ status: "success", workflow_run_id: run.runId }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Catalog stream dispatch unavailable" }, { status: 503 });
  }
}
