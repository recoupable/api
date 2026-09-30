import { getWorld } from "workflow/runtime";

const stages: Record<string, { phase: string; detail: string }> = {
  metadataStep: { phase: "research", detail: "Reading the release and artist details" },
  audioSourceStep: { phase: "research", detail: "Finding and verifying the recording" },
  audioAnalysisStep: { phase: "research", detail: "Analyzing the audio and lyrics" },
  enrichContextStep: { phase: "research", detail: "Researching the artist and visual identity" },
  contextBriefStep: { phase: "research", detail: "Bringing the release research together" },
  collectContextStep: { phase: "research", detail: "Loading the release context" },
  prepareSkillStep: {
    phase: "design",
    detail: "Choosing design references and interaction principles",
  },
  selectConceptStep: { phase: "design", detail: "Choosing the fan experience" },
  directionStep: { phase: "design", detail: "Developing the art direction and interactions" },
  assetsStep: { phase: "assets", detail: "Creating the artwork and media" },
  initializeBuildStep: { phase: "build", detail: "Setting up the experience" },
  buildTurnStep: { phase: "build", detail: "Building the layout, motion, and interactions" },
  reviewStep: { phase: "review", detail: "Testing the fan journey and reviewing the design" },
  saveSiteStep: { phase: "review", detail: "Saving your preview" },
};

/** Read only step metadata: never fetch model inputs, outputs, credentials, or prompts. */
export async function readSiteBuildProgress(runId: string) {
  const steps: { stepName: string; status: string; createdAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await getWorld().steps.list({
      runId,
      resolveData: "none",
      pagination: { limit: 100, sortOrder: "desc", cursor },
    });
    steps.push(...page.data);
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  steps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const name = (step: { stepName: string }) => step.stepName.split("//").at(-1)!;
  const current = steps.find(step => stages[name(step)]);
  if (!current)
    return { phase: "queued", detail: "Waiting for the builder to start", reviewPass: 0 };
  const reviews = steps.filter(step => name(step) === "reviewStep");
  const stage = stages[name(current)];
  const refining = reviews.length > 0 && ["build", "assets"].includes(stage.phase);
  return {
    phase: refining ? "review" : stage.phase,
    detail: refining ? "Refining the experience after review" : stage.detail,
    reviewPass: reviews.length,
  };
}
