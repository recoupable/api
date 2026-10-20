import { createHash } from "node:crypto";
import { FAL_IMAGE_USD_PER_UNIT } from "@/lib/content/creditCostForImageUnits";
import { FAL_VIDEO_USD_PER_UNIT } from "@/lib/content/creditCostForVideoUnits";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { getPackBriefFingerprint } from "./getPackBriefFingerprint";
import type { ReleasePackBrief, ReleasePackDeliverables } from "./releasePackSchema";

export type PackAssetKind = "video" | "artwork" | "quote_card" | "carousel" | "visualizer";
export type PackAssetPlan = {
  kind: PackAssetKind;
  ordinal: number;
  files: number;
  maximum_usd: number;
  credits: number;
};
/** Complete customer quote. Included production services cannot add surprise customer charges. */
export function buildReleasePackQuote(
  brief: ReleasePackBrief,
  deliverables: ReleasePackDeliverables,
) {
  const assets: PackAssetPlan[] = [];
  const motionCost =
    FAL_VIDEO_USD_PER_UNIT * estimateVideoUnits(deliverables.video_seconds, "768P");
  const kinds: [PackAssetKind, number][] = [
    ["video", deliverables.videos],
    ["artwork", deliverables.artwork],
    ["quote_card", deliverables.quote_cards],
    ["carousel", deliverables.carousels],
    ["visualizer", deliverables.visualizers],
  ];
  for (const [kind, count] of kinds)
    for (let ordinal = 0; ordinal < count; ordinal++) {
      const files = kind === "carousel" ? 4 : 1;
      const usd = Number(
        (files * FAL_IMAGE_USD_PER_UNIT + (kind === "video" ? motionCost : 0)).toFixed(6),
      );
      assets.push({ kind, ordinal, files, maximum_usd: usd, credits: usdToCredits(usd) });
    }
  const stills = assets.reduce((sum, a) => sum + a.files, 0);
  const maximum_usd = Number(assets.reduce((sum, a) => sum + a.maximum_usd, 0).toFixed(6));
  return {
    pricing_version: "release-pack-house-rates-v1",
    brief_fingerprint: getPackBriefFingerprint(brief),
    fingerprint: createHash("sha256").update(JSON.stringify({ brief, deliverables })).digest("hex"),
    creative_piece_count: assets.length,
    generated_file_count: stills,
    caption_count: assets.length,
    format_variants:
      "One 9:16 visual per piece; a carousel contains four slides. No additional platform variants are counted.",
    line_items: [
      {
        category: "stills",
        units: stills,
        usd: Number((stills * FAL_IMAGE_USD_PER_UNIT).toFixed(6)),
      },
      {
        category: "motion",
        units: deliverables.videos * deliverables.video_seconds,
        usd: Number((deliverables.videos * motionCost).toFixed(6)),
      },
      { category: "captions", units: assets.length, usd: 0, included: true },
      { category: "inspection", units: assets.length, usd: 0, included: true },
      {
        category: "composition",
        units: deliverables.videos + deliverables.visualizers,
        usd: 0,
        included: true,
      },
    ],
    maximum_usd,
    credits: assets.reduce((sum, a) => sum + a.credits, 0),
    assets,
    retry_policy:
      "No automatic paid retries. Failed QA is retained for review. A new attempt requires a fresh quote and explicit budget approval.",
    expires_in_seconds: 900,
  };
}
