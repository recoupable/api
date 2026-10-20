import { z } from "zod";
import { authorizeContextOwner } from "../lib/context/authorizeContextOwner";
import { analyzeSavedContextCatalogMetadata } from "../lib/context/enrichment/analyzeSavedContextCatalogMetadata";
import { callContextRpc } from "../lib/supabase/context_requests/callContextRpc";

// Operator entry point: requires the existing server environment and an account API key.
const [requestArg, subjectArg, ownerArg] = process.argv.slice(2);
if (!requestArg || !subjectArg) {
  throw new Error(
    "Usage: analyzeContextCatalogMetadata.ts <request-id> <recording-subject-id> [workspace-owner-id]",
  );
}
const requestId = z.uuid().parse(requestArg);
const subjectId = z.uuid().parse(subjectArg);
const apiKey = z.string().min(1).parse(process.env.RECOUP_API_KEY);
const identityResponse = await fetch("https://api.recoupable.dev/api/accounts/id", {
  headers: { "x-api-key": apiKey },
  redirect: "error",
  signal: AbortSignal.timeout(30000),
});
if (!identityResponse.ok)
  throw new Error(`Account authentication failed HTTP ${identityResponse.status}`);
const { accountId: actor } = z
  .object({ status: z.literal("success"), accountId: z.uuid() })
  .parse(await identityResponse.json());
const owner = ownerArg ? z.uuid().parse(ownerArg) : actor;
const authorize = (account: string, workspace: string) =>
  authorizeContextOwner(account, workspace === account ? undefined : workspace);
const receipt = await analyzeSavedContextCatalogMetadata(
  actor,
  owner,
  requestId,
  subjectId,
  apiKey,
  {
    authorize,
    rpc: callContextRpc,
  },
);
// Leave metadata in private storage; display only the operation receipt.
const result = z.object({ state: z.string(), resultId: z.string().optional() }).parse(receipt);
console.log(JSON.stringify(result, null, 2));
