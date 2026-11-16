import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { classifyContextOperationError } from "../classifyContextOperationError";
import { ContextOperationError, contextOperationErrorCodes } from "../ContextOperationError";
import { formatContextOperationError } from "../formatContextOperationError";
afterEach(() => vi.restoreAllMocks());

describe("bounded Context error classification", () => {
  it.each([
    ["Access denied to context owner", "permission_denied"],
    ["Context request not found", "not_found"],
    ["Context storage operation failed: query returned no rows", "storage_failed"],
    [
      "Context storage operation failed: Idempotency key already used for different input",
      "conflict",
    ],
    ["Context storage operation failed: Evidence changed; reload before reviewing", "conflict"],
    ["Context storage operation failed: Catalog revision conflict", "conflict"],
    ["Only Spotify tracks are enabled in this pilot", "unsupported_input"],
    ["Context request is not ready for a brief", "not_ready"],
    [
      "Context storage operation failed: canceling statement due to statement timeout",
      "unavailable",
    ],
    ["Context storage operation failed: deadlock detected", "unavailable"],
    ["fetch failed", "unavailable"],
    ["Context storage operation failed: private-rule-id rejected", "storage_failed"],
    ["Invalid compiled brief", "internal"],
    ["private-id unavailable: contact secret-provider", "internal"],
    ["Access denied to context owner private-id", "internal"],
    ["Context storage operation failed: private-id conflict timeout", "storage_failed"],
  ])("classifies only known message %s", (message, code) => {
    expect(classifyContextOperationError(new Error(message)).code).toBe(code);
  });
  it.each([null, { state: "unknown-private-state" }, { id: "private-id" }])(
    "does not guess caller errors from malformed stored data %j",
    value => {
      const result = z.object({ id: z.uuid(), state: z.literal("ready") }).safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(classifyContextOperationError(result.error).code).toBe("internal");
    },
  );
  it("does not emit private messages, causes, identifiers or logs", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [
      new Error("private-id", { cause: new Error("secret-token") }),
      { message: "private-id" },
    ]) {
      const typed = classifyContextOperationError(error);
      expect(JSON.stringify(formatContextOperationError(typed))).not.toMatch(
        /private-id|secret-token/,
      );
    }
    expect(log).not.toHaveBeenCalled();
  });
  it.each(contextOperationErrorCodes)("formats %s without unsafe retry promises", code => {
    const body = formatContextOperationError(new ContextOperationError(code)).body;
    expect(body.guidance).not.toMatch(/never duplicate|no duplicate work|No paid work was started/);
    expect(body.guidance).not.toContain("idempotency");
  });
  it("reserves budget exhaustion without asserting a spend result", () => {
    expect(
      formatContextOperationError(new ContextOperationError("budget_exhausted")),
    ).toMatchObject({ status: 402, body: { retryable: false } });
  });
});
