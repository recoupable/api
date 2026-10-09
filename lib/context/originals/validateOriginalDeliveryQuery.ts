import { z } from "zod";
const uuid = z
  .string()
  .uuid()
  .transform(value => value.toLowerCase());
const schema = z.object({ receiptId: uuid, organizationId: uuid.optional() }).strict();
/** Delivery accepts a retained receipt, never a storage locator or byte assertion. */
export function validateOriginalDeliveryQuery(params: URLSearchParams) {
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    throw new Error("Repeated metadata");
  return schema.parse(Object.fromEntries(entries));
}
