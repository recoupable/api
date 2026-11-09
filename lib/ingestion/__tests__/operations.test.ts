import { describe, expect, it } from "vitest";
import { processIngestionOperation } from "../processIngestionOperation";
import { executeIngestionJob } from "../executeIngestionJob";
import type { IngestionDependencies } from "../types";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const input = {
  action: "create",
  idempotency_key: "import-1",
  source: {
    kind: "inline",
    filename: "test.csv",
    format: "csv",
    content_base64: Buffer.from("ID\n001").toString("base64"),
  },
  contract: { version: "1", fields: [{ name: "id", source: "ID", type: "string" }] },
};
function harness() {
  const objects = new Map<string, Uint8Array>();
  let allowed = true;
  const deps: IngestionDependencies = {
    limit: async () => undefined,
    catalog: async () => ({ dataset_id: other }),
    authorize: async (actor, organization) => {
      if (!allowed) throw new Error("Access denied");
      return organization ? `organization/${organization}` : `account/${actor}`;
    },
    store: {
      read: async key => objects.get(key) ?? null,
      create: async (key, bytes) => {
        if (objects.has(key)) return false;
        objects.set(key, bytes);
        return true;
      },
    },
    dispatch: async () => undefined,
    acquire: async () => {
      throw new Error("Not configured");
    },
    deliver: async () => ({ committed: true, rows: 1 }),
  };
  return {
    objects,
    deps,
    revoke: () => {
      allowed = false;
    },
  };
}
describe("ingestion operations", () => {
  it("refuses noncanonical base64 and oversized decoded sources before capture", async () => {
    const { deps, objects } = harness();
    await expect(
      processIngestionOperation(
        owner,
        { ...input, source: { ...input.source, content_base64: "AB==" } },
        deps,
      ),
    ).rejects.toThrow("Invalid base64");
    await expect(
      processIngestionOperation(
        owner,
        {
          ...input,
          source: {
            ...input.source,
            content_base64: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
          },
        },
        deps,
      ),
    ).rejects.toThrow("Source size limit");
    expect(objects.size).toBe(0);
  });
  it("checks request limits before source acquisition or object creation", async () => {
    const { deps, objects } = harness();
    deps.limit = async () => {
      throw new Error("Ingestion request limit reached");
    };
    await expect(processIngestionOperation(owner, input, deps)).rejects.toThrow(
      "Ingestion request limit reached",
    );
    expect(objects.size).toBe(0);
  });
  it("converges concurrent creation and resumes after dispatch failure without recapturing", async () => {
    const { deps, objects } = harness();
    let attempts = 0;
    deps.dispatch = async () => {
      if (++attempts === 1) throw new Error("dispatcher unavailable");
    };
    await expect(processIngestionOperation(owner, input, deps)).rejects.toThrow();
    const captured = [...objects].map(([key, bytes]) => [
      key,
      Buffer.from(bytes).toString("base64"),
    ]);
    const jobs = await Promise.all([
      processIngestionOperation(owner, input, deps),
      processIngestionOperation(owner, input, deps),
    ]);
    expect(
      [...objects].map(([key, bytes]) => [key, Buffer.from(bytes).toString("base64")]),
    ).toEqual(captured);
    expect(jobs[0].job_id).toBe(jobs[1].job_id);
    await executeIngestionJob(owner, undefined, jobs[0].job_id, deps);
    expect(
      (await processIngestionOperation(owner, { action: "read", job_id: jobs[0].job_id }, deps))
        .status,
    ).toBe("ready");
  });
  it("recovers a crash between stage persistence and the completion marker", async () => {
    const { deps } = harness();
    const job = await processIngestionOperation(owner, input, deps);
    const originalCreate = deps.store.create;
    let failed = false;
    deps.store.create = async (key, bytes) => {
      if (key.endsWith("/result.json") && !failed) {
        failed = true;
        throw new Error("storage interruption");
      }
      return originalCreate(key, bytes);
    };
    await expect(executeIngestionJob(owner, undefined, job.job_id, deps)).rejects.toThrow();
    await executeIngestionJob(owner, undefined, job.job_id, deps);
    expect(
      (await processIngestionOperation(owner, { action: "read", job_id: job.job_id }, deps)).status,
    ).toBe("ready");
  });
  it("withholds a read when organization access is revoked during storage access", async () => {
    const h = harness();
    const job = await processIngestionOperation(
      owner,
      { ...input, organization_id: other },
      h.deps,
    );
    await executeIngestionJob(owner, other, job.job_id, h.deps);
    const read = h.deps.store.read;
    h.deps.store.read = async key => {
      const bytes = await read(key);
      if (key.endsWith("/result.json")) h.revoke();
      return bytes;
    };
    await expect(
      processIngestionOperation(
        owner,
        { action: "read", organization_id: other, job_id: job.job_id },
        h.deps,
      ),
    ).rejects.toThrow("Access denied");
  });
  it("captures originals privately, processes durable artifacts and reads only the authenticated scope", async () => {
    const { deps, objects } = harness();
    const job = await processIngestionOperation(owner, input, deps);
    expect(job.status).toBe("queued");
    await executeIngestionJob(owner, undefined, job.job_id, deps);
    const read = await processIngestionOperation(
      owner,
      { action: "read", job_id: job.job_id },
      deps,
    );
    expect(read.status).toBe("ready");
    expect([...objects.keys()].every(k => k.startsWith(`account/${owner}/`))).toBe(true);
    await expect(
      processIngestionOperation(other, { action: "read", job_id: job.job_id }, deps),
    ).rejects.toThrow();
    const gold = await processIngestionOperation(
      owner,
      { action: "artifact", job_id: job.job_id, stage: "gold" },
      deps,
    );
    expect(gold.artifact.records).toEqual([{ id: "001" }]);
  });
  it("binds idempotency to input and survives repeated execution", async () => {
    const { deps, objects } = harness();
    const a = await processIngestionOperation(owner, input, deps);
    expect((await processIngestionOperation(owner, input, deps)).job_id).toBe(a.job_id);
    await expect(
      processIngestionOperation(
        owner,
        { ...input, contract: { ...input.contract, version: "2" } },
        deps,
      ),
    ).rejects.toThrow();
    await executeIngestionJob(owner, undefined, a.job_id, deps);
    const snapshot = [...objects].map(([k, v]) => [k, Buffer.from(v).toString()]);
    await executeIngestionJob(owner, undefined, a.job_id, deps);
    expect([...objects].map(([k, v]) => [k, Buffer.from(v).toString()])).toEqual(snapshot);
  });
  it("rechecks authorization in the background and before returning private data", async () => {
    const h = harness();
    const job = await processIngestionOperation(owner, input, h.deps);
    h.revoke();
    await expect(executeIngestionJob(owner, undefined, job.job_id, h.deps)).rejects.toThrow(
      "Access denied",
    );
    expect([...h.objects.keys()].some(k => k.endsWith("/result.json"))).toBe(false);
  });
  it("requires exact gold selection for delivery and withholds held outputs", async () => {
    const { deps } = harness();
    const job = await processIngestionOperation(owner, input, deps);
    await executeIngestionJob(owner, undefined, job.job_id, deps);
    await expect(
      processIngestionOperation(
        owner,
        {
          action: "deliver",
          job_id: job.job_id,
          destination_id: "test",
          gold_sha256: "0".repeat(64),
        },
        deps,
      ),
    ).rejects.toThrow();
    const read = await processIngestionOperation(
      owner,
      { action: "read", job_id: job.job_id },
      deps,
    );
    const receipt = await processIngestionOperation(
      owner,
      {
        action: "deliver",
        job_id: job.job_id,
        destination_id: "test",
        gold_sha256: read.gold_sha256,
      },
      deps,
    );
    expect(receipt.receipt.committed).toBe(true);
  });
  it("rejects malformed and impersonating requests", async () => {
    const { deps } = harness();
    for (const value of [
      { ...input, account_id: other },
      { ...input, source: { ...input.source, content_base64: "!!!" } },
    ])
      await expect(processIngestionOperation(owner, value, deps)).rejects.toThrow();
  });
});
