/** Classify failures without copying private exception text, causes or identifiers to logs. */
export function getContextFailureReason(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Material evidence could not be verified")
      return "material_evidence_unverified";
    if (error.message === "Material evidence owner changed") return "owner_changed";
    if (
      [
        "Evidence receipt scope mismatch",
        "Evidence receipt ID mismatch",
        "Evidence receipt targets mismatch",
      ].includes(error.message)
    )
      return "evidence_receipt_unverified";
  }
  return "dependency_or_access";
}
