import { ProfileScrapeResult, ScrapeProfileResult, scrapeProfileUrl } from "./scrapeProfileUrl";

type ScrapeProfileUrlBatchInput = {
  profileUrl: string | null | undefined;
  username: string | null | undefined;
};

export const scrapeProfileUrlBatch = async (
  inputs: ScrapeProfileUrlBatchInput[],
  posts?: number,
): Promise<ProfileScrapeResult[]> => {
  const results = await Promise.all(
    inputs.map(({ profileUrl, username }) =>
      scrapeProfileUrl(profileUrl ?? null, username ?? "", posts),
    ),
  );

  return results
    .filter((result): result is ScrapeProfileResult => result !== null)
    .map(({ runId, datasetId, error }) => ({
      runId,
      datasetId,
      error,
    }));
};
