import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateContentAgentCallback } from "./validateContentAgentCallback";
import { getThread } from "./getThread";

/**
 * Handles content agent task callback body parsing and processing.
 * Auth (x-callback-secret) is verified by the route before this is called.
 *
 * @param request - The authenticated callback request
 * @returns A NextResponse
 */
export async function handleContentAgentCallback(request: Request): Promise<NextResponse> {
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

  const thread = getThread(validated.threadId);

  switch (validated.status) {
    case "completed": {
      const results = validated.results ?? [];
      const videos = results.filter(r => r.status === "completed" && r.videoUrl);
      const failed = results.filter(r => r.status === "failed");

      if (videos.length > 0) {
        const lines = videos.map((v, i) => {
          const label = videos.length > 1 ? `**Video ${i + 1}:** ` : "";
          const caption = v.captionText ? `\n> ${v.captionText}` : "";
          return `${label}${v.videoUrl}${caption}`;
        });

        if (failed.length > 0) {
          lines.push(`\n_${failed.length} run(s) failed._`);
        }

        await thread.post(lines.join("\n\n"));
      } else {
        await thread.post("Content generation finished but no videos were produced.");
      }

      await thread.setState({ status: "completed" });
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
