import { generateImage } from "ai";
import { generateSiteVideo } from "@/lib/higgsfield/generateSiteVideo";
import { resolveAssetPlan } from "./resolveAssetPlan";
import type { CreativeDirection } from "../production/schema";
/** Execute only the director's validated choice. No silent model substitution. */
export async function generateSiteMedia(
  asset: CreativeDirection["assets"][number],
  references: string[],
  feedback = "",
  onAccepted?: (request: {
    request_id: string;
    status_url: string;
    status: string;
  }) => void | Promise<void>,
) {
  const plan = resolveAssetPlan(asset.production);
  const prompt = `${asset.prompt}\nPurpose: ${asset.purpose}. ${feedback ? `Revision: ${feedback}` : ""}\nProduction media for an interactive experience. No UI, buttons, watermarks or baked-in text. Match the supplied art direction. The interactive typography and controls are rendered separately.`;
  const started = Date.now();
  const provenance = { provider: plan.provider, model: plan.endpoint, rationale: plan.rationale };
  if (plan.model === "seedance-2.5") {
    const result = await generateSiteVideo(
      { prompt, aspectRatio: asset.aspectRatio, duration: plan.duration! },
      onAccepted,
    );
    return {
      url: result.url,
      type: "video" as const,
      estimatedUsd: result.usd,
      generation: { ...provenance, requestId: result.requestId, durationMs: Date.now() - started },
    };
  }
  if (plan.model === "nano-banana-pro") {
    const { default: fal } = await import("@/lib/fal/server");
    const model = references.length ? `${plan.endpoint}/edit` : plan.endpoint;
    const result = await fal.subscribe(model, {
      input: {
        prompt,
        num_images: 1,
        resolution: "2K",
        output_format: "webp",
        aspect_ratio: asset.aspectRatio,
        ...(references.length ? { image_urls: references.slice(0, 3) } : {}),
      },
    });
    const url = (result.data as { images?: { url: string }[] }).images?.[0]?.url;
    if (!url) throw new Error("Nano Banana Pro returned no image");
    return {
      url,
      type: "image" as const,
      estimatedUsd: 0.15,
      generation: {
        ...provenance,
        model,
        requestId: result.requestId,
        durationMs: Date.now() - started,
      },
    };
  }
  const result = await generateImage({
    model: plan.endpoint,
    prompt: references.length ? { text: prompt, images: references.slice(0, 3) } : prompt,
    size:
      asset.aspectRatio === "1:1"
        ? "1024x1024"
        : asset.aspectRatio === "9:16"
          ? "1024x1536"
          : "1536x1024",
    n: 1,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(240000),
    providerOptions: { openai: { quality: "high" } },
  });
  const requestId =
    result.responses[0]?.headers?.["x-request-id"] ?? `gateway-${crypto.randomUUID()}`;
  return {
    bytes: Buffer.from(result.image.uint8Array),
    type: "image" as const,
    usage: result.usage,
    generation: { ...provenance, requestId, durationMs: Date.now() - started },
  };
}
