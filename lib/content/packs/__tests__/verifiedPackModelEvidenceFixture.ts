import type { getPackModelEvidence } from "../getPackModelEvidence";
/** Synthetic authorization for isolated behavior tests; never production evidence. */
export function verifiedPackModelEvidenceFixture(result: ReturnType<typeof getPackModelEvidence>) {
  for (const entry of Object.values(result.tasks)) {
    entry.capability = "verified";
    entry.commercial_basis = "verified";
    entry.account_availability = "verified";
    entry.lifecycle = "supported";
    entry.valid_until = "2099-01-01T00:00:00.000Z";
    entry.evidence = ["https://example.invalid/synthetic-test-evidence"];
  }
  return result;
}
