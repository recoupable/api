import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { purgeGuestWorkflow } from "@/app/workflows/contextGuest/purgeGuestWorkflow";
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.CONTEXT_GUEST_ENABLED !== "true") return NextResponse.json({ skipped: true });
  await start(purgeGuestWorkflow, []);
  return NextResponse.json({ started: true });
}
