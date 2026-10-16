import { z } from "zod";
import { v5 as uuidv5 } from "uuid";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { readBoundedOriginalStream } from "./readBoundedOriginalStream";
import { verifyContextOriginal } from "./verifyContextOriginal";

import { contextOriginalPreparationSchema } from "./contextOriginalPreparationSchema";

/** Server-side preparation only. Bytes are not uploaded or registered evidence. */
export async function prepareContextOriginal(
  actor: string,
  owner: string,
  input: unknown,
  stream: ReadableStream<Uint8Array>,
) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  const parsed = contextOriginalPreparationSchema.parse(input);
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  const file = await readBoundedOriginalStream(stream);
  const objectId = uuidv5(
    JSON.stringify(["recoup-context-original", owner, parsed.sourceId, parsed.idempotencyKey]),
    uuidv5.URL,
  );
  const key = `${owner}/context-originals/${objectId}.original`;
  const verified = await verifyContextOriginal(actor, owner, key, async () => file);
  if (verified.mediaType !== parsed.mediaType)
    throw new Error("Original type conflicts with declared media type");
  return { ...verified, file };
}
