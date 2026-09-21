import type { Site } from "../schema";
import type { ReleaseContext } from "./schema";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { flamingoGenerateBodySchema } from "@/lib/flamingo/flamingoGenerateBodySchema";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";
import { requireCredits } from "./requireCredits";
import { SiteError } from "../SiteError";
export async function analyzeReleaseMusic(
  site: Site,
  release: ReleaseContext["release"],
  accountId: string,
): Promise<ReleaseContext["music"]> {
  const supplied = site.assets.find(a => a.type === "audio");
  const url = supplied?.url || release.previewUrl;
  const unavailable = (reason: string): ReleaseContext["music"] => ({
    status: "unavailable",
    coverage: "none",
    analysis: "",
    reason,
  });
  if (!url)
    return unavailable(
      "No accessible recording or preview was resolved. Do not infer sound or lyrics from artwork.",
    );
  if (!(await verifyAudioUrl(url)).ok)
    return unavailable("The resolved audio could not be verified.");
  const params = flamingoGenerateBodySchema.parse({
    audio_url: url,
    prompt:
      "Analyze this audio for a creative fan experience. Describe audible instrumentation, energy, mood, texture, rhythmic feel and changes within the supplied clip. Summarize clearly audible lyrical themes without quoting lyrics. State uncertainty and do not invent lyrics or extrapolate a preview into a full-song structure.",
    max_new_tokens: 1200,
  });
  await requireCredits(accountId, minimumCreditsForAnalyzeRequest(params));
  try {
    const result = await processAnalyzeMusicRequest(params, { accountId });
    if (result.type !== "success") return unavailable("Music analysis was unavailable.");
    return {
      status: "analyzed",
      coverage: supplied ? "provided-audio" : "preview",
      analysis: JSON.stringify("response" in result ? result.response : result.report).slice(
        0,
        16000,
      ),
    };
  } catch (error) {
    if (error instanceof SiteError) throw error;
    return unavailable("The audio analysis provider did not complete.");
  }
}
