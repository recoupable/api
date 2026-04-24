import type { Tables } from "@/types/database.types";
import { getDataset } from "@/lib/apify/getDataset";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import { uploadPfpToArweave } from "@/lib/arweave/uploadPfpToArweave";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import type { ApifyWebhookPayload } from "../apifyWebhookSchema";
import { getSocialProfileParser } from "./getSocialProfileParser";

export type SocialProfileHandlerResult = {
  social: Tables<"socials"> | null;
};

/**
 * Resolves an Apify social-profile run by fetching its dataset, parsing the
 * first item via the actor-specific parser, optionally rehosting the avatar
 * on Arweave, and upserting the result into `socials`.
 */
export async function handleSocialProfileWebhook(
  parsed: ApifyWebhookPayload,
): Promise<SocialProfileHandlerResult> {
  const datasetId = parsed.resource.defaultDatasetId;
  if (!datasetId) {
    return { social: null };
  }

  const parser = getSocialProfileParser(parsed.eventData.actorId);
  if (!parser) {
    console.log(`Unhandled actorId: ${parsed.eventData.actorId}`);
    return { social: null };
  }

  const dataset = await getDataset(datasetId);
  const datasetItem = Array.isArray(dataset) ? dataset[0] : null;
  if (!datasetItem) {
    return { social: null };
  }

  const { payload } = await parser(datasetItem);
  if (!payload) {
    return { social: null };
  }

  if (payload.avatar) {
    const arweaveUrl = await uploadPfpToArweave(payload.avatar);
    if (arweaveUrl) {
      const fetchableUrl = getFetchableUrl(arweaveUrl);
      if (fetchableUrl) {
        payload.avatar = fetchableUrl;
      }
    }
  }

  if (!payload.username || !payload.profile_url) {
    return { social: null };
  }

  const upserted = await upsertSocials([payload]);
  return { social: upserted[0] ?? null };
}
