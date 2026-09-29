import { NoObjectGeneratedError } from "ai";
/** Log schema paths and finish reason, never raw prompts, responses or provider headers. */
export function getGenerationFailure(error: unknown) {
  if (!NoObjectGeneratedError.isInstance(error))
    return { name: error instanceof Error ? error.name : "UnknownError" };
  const issues: { path: string; code: string; maximum?: number }[] = [];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
    if ("issues" in cause && Array.isArray(cause.issues)) {
      for (const issue of cause.issues.slice(0, 8)) {
        if (issue && typeof issue === "object")
          issues.push({
            path: Array.isArray(issue.path) ? issue.path.join(".").slice(0, 160) : "",
            code: String(issue.code).slice(0, 80),
            ...(typeof issue.maximum === "number" ? { maximum: issue.maximum } : {}),
          });
      }
    }
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return {
    name: error.name,
    finishReason: error.finishReason,
    outputTokens: error.usage?.outputTokens,
    reasoningTokens: error.usage?.outputTokenDetails?.reasoningTokens,
    textTokens: error.usage?.outputTokenDetails?.textTokens,
    responseLength: error.text?.length,
    issues,
  };
}
