import { z } from "zod";
import { getAccountIdByApiKey } from "../lib/auth/getAccountIdByApiKey";
import { authorizeContextOwner } from "../lib/context/authorizeContextOwner";
import { analyzeSavedContextLyrics } from "../lib/context/enrichment/analyzeSavedContextLyrics";
import { callContextRpc } from "../lib/supabase/context_requests/callContextRpc";

// Operator entry point: requires the existing server environment and an account API key.
const [requestArg, subjectArg, ownerArg] = process.argv.slice(2);
if (!requestArg || !subjectArg) {
  throw new Error(
    "Usage: analyzeContextLyrics.ts <request-id> <recording-subject-id> [workspace-owner-id]",
  );
}
const requestId = z.uuid().parse(requestArg);
const subjectId = z.uuid().parse(subjectArg);
const apiKey = z.string().min(1).parse(process.env.RECOUP_API_KEY);
const actor = await getAccountIdByApiKey(apiKey);
if (!actor) throw new Error("Invalid account API key");
const owner = ownerArg ? z.uuid().parse(ownerArg) : actor;
const authorize = (account: string, workspace: string) =>
  authorizeContextOwner(account, workspace === account ? undefined : workspace);
const receipt = await analyzeSavedContextLyrics(actor, owner, requestId, subjectId, apiKey, {
  authorize,
  rpc: callContextRpc,
});
// Leave transcription in private storage; display only the operation receipt.
const result = z.object({ state: z.string(), resultId: z.string().optional() }).parse(receipt);
console.log(JSON.stringify(result, null, 2));
