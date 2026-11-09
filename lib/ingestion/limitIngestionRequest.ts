import { takeSiteRequest } from "@/lib/supabase/site_activity_events/takeSiteRequest";
import { hashIngestionValue } from "./hashIngestionValue";
import type { IngestionDependencies } from "./types";
/** Share the existing durable request-counter primitive across HTTP and MCP. */
export async function limitIngestionRequest(
  actor: string,
  scope: string,
  action: Parameters<IngestionDependencies["limit"]>[2],
) {
  const limits = { create: 10, deliver: 10, read: 120, artifact: 30 };
  if (
    !(await takeSiteRequest(
      hashIngestionValue({ domain: "ingestion", actor, scope, action }),
      limits[action],
    ))
  )
    throw new Error("Ingestion request limit reached");
}
