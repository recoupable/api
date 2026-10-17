export type ProfileScrapeResult =
  | { state: "started"; runId: string; datasetId: string | null; error: null }
  | { state: "failed"; runId: null; datasetId: null; error: string };
