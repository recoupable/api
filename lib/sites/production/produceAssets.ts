import { getAssetFailure } from "./getAssetFailure";
import { generateSiteImage } from "@/lib/higgsfield/generateSiteImage";
import { deductCredits } from "@/lib/credits/deductCredits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
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
      a =>
        a.name === asset.name &&
        a.prompt === asset.prompt &&
        a.aspectRatio === asset.aspectRatio &&
        a.style === asset.style,
    );
    const reusable =
      prior &&
      !feedback &&
      site.draft?.assets.find(a => a.name === asset.name && a.type === "image");
    if (reusable) {
      assets.push(reusable);
      continue;
    }
    let url: string | undefined;
    let generation: NonNullable<SiteAsset["generation"]>;
    if (process.env.HF_CREDENTIALS && process.env.SITES_ASSET_PROVIDER !== "fal") {
      const style = asset.style ?? "illustration";
      await requireCredits(accountId, usdToCredits(style === "photographic" ? 0.0057 : 0.035));
      const generated = await generateSiteImage(
        {
          prompt: `${asset.prompt}\nRevision feedback: ${feedback}\nPurpose: ${asset.purpose}. Finished production artwork, composed for the requested aspect ratio. No UI, buttons, watermarks or lettering.`,
          aspectRatio: asset.aspectRatio,
          style,
        },
        request => {
          console.info("[sites:higgsfield:accepted]", {
            siteId: site.id,
            assetName: asset.name,
            requestId: request.request_id,
            statusUrl: request.status_url,
          });
        },
      );
      url = generated.url;
      generation = {
        provider: "higgsfield",
        model: generated.model,
        requestId: generated.requestId,
      };
      try {
        await deductCredits({ accountId, creditsToDeduct: usdToCredits(generated.usd) });
      } catch {
        console.error("[sites:higgsfield:charge-failed]", {
          siteId: site.id,
          requestId: generated.requestId,
        });
      }
    } else {
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
      const result = await fal.subscribe(model, { input }).catch(error => {
        console.error("[sites:asset-validation]", { model, ...getAssetFailure(error) });
        throw error;
      });
      await chargeForGeneration({
        accountId,
        endpointId: model,
        requestId: result.requestId,
        fallbackUnits: 1,
        creditsForUnits: creditCostForImageUnits,
      });
      url = (result.data as { images?: { url: string }[] }).images?.[0]?.url;
      generation = { provider: "fal", model, requestId: result.requestId };
      if (!url) throw new Error("Asset production returned no image");
    }
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !(
        parsed.hostname === "fal.media" ||
        parsed.hostname.endsWith(".fal.media") ||
        parsed.hostname.endsWith(".fal.ai") ||
        (generation.provider === "higgsfield" &&
          (parsed.hostname === "images.higgs.ai" ||
            parsed.hostname.endsWith(".higgsfield.ai") ||
            parsed.hostname.endsWith(".cloudfront.net")))
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
    assets.push({ name: asset.name, url: stored, type: "image", generation });
  }
  return assets;
}
