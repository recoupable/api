import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const targetSchema = z.strictObject({
  subjectId: z.uuid(),
  kind: z.enum([
    "artist",
    "songwriter",
    "company",
    "campaign",
    "release",
    "recording",
    "composition",
    "catalog",
    "material",
    "video",
  ]),
  identityConfirmed: z.boolean(),
  availableFields: z.array(
    z.enum([
      "isrc",
      "spotify_id",
      "title",
      "mlc_work_code",
      "artist_account_link",
      "catalog_account_link",
    ]),
  ),
  reusableModules: z.array(z.string()),
});

/** Service-only lookup. Callers must authorize the actor's selected owner first. */
export async function listContextRequestTargets(owner: string, requestId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  return z
    .array(targetSchema)
    .max(100)
    .parse(
      await callContextRpc("list_context_request_targets", {
        p_owner: owner,
        p_request: requestId,
      }),
    );
}
