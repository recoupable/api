import { ValidationError } from "@fal-ai/client";
/** Keep actionable provider validation fields without dumping inputs or credentials. */
export function getAssetFailure(error: unknown) {
  if (!(error instanceof ValidationError))
    return { name: error instanceof Error ? error.name : "UnknownError" };
  return {
    name: error.name,
    status: error.status,
    requestId: error.requestId,
    fields: error.fieldErrors.slice(0, 5).map(issue => ({
      path: issue.loc.join(".").slice(0, 160),
      code: issue.type.slice(0, 100),
      message: issue.msg.slice(0, 300),
    })),
  };
}
