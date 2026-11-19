/** Preserve contract failure classes while exposing no source details or values. */
export function classifyRetainedFieldRefusal(reason: string): {
  state: "invalid" | "error" | "unavailable";
} {
  if (reason === "size_limit") return { state: "invalid" };
  if (reason === "helper_changed" || reason === "source_error") return { state: "error" };
  return { state: "unavailable" };
}
