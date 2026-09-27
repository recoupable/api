import { analyzeSavedContextAudio } from "@/lib/context/enrichment/analyzeSavedContextAudio";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { flamingoGenerateBodySchema } from "@/lib/flamingo/flamingoGenerateBodySchema";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";
import { requireCredits } from "./requireCredits";
import { generateProductionObject } from "./generateProductionObject";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
import type { prepareSiteContext } from "./prepareSiteContext";
/** Server identity is already authenticated; charge that actor through the existing inference service. */
export async function analyzeSiteContextAudio(
  site: Site,
  accountId: string,
  context: Awaited<ReturnType<typeof prepareSiteContext>>,
  mode: "summary" | "lyrics",
) {
  return analyzeSavedContextAudio(
    accountId,
    site.owner_id,
    context.requestId,
    context.subjectId,
    "",
    {
      rpc: callContextRpc,
      authorize: authorizeSiteWorkspace,
      analyze: async input => {
        const params = flamingoGenerateBodySchema.parse(input);
        if (!(await verifyAudioUrl(input.audio_url)).ok)
          throw new Error("Private audio URL unavailable");
        await requireCredits(accountId, minimumCreditsForAnalyzeRequest(params));
        const result = await processAnalyzeMusicRequest(params, { accountId });
        if (
          result.type !== "success" ||
          !("response" in result) ||
          typeof result.response !== "string"
        )
          throw new Error("Audio inference unavailable");
        return {
          status: "success",
          response: result.response,
          elapsed_seconds: result.elapsed_seconds,
        };
      },
      normalize: async options => ({
        content: await generateProductionObject(
          options.schema,
          options.system,
          options.input,
          [],
          accountId,
          site.id,
        ),
        trace: {
          normalization: "grounded structured extraction",
          billing: "Sites metered generation",
        },
      }),
    },
    mode,
  );
}
