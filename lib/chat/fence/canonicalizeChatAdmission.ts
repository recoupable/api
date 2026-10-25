import { createHash } from "node:crypto";
import { chatAdmissionSchema } from "./chatAdmissionSchema";
import { encodeStrictJson } from "./encodeStrictJson";

/** Normalize once on the trusted server; retries must retrieve the stored original. */
export function canonicalizeChatAdmission(input: unknown) {
  // Inspect before Zod can strip properties, coerce values or invoke object getters.
  encodeStrictJson(input);
  const envelope = chatAdmissionSchema.parse(input);
  const canonical = encodeStrictJson(envelope);
  const inputHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { envelope, canonical, inputHash };
}
