import { requirePlayerSession } from "./requirePlayerSession";
import { listeningEventSchema } from "./schema";
import { insertPlayerListeningEvent } from "@/lib/supabase/player_listening_events/insertPlayerListeningEvent";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { SiteError } from "@/lib/sites/SiteError";
export async function recordListeningEvent(token: string, input: unknown) {
  const event = listeningEventSchema.parse(input),
    { context, session } = await requirePlayerSession(token);
  if (session.provider !== event.provider) throw new SiteError(403, "Wrong listening provider");
  await limitSiteRequest(context.sessionId, "listening-event", 120);
  return {
    success: true,
    recorded: await insertPlayerListeningEvent(context.sessionId, context.revision, event),
  };
}
