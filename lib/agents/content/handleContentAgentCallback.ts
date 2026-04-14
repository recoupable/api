import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateContentAgentCallback } from "./validateContentAgentCallback";
import { getThread } from "@/lib/agents/getThread";
import { postVideoResults } from "./postVideoResults";
import type { ContentAgentThreadState } from "./types";

/**
 * Handles content agent task callback from Trigger.dev.
 * Verifies the shared secret and dispatches based on callback status.
 *
 * @param request - The incoming callback request
 * @returns A NextResponse
 */
export async function handleContentAgentCallback(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-callback-secret");
  const expectedSecret = process.env.CODING_AGENT_CALLBACK_SECRET;

  const secretBuf = secret ? Buffer.from(secret) : Buffer.alloc(0);
  const expectedBuf = expectedSecret ? Buffer.from(expectedSecret) : Buffer.alloc(0);

  if (
    !secret ||
    !expectedSecret ||
    secretBuf.length !== expectedBuf.length ||
    !timingSafeEqual(secretBuf, expectedBuf)
  ) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validateContentAgentCallback(body);

  if (validated instanceof NextResponse) {
    return validated;
  }

  const thread = getThread<ContentAgentThreadState>(validated.threadId);

  // Idempotency: skip if thread is no longer running (duplicate/retry delivery)
  const currentState = await thread.state;
  if (currentState?.status && currentState.status !== "running") {
    return NextResponse.json({ status: "ok", skipped: true }, { headers: getCorsHeaders() });
  }

  switch (validated.status) {
    case "completed": {
      const results = validated.results ?? [];
      const videos = results.filter(r => r.status === "completed" && r.videoUrl);
      const failed = results.filter(r => r.status === "failed");

      if (videos.length > 0) {
        await postVideoResults(thread, videos, failed.length);
      } else {
        await thread.post("Content generation finished but no videos were produced.");
      }

      // Persist generated URLs so thread replies can reference them for edits
      const videoUrls = videos.map(v => v.videoUrl).filter(Boolean) as string[];

      await thread.setState({
        status: "completed",
        ...(videoUrls.length > 0 && { videoUrls }),
      });
      break;
    }

    case "failed":
      await thread.setState({ status: "failed" });
      await thread.post(`Content generation failed: ${validated.message ?? "Unknown error"}`);
      break;

    case "timeout":
      await thread.setState({ status: "timeout" });
      await thread.post(
        "Content generation timed out after 30 minutes. The pipeline may still be running — check the Trigger.dev dashboard.",
      );
      break;
  }

  return NextResponse.json({ status: "ok" }, { headers: getCorsHeaders() });
}
