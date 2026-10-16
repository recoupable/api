import { z } from "zod";
import { processContextOperation } from "@/lib/context/processContextOperation";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { runStoredContextRequest } from "@/lib/context/runStoredContextRequest";
import { readSiteContextBrief } from "./readSiteContextBrief";
import type { Site } from "../schema";
import type { prepareSiteContext } from "./prepareSiteContext";
/** Save a versioned brief and use the same scoped handoff as explicitly selected briefs. */
export async function saveSiteContextBrief(
  site: Site,
  accountId: string,
  context: Awaited<ReturnType<typeof prepareSiteContext>>,
) {
  const saved = await processContextOperation(
    accountId,
    {
      action: "save_brief",
      request_id: context.requestId,
      organization_id: site.owner_id,
      purpose: "creative_direction",
      max_characters: 32000,
      // save_context_brief rejects a reused key with different output: bump the suffix
      // whenever compiled brief output changes (v4: evidence freshness lines and manifest).
      idempotency_key: `sites:${site.id}:${site.revision}:${context.requestId}:brief-v4`,
    },
    { rpc: callContextRpc, dispatch: runStoredContextRequest },
  );
  const briefId = z.object({ snapshot: z.object({ id: z.uuid() }) }).parse(saved).snapshot.id;
  return readSiteContextBrief(site, accountId, briefId);
}
