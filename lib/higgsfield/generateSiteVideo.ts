import { z } from "zod";

const acceptedSchema = z.object({
  request_id: z.string().min(1).max(200),
  status: z.string(),
  status_url: z.string().url(),
});
const resultSchema = z.object({
  status: z.enum(["queued", "in_progress", "completed", "failed", "nsfw", "canceled"]),
  video: z.object({ url: z.string().url() }).optional(),
});
export type HiggsfieldVideoRequest = {
  prompt: string;
  aspectRatio: "16:9" | "1:1" | "9:16";
  duration: number;
};

/** One paid submission, bounded polling. Never retry an ambiguous POST. */
export async function generateSiteVideo(
  input: HiggsfieldVideoRequest,
  onAccepted?: (request: z.infer<typeof acceptedSchema>) => void | Promise<void>,
) {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) throw new Error("Higgsfield is not configured");
  if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 6)
    throw new Error("Site video duration must be 4–6 seconds");
  const model = "bytedance/seedance-2.5/text-to-video";
  const headers = { Authorization: `Key ${credentials}`, "Content-Type": "application/json" };
  const response = await fetch(`https://api.higgsfield.ai/${model}`, {
    method: "POST",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      duration: input.duration,
      resolution: "720p",
      output_format: "mp4",
      generate_audio: false,
    }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    if (failure?.detail === "not_enough_credits")
      throw new Error(
        "Higgsfield API credits are empty. Fund the configured API account before generating site artwork.",
      );
    throw new Error(`Higgsfield submission failed (HTTP ${response.status}); not retried`);
  }
  const request = acceptedSchema.parse(await response.json());
  // Persist acceptance even if a provider changes its URL contract. Never lose a paid job ID.
  await onAccepted?.(request);
  const statusUrl = new URL(request.status_url);
  if (
    !["https://api.higgsfield.ai", "https://platform.higgsfield.ai"].includes(statusUrl.origin) ||
    statusUrl.username ||
    statusUrl.password ||
    statusUrl.search ||
    statusUrl.hash ||
    statusUrl.pathname !== `/requests/${encodeURIComponent(request.request_id)}/status`
  )
    throw new Error(
      `Higgsfield request ${request.request_id} returned unexpected status URL origin/path: ${statusUrl.origin}${statusUrl.pathname}; not resubmitted`,
    );

  const deadline = Date.now() + 600000;
  let delay = 1500;
  while (Date.now() < deadline) {
    const status = await fetch(statusUrl, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!status.ok)
      throw new Error(
        `Higgsfield request ${request.request_id} status unavailable (HTTP ${status.status}); not resubmitted`,
      );
    const result = resultSchema.parse(await status.json());
    if (result.status === "completed") {
      const url = result.video?.url;
      if (!url)
        throw new Error(`Higgsfield request ${request.request_id} completed without a video`);
      return { url, requestId: request.request_id, model, usd: input.duration * 0.3236 };
    }
    if (["failed", "nsfw", "canceled"].includes(result.status))
      throw new Error(`Higgsfield request ${request.request_id} ${result.status}; not resubmitted`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10000);
  }
  throw new Error(`Higgsfield request ${request.request_id} still pending; not resubmitted`);
}
