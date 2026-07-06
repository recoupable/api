import { ProfileScrapeResult, ScrapeProfileResult, scrapeProfileUrl } from "./scrapeProfileUrl";

export type BatchProfileScrapeResult = ProfileScrapeResult & { profileUrl: string | null };

type ScrapeProfileUrlBatchInput = {
  profileUrl: string | null | undefined;
  username: string | null | undefined;
};

export const scrapeProfileUrlBatch = async (
  inputs: ScrapeProfileUrlBatchInput[],
  posts?: number,
): Promise<BatchProfileScrapeResult[]> => {
  const results = await Promise.all(
    inputs.map(async ({ profileUrl, username }) => {
      const result = await scrapeProfileUrl(profileUrl ?? null, username ?? "", posts);
      return result ? { ...result, profileUrl: profileUrl ?? null } : null;
    }),
  );

  return results
    .filter(
      (result): result is ScrapeProfileResult & { profileUrl: string | null } => result !== null,
    )
    .map(({ runId, datasetId, error, profileUrl }) => ({
      runId,
      datasetId,
      error,
      profileUrl,
    }));
};
