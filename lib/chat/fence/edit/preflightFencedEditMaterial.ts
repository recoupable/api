import { encodeStrictJson } from "../encodeStrictJson";

/** Bound new-edit input before deep schemas/hashing; descriptor reads never invoke accessors. */
export function preflightFencedEditMaterial(input: unknown): void {
  const own = (value: unknown, key: string): unknown => {
    if (!value || typeof value !== "object") throw new Error("Invalid edit container");
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property)) throw new Error("Missing edit data property");
    return property.value;
  };
  const array = (value: unknown, limit: number): unknown[] => {
    if (!Array.isArray(value) || value.length > limit) throw new Error("Edit array exceeds limit");
    return value;
  };
  const canonical = (value: unknown) => {
    if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 1024 * 1024)
      throw new Error("Edit canonical exceeds limit");
  };
  const witness = array(own(input, "history_witness"), 1000);
  const payload = own(own(own(input, "capture"), "admission"), "payload");
  const messages = array(own(own(payload, "admission_envelope"), "messages"), 1000);
  canonical(own(input, "user_intent_canonical"));
  canonical(own(payload, "admission_canonical"));
  canonical(own(payload, "execution_canonical"));
  let parts = 0;
  for (let i = 0; i < witness.length; i++) {
    const message = own(own(witness, String(i)), "message");
    parts += array(own(message, "parts"), 10000).length;
    if (parts > 10000) throw new Error("Edit parts exceed limit");
  }
  if (messages.length) {
    parts += array(own(own(messages, String(messages.length - 1)), "parts"), 10000).length;
    if (parts > 10000) throw new Error("Edit parts exceed limit");
  }
  // These encodes stop at their byte budgets, before any schema or digest traversal.
  encodeStrictJson(witness, { maxBytes: 4 * 1024 * 1024 });
  encodeStrictJson(input, { maxBytes: 8 * 1024 * 1024 });
}
