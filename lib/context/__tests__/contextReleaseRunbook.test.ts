import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { contextOperationSchema } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

// The runbook is release documentation; these checks keep it in step with the shipped surface.
const runbookPath = resolve("docs/context-release-runbook.md");
const readRunbook = () => readFileSync(runbookPath, "utf8");
const token = (name: string) => "`" + name + "`";
const runtimeDirectories = [
  "lib/context",
  "app/api/context",
  "app/api/internal/context-guest-maintenance",
  "app/workflows/context",
  "app/workflows/contextGuest",
];

function listRuntimeSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : listRuntimeSources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const actions = contextOperationSchema.options.map(option => option.shape.action.value);
const purposes = [
  ...new Set(
    contextOperationSchema.options.flatMap(option => {
      const purpose = (option.shape as Record<string, unknown>).purpose;
      return purpose instanceof z.ZodEnum ? (purpose.options as string[]) : [];
    }),
  ),
];
const runtimeFlags = [
  ...new Set(
    runtimeDirectories
      .flatMap(directory => listRuntimeSources(resolve(directory)))
      .flatMap(file => [
        ...readFileSync(file, "utf8").matchAll(/process\.env\.(CONTEXT_[A-Z0-9_]+)/g),
      ])
      .map(match => match[1]),
  ),
].sort();

describe("Context release runbook", () => {
  it("names every shared HTTP/MCP action literal", () => {
    const runbook = readRunbook();
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(runbook, action).toContain(token(action));
  });

  it("names every runtime CONTEXT_* switch read outside tests", () => {
    const runbook = readRunbook();
    expect(runtimeFlags).toContain("CONTEXT_GUEST_ENABLED");
    for (const flag of runtimeFlags) expect(runbook, flag).toContain(token(flag));
  });

  it("names every brief purpose", () => {
    const runbook = readRunbook();
    expect(purposes).toContain("company_onboarding");
    for (const purpose of purposes) expect(runbook, purpose).toContain(token(purpose));
  });

  it("states the merge order, the rollback rule and the unperformed hosted steps", () => {
    const runbook = readRunbook();
    expect(runbook).toContain("docs → database → api → app");
    expect(runbook).toContain("never drop");
    expect(runbook).toContain("not performed in this PR");
  });
});
