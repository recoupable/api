import { reviewExperience } from "@/lib/sites/production/reviewExperience";
import { FatalError, RetryableError } from "workflow";
export async function reviewStep(...args: Parameters<typeof reviewExperience>) {
  "use step";
  try {
    return await reviewExperience(...args);
  } catch (error) {
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
