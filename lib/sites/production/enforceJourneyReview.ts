import type { CreativeReview } from "./schema";
type JourneyReport = { name: string; journeyPassed?: boolean; errors: string[]; overflow: boolean };
/** Model opinions cannot override missing browser evidence. */
export function enforceJourneyReview(review: CreativeReview, reports: JourneyReport[]) {
  const result: CreativeReview = {
    ...review,
    issues: [...review.issues],
    verification: {
      scope: "generated-experience",
      nativeShareDelivery: "not-tested",
      spotifyAuthentication: "not-tested",
      viewports: reports,
    },
  };
  for (const name of ["mobile", "desktop"]) {
    const report = reports.find(r => r.name === name);
    if (!report?.journeyPassed || report.errors.length || report.overflow) {
      result.issues.push({
        severity: "blocking",
        module: "implementation",
        detail: `${name}: complete fan journey not proven. ${report?.errors.join("; ") || "Missing completion evidence"}${report?.overflow ? "; horizontal overflow" : ""}`,
        fix: "Complete every planned action and verify the real result and delivery; do not replace them with success text or inactive buttons.",
      });
    }
  }
  if (result.issues.some(i => i.severity === "blocking")) result.verdict = "revise";
  return result;
}
