import { expect, it } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getGenerationFailure } from "../getGenerationFailure";
it("exposes validation paths without recording generated content", () => {
  const validation = z.object({ color: z.string() }).safeParse({ color: 12 });
  const error = new NoObjectGeneratedError({
    cause: validation.error,
    text: "private model response",
    response: { id: "response", timestamp: new Date(), modelId: "test" },
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 2, reasoningTokens: 0 },
    },
    finishReason: "stop",
  });
  const diagnostic = getGenerationFailure(error);
  expect(diagnostic).toMatchObject({
    finishReason: "stop",
    issues: [{ path: "color", code: "invalid_type" }],
  });
  expect(JSON.stringify(diagnostic)).not.toContain("private model response");
});
