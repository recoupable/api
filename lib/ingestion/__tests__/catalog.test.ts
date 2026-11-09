import { beforeEach, describe, expect, it, vi } from "vitest";
import { processIngestionOperation } from "../processIngestionOperation";
import { executeIngestionJob } from "../executeIngestionJob";
import { readIngestionQuery } from "../readIngestionQuery";
import type { IngestionDependencies } from "../types";
const actor = "11111111-1111-4111-8111-111111111111";
const organization = "22222222-2222-4222-8222-222222222222";
const dataset = "33333333-3333-4333-8333-333333333333";
const create = {
  action: "create",
  organization_id: organization,
  idempotency_key: "test-import",
  source: {
    kind: "inline",
    filename: "income.csv",
    format: "csv",
    content_base64: Buffer.from("ID,Amount\n001,0.3").toString("base64"),
  },
  contract: {
    version: "1",
    fields: [
      { name: "id", source: "ID", type: "string" },
      { name: "amount", source: "Amount", type: "decimal" },
    ],
  },
};
function harness() {
  const objects = new Map<string, Uint8Array>();
  const catalog = vi.fn().mockResolvedValue({ dataset_id: dataset });
  const dispatch = vi.fn();
  const deps: IngestionDependencies = {
    authorize: async (_actor, org) => (org ? `organization/${org}` : `account/${actor}`),
    limit: async () => undefined,
    store: {
      read: async k => objects.get(k) ?? null,
      create: async (k, v) => {
        if (objects.has(k)) return false;
        objects.set(k, v);
        return true;
      },
    },
    dispatch,
    catalog,
    acquire: async () => {
      throw new Error("Not configured");
    },
    deliver: async () => ({ committed: true, rows: 1 }),
  };
  return { objects, catalog, dispatch, deps };
}
describe("organization ingestion catalog", () => {
  beforeEach(() => vi.clearAllMocks());
  it("registers imports in the shared database before dispatch and returns their dataset", async () => {
    const h = harness();
    const job = await processIngestionOperation(actor, create, h.deps);
    expect(job.dataset_id).toBe(dataset);
    expect(h.catalog).toHaveBeenCalledWith(
      actor,
      organization,
      "register",
      expect.objectContaining({
        manifest: expect.objectContaining({
          scope: `organization/${organization}`,
          filename: "income.csv",
        }),
      }),
    );
    expect(h.catalog.mock.invocationCallOrder[0]).toBeLessThan(
      h.dispatch.mock.invocationCallOrder[0],
    );
  });
  it("publishes exact gold rows into Recoup automatically when processing succeeds", async () => {
    const h = harness();
    const job = await processIngestionOperation(actor, create, h.deps);
    await executeIngestionJob(actor, organization, job.job_id, h.deps);
    const complete = h.catalog.mock.calls.find(c => c[2] === "complete");
    expect(complete?.slice(0, 3)).toEqual([actor, organization, "complete"]);
    expect(complete?.[3]).toMatchObject({
      job_id: job.job_id,
      result: { status: "ready", rows_output: 1 },
      gold: { records: [{ id: "001", amount: "0.3" }] },
    });
  });
  it("records held imports without publishing any gold rows", async () => {
    const h = harness();
    const job = await processIngestionOperation(
      actor,
      {
        ...create,
        contract: { ...create.contract, controls: [{ field: "amount", expected: "1" }] },
      },
      h.deps,
    );
    await executeIngestionJob(actor, organization, job.job_id, h.deps);
    expect(h.catalog.mock.calls.find(c => c[2] === "complete")?.[3]).toMatchObject({
      result: { status: "held", rows_output: 0 },
      gold: null,
    });
  });
  it("keeps an import retryable when shared-database completion is unavailable", async () => {
    const h = harness();
    const job = await processIngestionOperation(actor, create, h.deps);
    h.catalog.mockImplementation(async (_actor, _org, action) => {
      if (action === "complete") throw new Error("Catalog unavailable");
      return { dataset_id: dataset };
    });
    await expect(executeIngestionJob(actor, organization, job.job_id, h.deps)).rejects.toThrow(
      "Catalog unavailable",
    );
    expect([...h.objects.keys()].some(k => k.endsWith("/result.json"))).toBe(false);
    h.catalog.mockResolvedValue({ dataset_id: dataset });
    await executeIngestionJob(actor, organization, job.job_id, h.deps);
    expect([...h.objects.keys()].some(k => k.endsWith("/result.json"))).toBe(true);
  });
  it("repairs the shared catalog when replaying an already completed private import", async () => {
    const h = harness();
    const job = await processIngestionOperation(actor, create, h.deps);
    await executeIngestionJob(actor, organization, job.job_id, h.deps);
    h.catalog.mockClear();
    h.dispatch.mockClear();
    await processIngestionOperation(actor, create, h.deps);
    expect(h.catalog.mock.calls.some(c => c[2] === "complete")).toBe(true);
    expect(h.dispatch).not.toHaveBeenCalled();
  });
  it("binds the selected dataset to the immutable import contract", async () => {
    const h = harness();
    const job = await processIngestionOperation(actor, { ...create, dataset_id: dataset }, h.deps);
    const manifest = JSON.parse(
      Buffer.from(
        h.objects.get(`organization/${organization}/${job.job_id}/manifest.json`)!,
      ).toString(),
    );
    expect(manifest.dataset_id).toBe(dataset);
    await expect(
      processIngestionOperation(actor, { ...create, dataset_id: actor }, h.deps),
    ).rejects.toThrow("Idempotency conflict");
    await expect(
      processIngestionOperation(
        actor,
        { ...create, organization_id: undefined, dataset_id: dataset },
        h.deps,
      ),
    ).rejects.toThrow();
  });
  it("lists datasets and immutable import rows only through the authenticated organization", async () => {
    const h = harness();
    h.catalog.mockResolvedValue({
      records: [{ row_number: 1, record: { id: "001" } }],
      next_after: null,
    });
    const result = await processIngestionOperation(
      actor,
      {
        action: "records",
        organization_id: organization,
        dataset_id: dataset,
        job_id: "a".repeat(64),
        limit: 25,
        after_row: 0,
      },
      h.deps,
    );
    expect(result.records).toHaveLength(1);
    expect(h.catalog).toHaveBeenCalledWith(actor, organization, "records", {
      dataset_id: dataset,
      job_id: "a".repeat(64),
      limit: 25,
      after_row: 0,
    });
    await expect(
      processIngestionOperation(actor, { action: "datasets" }, h.deps),
    ).rejects.toThrow();
  });
  it("adapts read-only catalog queries without allowing GET mutations", () => {
    expect(
      readIngestionQuery(
        `https://test/api/ingestion?action=datasets&organization_id=${organization}&limit=10`,
      ),
    ).toEqual({ action: "datasets", organization_id: organization, limit: 10 });
    expect(() => readIngestionQuery("https://test/api/ingestion?action=create")).toThrow();
  });
});
