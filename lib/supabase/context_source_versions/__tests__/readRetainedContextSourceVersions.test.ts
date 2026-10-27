import { beforeEach, expect, it, vi } from "vitest";
import { readRetainedContextSourceVersions } from "../readRetainedContextSourceVersions";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: mocks.from } }));
const owner = "11111111-1111-4111-8111-111111111111";
const version = "22222222-2222-4222-8222-222222222222";
const source = "33333333-3333-4333-8333-333333333333";
const versionRow = {
  id: version,
  owner_id: owner,
  source_id: source,
  fingerprint: "a".repeat(64),
  removed_at: null,
};
const sourceRow = { id: source, owner_id: owner, withdrawn_at: null };
let versionData: unknown;
let sourceData: unknown;
let error: unknown;
const calls: { table: string; chain: Record<string, ReturnType<typeof vi.fn>> }[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  error = null;
  versionData = [versionRow];
  sourceData = [sourceRow];
  mocks.from.mockImplementation(table => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "in", "is", "limit"]) chain[method] = vi.fn(() => chain);
    chain.then = vi.fn(resolve =>
      resolve({ data: table === "context_source_versions" ? versionData : sourceData, error }),
    );
    calls.push({ table, chain });
    return chain;
  });
});
it("loads only exact retained versions and active owner-bound sources, without source content", async () => {
  expect(await readRetainedContextSourceVersions(owner, [version])).toEqual([
    { id: version, fingerprint: "a".repeat(64) },
  ]);
  expect(calls.map(c => c.table)).toEqual(["context_source_versions", "context_sources"]);
  expect(calls[0].chain.in).toHaveBeenCalledWith("id", [version]);
  expect(calls[1].chain.in).toHaveBeenCalledWith("id", [source]);
  for (const call of calls) {
    expect(call.chain.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(call.chain.select.mock.calls[0][0]).not.toMatch(/content|storage_path|source_url|\*/);
  }
  expect(calls[0].chain.is).toHaveBeenCalledWith("removed_at", null);
  expect(calls[1].chain.is).toHaveBeenCalledWith("withdrawn_at", null);
});
it.each([
  "missing version",
  "foreign version",
  "removed version",
  "bad fingerprint",
  "missing source",
  "foreign source",
  "withdrawn source",
  "query error",
  "duplicate version",
])("rejects %s without fallback", async mode => {
  if (mode === "missing version") versionData = [];
  if (mode === "foreign version") versionData = [{ ...versionRow, owner_id: source }];
  if (mode === "removed version") versionData = [{ ...versionRow, removed_at: "2026-10-26" }];
  if (mode === "bad fingerprint") versionData = [{ ...versionRow, fingerprint: "bad" }];
  if (mode === "missing source") sourceData = [];
  if (mode === "foreign source") sourceData = [{ ...sourceRow, owner_id: source }];
  if (mode === "withdrawn source") sourceData = [{ ...sourceRow, withdrawn_at: "2026-10-26" }];
  if (mode === "query error") error = { message: "private-storage-detail" };
  if (mode === "duplicate version") versionData = [versionRow, versionRow];
  await expect(readRetainedContextSourceVersions(owner, [version])).rejects.toThrow();
});
it("rejects invalid and over-limit selections before querying", async () => {
  for (const ids of [[], ["invalid"], Array.from({ length: 1001 }, () => version)])
    await expect(readRetainedContextSourceVersions(owner, ids)).rejects.toThrow();
  expect(mocks.from).not.toHaveBeenCalled();
});
