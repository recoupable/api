import fal from "@/lib/fal/server";
import sharp from "sharp";
import type { Site, SiteAsset } from "../schema";
import type { CreativeDirection } from "./schema";
import { buildImageInput } from "@/lib/content/image/buildImageInput";
import { chargeForGeneration } from "@/lib/content/chargeForGeneration";
import { creditCostForImageUnits } from "@/lib/content/creditCostForImageUnits";
import { uploadSiteAsset } from "@/lib/supabase/storage/uploadSiteAsset";
import { requireCredits } from "./requireCredits";
/** Produce real assets, normalize them, and persist them under the workspace. */
export async function produceAssets(
  site: Site,
  direction: CreativeDirection,
  accountId: string,
  feedback = "",
): Promise<SiteAsset[]> {
  const assets: SiteAsset[] = [];
  for (const asset of direction.assets) {
    const prior = site.draft?.production?.direction.assets.find(
      a => a.name === asset.name && a.prompt === asset.prompt,
    );
    const reusable =
      prior &&
      !feedback &&
      site.draft?.assets.find(a => a.name === asset.name && a.type === "image");
    if (reusable) {
      assets.push(reusable);
      continue;
    }
    await requireCredits(accountId, creditCostForImageUnits(1));
    const { model, input } = buildImageInput({
      prompt: `${asset.prompt}\nRevision feedback: ${feedback}\nPurpose: ${asset.purpose}. Finished production artwork. No UI, buttons, watermarks, or lettering.`,
      image_urls: site.assets
        .filter(a => a.type === "image")
        .map(a => a.url)
        .slice(0, 3),
      num_images: 1,
      aspect_ratio: asset.aspectRatio,
      output_format: "webp",
      sync_mode: false,
    });
    const result = await fal.subscribe(model, { input });
    await chargeForGeneration({
      accountId,
      endpointId: model,
      requestId: result.requestId,
      fallbackUnits: 1,
      creditsForUnits: creditCostForImageUnits,
    });
    const url = (result.data as { images?: { url: string }[] }).images?.[0]?.url;
    if (!url) throw new Error("Asset production returned no image");
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !(
        parsed.hostname === "fal.media" ||
        parsed.hostname.endsWith(".fal.media") ||
        parsed.hostname.endsWith(".fal.ai")
      )
    )
      throw new Error("Unexpected generated image host");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok || Number(response.headers.get("content-length")) > 20000000)
      throw new Error("Could not retrieve generated asset");
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 20000000) throw new Error("Generated asset too large");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = await sharp(Buffer.concat(chunks), { limitInputPixels: 25000000 })
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const stored = await uploadSiteAsset(site.owner_id, bytes, "image/webp", "webp");
    assets.push({ name: asset.name, url: stored, type: "image" });
  }
  return assets;
}
