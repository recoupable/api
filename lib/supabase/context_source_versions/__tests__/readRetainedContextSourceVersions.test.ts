import { ZodError } from "zod";
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
let batches = false;
let corrupt: ((table: string, ids: string[], rows: unknown[]) => unknown[]) | undefined;
const calls: { table: string; chain: Record<string, ReturnType<typeof vi.fn>> }[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  error = null;
  batches = false;
  corrupt = undefined;
  versionData = [versionRow];
  sourceData = [sourceRow];
  mocks.from.mockImplementation(table => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "in", "is", "limit"]) chain[method] = vi.fn(() => chain);
    chain.then = vi.fn(resolve => {
      let data = table === "context_source_versions" ? versionData : sourceData;
      const ids = chain.in.mock.calls[0]?.[1] as string[];
      if (batches) {
        if (ids.length > 200)
          return resolve({ data: null, error: { message: "request URI too long" } });
        data = (data as { id: string }[]).filter(row => ids.includes(row.id)).reverse();
        if (corrupt) data = corrupt(table, ids, data as unknown[]);
      }
      return resolve({ data, error });
    });
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
  const result = readRetainedContextSourceVersions(owner, [version]);
  await expect(result).rejects.toThrow("Retained Context sources unavailable");
  await expect(result).rejects.not.toThrow("private-storage-detail");
});
it("rejects invalid and over-limit selections before querying", async () => {
  for (const ids of [[], ["invalid"], Array.from({ length: 1001 }, () => version)])
    await expect(readRetainedContextSourceVersions(owner, ids)).rejects.toThrow(ZodError);
  expect(mocks.from).not.toHaveBeenCalled();
});

function populateLargeSelection() {
  const ids = Array.from(
    { length: 1000 },
    (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
  );
  versionData = ids.map((id, i) => ({
    ...versionRow,
    id,
    source_id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`,
  }));
  sourceData = (versionData as (typeof versionRow)[]).map(row => ({
    ...sourceRow,
    id: row.source_id,
  }));
  batches = true;
  return ids;
}
it("batches both lookups at 200 IDs and restores requested order across reversed responses", async () => {
  const ids = populateLargeSelection();
  expect(await readRetainedContextSourceVersions(owner, ids)).toEqual(
    ids.map(id => ({ id, fingerprint: "a".repeat(64) })),
  );
  expect(calls).toHaveLength(10);
  for (const call of calls) {
    expect(call.chain.in.mock.calls[0][1]).toHaveLength(200);
    expect(call.chain.limit).toHaveBeenCalledWith(200);
    expect(call.chain.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(call.chain.is).toHaveBeenCalledWith(
      call.table === "context_sources" ? "withdrawn_at" : "removed_at",
      null,
    );
  }
});
it.each([
  "missing version",
  "duplicate version",
  "foreign version",
  "missing source",
  "duplicate source",
  "withdrawn source",
])("rejects %s in later batches without returning a partial result", async mode => {
  const ids = populateLargeSelection();
  corrupt = (table, batchIds, rows) => {
    if (!batchIds.some(id => id.endsWith("000000000400"))) return rows;
    if (table === "context_source_versions") {
      if (mode === "missing version") return rows.slice(1);
      if (mode === "duplicate version") return [...rows.slice(1), rows[1]];
      if (mode === "foreign version")
        return [{ ...(rows[0] as object), owner_id: source }, ...rows.slice(1)];
    } else {
      if (mode === "missing source") return rows.slice(1);
      if (mode === "duplicate source") return [...rows.slice(1), rows[1]];
      if (mode === "withdrawn source")
        return [{ ...(rows[0] as object), withdrawn_at: "2026-11-16" }, ...rows.slice(1)];
    }
    return rows;
  };
  await expect(readRetainedContextSourceVersions(owner, ids)).rejects.toThrow(
    "Retained Context sources unavailable",
  );
});

it("deduplicates shared source records across version batches without dropping versions", async () => {
  const ids = populateLargeSelection();
  versionData = (versionData as (typeof versionRow)[]).map(row => ({ ...row, source_id: source }));
  sourceData = [sourceRow];
  expect(await readRetainedContextSourceVersions(owner, ids)).toHaveLength(1000);
  expect(calls.filter(call => call.table === "context_sources")).toHaveLength(1);
  expect(calls.at(-1)!.chain.in).toHaveBeenCalledWith("id", [source]);
});
it.each(["context_source_versions", "context_sources"])(
  "redacts a later %s batch error and returns no partial result",
  async table => {
    const ids = populateLargeSelection();
    corrupt = (current, batchIds, rows) => {
      if (current === table && batchIds.some(id => id.endsWith("000000000400")))
        error = { message: "private-storage-detail" };
      return rows;
    };
    const result = readRetainedContextSourceVersions(owner, ids);
    await expect(result).rejects.toThrow("Retained Context sources unavailable");
    await expect(result).rejects.not.toThrow("private-storage-detail");
    expect(calls.filter(call => call.table === table)).toHaveLength(3);
  },
);
