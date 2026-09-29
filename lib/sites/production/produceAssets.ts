import { generateSiteMedia } from "../assets/generateSiteMedia";
import { resolveAssetPlan } from "../assets/resolveAssetPlan";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { deductCredits } from "@/lib/credits/deductCredits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import sharp from "sharp";
import type { Site, SiteAsset } from "../schema";
import type { CreativeDirection } from "./schema";
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
        a.style === asset.style &&
        JSON.stringify(a.production) === JSON.stringify(asset.production),
    );
    const reusable =
      prior &&
      !feedback &&
      site.draft?.assets.find(
        a => a.name === asset.name && a.type === resolveAssetPlan(asset.production).type,
      );
    if (reusable) {
      assets.push(reusable);
      continue;
    }
    const plan = resolveAssetPlan(asset.production);
    await requireCredits(
      accountId,
      usdToCredits(
        plan.type === "video" ? plan.duration! * 0.3236 : plan.provider === "fal" ? 0.15 : 1,
      ),
    );
    const generated = await generateSiteMedia(
      asset,
      site.assets.filter(a => a.type === "image").map(a => a.url),
      feedback,
      request => {
        console.info("[sites:media:accepted]", {
          siteId: site.id,
          assetName: asset.name,
          requestId: request.request_id,
          statusUrl: request.status_url,
        });
      },
    );
    const generation = generated.generation;
    if ("usage" in generated && generated.usage) {
      await handleChatCredits({
        accountId,
        model: generation.model,
        source: "api",
        resourceUrl: `/sites/${site.id}`,
        usage: {
          ...generated.usage,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        },
      });
    } else {
      try {
        await deductCredits({ accountId, creditsToDeduct: usdToCredits(generated.estimatedUsd!) });
      } catch {
        console.error("[sites:asset:charge-failed]", { requestId: generation.requestId });
      }
    }
    let downloaded: Buffer;
    if ("bytes" in generated && generated.bytes) downloaded = generated.bytes;
    else {
      const url = generated.url!;
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "fal.media" ||
          parsed.hostname.endsWith(".fal.media") ||
          parsed.hostname.endsWith(".fal.ai") ||
          (parsed.hostname === "storage.googleapis.com" &&
            parsed.pathname.startsWith("/falserverless/")) ||
          (generation.provider === "higgsfield" &&
            (parsed.hostname === "images.higgs.ai" ||
              parsed.hostname.endsWith(".higgsfield.ai") ||
              parsed.hostname.endsWith(".cloudfront.net")))
        )
      )
        throw new Error("Unexpected generated image host");
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) >
          (generated.type === "video" ? 40000000 : 20000000)
      )
        throw new Error("Could not retrieve generated asset");
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > (generated.type === "video" ? 40000000 : 20000000))
            throw new Error("Generated asset too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      downloaded = Buffer.concat(chunks);
    }
    if (generated.type === "video") {
      if (downloaded.subarray(4, 8).toString() !== "ftyp")
        throw new Error("Generated video is not an MP4");
      const stored = await uploadSiteAsset(site.owner_id, downloaded, "video/mp4", "mp4");
      assets.push({ name: asset.name, url: stored, type: "video", generation });
      continue;
    }
    const bytes = await sharp(downloaded, { limitInputPixels: 25000000 })
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const stored = await uploadSiteAsset(site.owner_id, bytes, "image/webp", "webp");
    assets.push({ name: asset.name, url: stored, type: "image", generation });
  }
  return assets;
}
