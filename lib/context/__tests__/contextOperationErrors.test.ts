import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ContextOperationError, contextOperationErrorCodes } from "../ContextOperationError";
import { classifyContextOperationError } from "../classifyContextOperationError";
import { formatContextOperationError } from "../formatContextOperationError";

const storage = (message: string) => `Context storage operation failed: ${message}`;

afterEach(() => vi.restoreAllMocks());

describe("Context operation error contract", () => {
  it.each([
    ["Access denied to context owner", "permission_denied", 403, false],
    ["Access denied to selected context owner", "permission_denied", 403, false],
    [storage("Case access denied"), "permission_denied", 403, false],
    [storage("Artist not linked to selected workspace"), "permission_denied", 403, false],
    [storage("Catalog not accessible in selected workspace"), "permission_denied", 403, false],
    ["Context request not found", "not_found", 404, false],
    [storage("Case is unavailable"), "not_found", 404, false],
    [storage("Case review unavailable"), "not_found", 404, false],
    [storage("query returned no rows"), "not_found", 404, false],
    [storage("Subject outside request"), "not_found", 404, false],
    [storage("Idempotency key already used for different input"), "conflict", 409, false],
    [storage("Brief key already used for different output"), "conflict", 409, false],
    [storage("Review key already used for different input"), "conflict", 409, false],
    [storage("Context acceptance conflict"), "conflict", 409, false],
    [storage("Release locator acceptance conflict"), "conflict", 409, false],
    [storage("Execution outcome conflict"), "conflict", 409, false],
    [storage("Destination request busy"), "conflict", 409, false],
    [storage("Evidence changed; reload before reviewing"), "conflict", 409, false],
    ["Release target changed", "conflict", 409, false],
    [storage("Brief evidence changed or is unavailable"), "conflict", 409, false],
    [storage("Catalog membership changed during expansion"), "conflict", 409, false],
    [storage("Release locator identity is disputed"), "conflict", 409, false],
    [storage("Conflicting recording identity"), "conflict", 409, false],
    ["Only Spotify tracks are enabled in this pilot", "unsupported_input", 422, false],
    ["Only Spotify tracks are enabled", "unsupported_input", 422, false],
    ["Use a Spotify track or a single YouTube video URL", "unsupported_input", 422, false],
    ["Use a Spotify album URL, including a single's album page", "unsupported_input", 422, false],
    ["Use a public HTTPS Spotify track or YouTube video URL", "unsupported_input", 422, false],
    [
      "Context ingestion currently supports individual Spotify tracks",
      "unsupported_input",
      422,
      false,
    ],
    ["Unsupported saved context entry", "unsupported_input", 422, false],
    ["A brief requires saved context requests", "unsupported_input", 422, false],
    [storage("Invalid campaign brief"), "unsupported_input", 422, false],
    [storage("Invalid metadata review"), "unsupported_input", 422, false],
    [storage("Request has too many subjects"), "unsupported_input", 422, false],
    ["Context request is not ready for a brief", "not_ready", 409, true],
    ["Context request is not ready for planning", "not_ready", 409, true],
    ["Release verification is not ready", "not_ready", 409, true],
    [storage("Metadata request not complete"), "not_ready", 409, true],
    [storage("Request is not ready for enrichment"), "not_ready", 409, true],
    [storage("Current release tracks are not ready for lookup"), "not_ready", 409, true],
    [storage("Brief requests are unavailable"), "not_ready", 409, true],
    ["Spotify authentication unavailable", "unavailable", 503, true],
    ["Spotify release verification is not enabled", "unavailable", 503, true],
    ["Spotify release track lookup is not enabled", "unavailable", 503, true],
    ["YouTube context ingestion is not enabled yet", "unavailable", 503, true],
    ["Hosted audio provider is not configured", "unavailable", 503, true],
    ["Release verification dispatcher unavailable", "unavailable", 503, true],
    [storage("TypeError: fetch failed"), "unavailable", 503, true],
    [storage("canceling statement due to statement timeout"), "unavailable", 503, true],
    [storage("could not serialize access due to concurrent update"), "unavailable", 503, true],
    [storage('duplicate key value violates unique constraint "x"'), "storage_failed", 409, false],
    [storage("Duplicate brief documents"), "storage_failed", 409, false],
    [storage("Brief manifest does not match evidence"), "storage_failed", 409, false],
    [storage("Invalid compiled brief"), "internal", 500, false],
    ["Unknown context operation", "internal", 500, false],
    ["Unknown release case operation", "internal", 500, false],
    ["Spotify HTTP 503", "internal", 500, false],
  ] as const)("classifies %j as %s", (message, code, status, retryable) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = classifyContextOperationError(new Error(message));
    expect(error).toBeInstanceOf(ContextOperationError);
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
    expect(formatContextOperationError(error).status).toBe(status);
  });

  it("passes a typed error through unchanged", () => {
    const typed = new ContextOperationError("budget_exhausted");
    expect(classifyContextOperationError(typed)).toBe(typed);
  });

  it.each([
    [
      "a stored lookup that returned nothing for this owner",
      "not_found",
      404,
      z.object({ id: z.string() }),
      null,
    ],
    [
      "a lifecycle prerequisite that has not been reached",
      "not_ready",
      409,
      z.object({ state: z.literal("ready") }),
      { state: "pending" },
    ],
    [
      "a saved record already past the state this action needs",
      "conflict",
      409,
      z.object({ identityConfirmed: z.literal(false) }),
      { identityConfirmed: true },
    ],
    ["an internal identifier guard", "internal", 500, z.uuid(), "actor"],
  ] as const)("maps a Zod failure from %s to %s", (_, code, status, schema, value) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = schema.safeParse(value);
    expect(parsed.success).toBe(false);
    const error = classifyContextOperationError(parsed.error);
    expect(error.code).toBe(code);
    expect(formatContextOperationError(error).status).toBe(status);
  });

  it("logs the cause of internal and storage failures without returning it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error(storage("private database detail"));
    const error = classifyContextOperationError(cause);
    expect(error.code).toBe("storage_failed");
    expect(log).toHaveBeenCalledWith("Context operation failed (storage_failed)", cause);
    expect(JSON.stringify(formatContextOperationError(error).body)).not.toContain("private");
    log.mockClear();
    classifyContextOperationError(new Error("Access denied to context owner"));
    expect(log).not.toHaveBeenCalled();
  });

  it("only promises idempotent retries to actions that take an idempotency_key", () => {
    for (const code of ["unavailable", "storage_failed", "internal"] as const)
      expect(new ContextOperationError(code).guidance).not.toMatch(
        /^Retry with the same input and idempotency_key/,
      );
  });

  it("maps non-Error values to internal", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(classifyContextOperationError("boom").code).toBe("internal");
    expect(classifyContextOperationError(undefined).code).toBe("internal");
  });

  it("never copies raw storage diagnostics into the public body", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const diagnostic =
      'duplicate key value violates unique constraint "ctx_owner" Key (owner_id)=(x)';
    const error = classifyContextOperationError(new Error(storage(diagnostic)));
    const text = JSON.stringify(formatContextOperationError(error).body);
    expect(text).not.toContain("duplicate key");
    expect(text).not.toContain("owner_id");
    expect(text).not.toContain("Context storage operation failed");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("never copies a matched authored message verbatim when it carries a private suffix", () => {
    const error = classifyContextOperationError(
      new Error(storage("Case access denied for actor 00000000-0000-4000-8000-000000000000")),
    );
    expect(error.code).toBe("permission_denied");
    expect(JSON.stringify(formatContextOperationError(error).body)).not.toContain("0000");
  });

  it("formats every code with a 4xx/5xx status, authored message and guidance", () => {
    for (const code of contextOperationErrorCodes) {
      const { status, body } = formatContextOperationError(new ContextOperationError(code));
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(body).toEqual({
        error: expect.any(String),
        code,
        retryable: expect.any(Boolean),
        guidance: expect.any(String),
      });
      expect(body.error.length).toBeGreaterThan(0);
      expect(body.guidance.length).toBeGreaterThan(0);
    }
  });

  it("reserves budget_exhausted as 402 for the spend path", () => {
    const { status, body } = formatContextOperationError(
      new ContextOperationError("budget_exhausted"),
    );
    expect(status).toBe(402);
    expect(body.retryable).toBe(false);
  });

  it("exposes the exact code set documented in the OpenAPI contract", () => {
    expect([...contextOperationErrorCodes].sort()).toEqual([
      "budget_exhausted",
      "conflict",
      "internal",
      "not_found",
      "not_ready",
      "permission_denied",
      "storage_failed",
      "unavailable",
      "unsupported_input",
    ]);
  });
});
