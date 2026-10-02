import { SiteError } from "@/lib/sites/SiteError";
import type { CreativeReview } from "@/lib/sites/production/schema";
import { reviewExperience } from "@/lib/sites/production/reviewExperience";
import { FatalError, RetryableError } from "workflow";
export async function reviewStep(
  ...args: Parameters<typeof reviewExperience>
): Promise<CreativeReview> {
  "use step";
  try {
    return await reviewExperience(...args);
  } catch (error) {
    if (error instanceof SiteError && error.status === 402)
      return {
        verdict: "revise",
        blocked: "credits",
        issues: [],
        summary:
          "Your game is saved. Review could not finish because your account ran out of credits. You can publish this version now; add credits before requesting further improvements. This version has not passed review.",
      };
    console.error(
      "[sites:reviewStep]",
      error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 1200) }
        : "Unknown failure",
    );
    if (
      error instanceof Error &&
      (error.name === "AI_NoObjectGeneratedError" ||
        (error.message.includes("page.screenshot:") &&
          /Timeout \d+ms exceeded/.test(error.message)))
    ) {
      throw new RetryableError("Review interrupted; retrying the saved build.", {
        retryAfter: "15s",
      });
    }
    throw new FatalError(
      "Site production reviewStep failed. No automatic provider retry was attempted.",
    );
  }
}
