export { playerPreflight as OPTIONS } from "@/lib/players/playerPreflight";
import { recordListeningEvent } from "@/lib/players/recordListeningEvent";
import { publicPlayerResponse } from "@/lib/players/publicPlayerResponse";
import { z } from "zod";
/**
 * Record reported SDK playback, never authoritative DSP stream totals.
 *
 * @param request - Incoming HTTP request.
 * @returns HTTP response.
 */
export async function POST(request: Request) {
  return publicPlayerResponse(
    request,
    async () => {
      const { flow, event } = z
        .object({ flow: z.string().max(2048), event: z.unknown() })
        .strict()
        .parse(await request.json().catch(() => null));
      return recordListeningEvent(flow, event);
    },
    true,
  );
}
