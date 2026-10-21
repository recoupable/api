import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/sites/[id]/route";
import { actionSchema } from "@/lib/sites/schema";
import { siteOperationSchemas } from "@/lib/sites/siteOperationSchemas";
import { SiteError } from "@/lib/sites/SiteError";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({ operation: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "fixture-caller" })),
}));
// Never import or execute the production lifecycle implementation or its dependencies.
vi.mock("@/lib/sites/processSiteOperation", () => ({ processSiteOperation: mocks.operation }));

const contracts = fixture.siteLifecycle;
const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("published Sites examples without executing site operations", () => {
  it.each(["generation", "publishSaved", "publishPreview", "unpublish", "delete"] as const)(
    "preserves the documented %s body through HTTP and operation schemas",
    name => {
      const example = contracts.examples[name];
      expect(example).toBeDefined();
      expect(example).not.toBeNull();
      const { action, ...input } = actionSchema.parse(example);
      expect(action).toBe(name.startsWith("publish") ? "publish" : name);
      const parsed = siteOperationSchemas[action].parse({ id, ...input });
      expect(parsed).toEqual({ id, ...input });
      if (name === "publishPreview" || name === "delete") {
        expect(example).toHaveProperty("generationToken", "TOKEN_FROM_GENERATION");
      }
      if (name === "generation") expect(example).toHaveProperty("token", "TOKEN_FROM_GENERATION");
      if (name === "publishSaved") expect(example).not.toHaveProperty("generationToken");
      expect(mocks.operation).not.toHaveBeenCalled();
    },
  );

  it.each(["publish", "unpublish", "delete"] as const)(
    "%s requires a nonnegative revision",
    action => {
      expect(actionSchema.safeParse({ action }).success).toBe(false);
      expect(actionSchema.safeParse({ action, revision: -1 }).success).toBe(false);
    },
  );

  it("does not interchange polling and publication token field names", () => {
    expect(actionSchema.safeParse({ action: "generation" }).success).toBe(false);
    expect(actionSchema.safeParse({ action: "generation", token: "" }).success).toBe(false);
    expect(
      actionSchema.safeParse({ action: "generation", generationToken: "fixture" }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({ action: "publish", revision: 3, token: "fixture" }).success,
    ).toBe(false);
    const savedDraft = actionSchema.parse({ action: "publish", revision: 3 });
    expect(savedDraft).not.toHaveProperty("generationToken");
    const deletion = actionSchema.parse({ action: "delete", revision: 3 });
    expect(deletion).not.toHaveProperty("generationToken");
  });

  it("maps a synthetic upgrade error through the real HTTP adapter", async () => {
    expect(contracts.upgrade.status).toBe(402);
    expect(contracts.upgrade.body).not.toBeNull();
    expect(contracts.upgrade.body.error).toBeTypeOf("string");
    // Read the actual saved source message; do not invoke its subscription or setup calls.
    const source = readFileSync("lib/sites/fanConnection/prepareSiteFanConnection.ts", "utf8");
    const message = source.match(/throw new SiteError\(\s*402,\s*"([^"\n]+)"/)?.[1];
    expect(message, "Paid-gate message requires source reconciliation").toBeDefined();
    expect(contracts.upgrade.body).toEqual({ error: message });
    mocks.operation.mockRejectedValueOnce(new SiteError(402, message!));
    const response = await PATCH(
      new NextRequest(`https://example.invalid/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contracts.examples.publishPreview),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(contracts.upgrade.status);
    expect(await response.json()).toEqual(contracts.upgrade.body);
    expect(mocks.operation).toHaveBeenCalledExactlyOnceWith("fixture-caller", "publish", {
      id,
      revision: 3,
      generationToken: "TOKEN_FROM_GENERATION",
    });
  });

  it("rejects malformed mutation input before the mocked operation", async () => {
    const response = await PATCH(
      new NextRequest(`https://example.invalid/api/sites/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "publish" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.operation).not.toHaveBeenCalled();
  });

  it("accounts for each saved non-preflight route without treating callbacks as lifecycle actions", () => {
    const base = "app/api/sites";
    const operations: string[] = [];
    for (const file of readdirSync(base, { recursive: true }) as string[]) {
      if (!file.endsWith("route.ts")) continue;
      const directory = path.dirname(file).replaceAll("\\", "/");
      const route = `/api/sites${directory === "." ? "" : "/" + directory}`.replaceAll(
        "[id]",
        "{id}",
      );
      const source = readFileSync(path.join(base, file), "utf8");
      for (const match of source.matchAll(
        /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE|HEAD)\b/g,
      )) {
        operations.push(`${match[1]} ${route}`);
      }
    }
    expect(contracts.documentedOperations).toEqual([...new Set(operations)].sort());
    expect(contracts.callbackOperations).toEqual(["GET /api/sites/spotify/callback"]);
    expect(contracts.preflightExcluded).toBe(true);
    expect(mocks.operation).not.toHaveBeenCalled();
  });
});
