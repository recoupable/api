import { ApifyClient } from "apify-client";
import { z } from "zod";
import { requireCredits } from "@/lib/sites/production/requireCredits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

/** Hosted retrieval only. The caller must independently verify the recording before saving it. */
export async function downloadHostedYoutubeAudio(
  videoId: string,
  accountId: string,
  siteId: string,
) {
  z.string()
    .regex(/^[A-Za-z0-9_-]{11}$/)
    .parse(videoId);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Hosted audio provider is not configured");
  // Apify rejects run limits below its $0.50 minimum. Actual usage is billed below.
  const maxCostUsd = 0.5;
  await requireCredits(accountId, usdToCredits(maxCostUsd));
  // Never retry an ambiguous paid start. No service credentials are sent to the audio sandbox.
  const client = new ApifyClient({ token, maxRetries: 0 });
  const run = await client.actor("streamers/youtube-video-downloader").call(
    {
      videos: [{ url: `https://www.youtube.com/watch?v=${videoId}` }],
      storeInKVStore: true,
      preferredQuality: "144p",
      preferredFormat: "mp3",
      filenameTemplateParts: [],
      transcriptionAndSubtitle: "NONE",
    },
    { timeout: 180, waitSecs: 200, maxTotalChargeUsd: maxCostUsd, restartOnError: false },
  );
  console.info("[sites:hosted-audio]", { videoId, runId: run.id, status: run.status });
  if (typeof run.usageTotalUsd === "number" && run.usageTotalUsd > 0) {
    const charged = await recordCreditDeduction({
      accountId,
      creditsToDeduct: usdToCredits(run.usageTotalUsd),
      source: "api",
      provider: "apify",
      modelId: "sites/youtube-audio",
      resourceUrl: `/sites/${siteId}`,
    });
    if (!charged.success) throw new Error("Audio provider billing requires reconciliation");
  }
  if (["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(run.status))
    throw new Error(`Audio provider run ${run.id} requires reconciliation`);
  if (run.status !== "SUCCEEDED") return null;
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 2 });
  const item = items.find(value => value.id === videoId);
  const output = z
    .object({ id: z.literal(videoId), downloadedFileUrl: z.string().url().nullable() })
    .safeParse(item);
  if (!output.success || !output.data.downloadedFileUrl) return null;
  const url = new URL(output.data.downloadedFileUrl);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.apify.com" ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/v2\/key-value-stores\/[A-Za-z0-9]+\/records\//.test(url.pathname)
  )
    throw new Error("Unexpected hosted audio storage URL");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 40000000)
    throw new Error("Hosted audio download unavailable or too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 40000000) throw new Error("Hosted audio exceeds size limit");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
