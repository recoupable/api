import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateContentBody } from "@/lib/content/validateCreateContentBody";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Handler for POST /api/content/create.
 * Always returns runIds array (KISS — one response shape for single and batch).
 *
 * @param request
 */
export async function createContentHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateContentBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    // Best-effort readiness check. The task has its own submodule-aware file
    // discovery that works even when the API-level check can't find files
    // (e.g., artists in org submodule repos).
    let githubRepo: string;
    try {
      const readiness = await getArtistContentReadiness({
        accountId: validated.accountId,
        artistAccountId: validated.artistAccountId,
        artistSlug: validated.artistSlug,
      });
      githubRepo = readiness.githubRepo;
    } catch {
      // If readiness check fails, still try to resolve the repo
      const snapshots = await selectAccountSnapshots(validated.accountId);
      const repo = snapshots?.[0]?.github_repo;
      if (!repo) {
        return NextResponse.json(
          { status: "error", error: "No GitHub repository found for this account" },
          { status: 400, headers: getCorsHeaders() },
        );
      }
      githubRepo = repo;
    }

    const payload = {
      accountId: validated.accountId,
      artistSlug: validated.artistSlug,
      template: validated.template,
      lipsync: validated.lipsync,
      captionLength: validated.captionLength,
      upscale: validated.upscale,
      githubRepo,
      songs: validated.songs,
      ...(validated.images && validated.images.length > 0 && { images: validated.images }),
    };

    // Always use allSettled — works for single and batch.
    const count = validated.batch;
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => triggerCreateContent(payload)),
    );
    const runIds = results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<{ id: string }>).value.id);
    const failedCount = results.filter(r => r.status === "rejected").length;

    return NextResponse.json(
      {
        runIds,
        status: "triggered",
        artist_account_id: validated.artistAccountId,
        template: validated.template,
        lipsync: validated.lipsync,
        ...(failedCount > 0 && { failed: failedCount }),
      },
      { status: 202, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Failed to trigger content creation:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to trigger content creation",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
