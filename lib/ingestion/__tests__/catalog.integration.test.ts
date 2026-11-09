import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { processIngestionOperation } from "../processIngestionOperation";
import { executeIngestionJob } from "../executeIngestionJob";
import type { IngestionDependencies } from "../types";
const socket = process.env.INGESTION_CATALOG_TEST_SOCKET;
const suite = socket ? describe : describe.skip;
suite("real shared-database ingestion lifecycle", () => {
  let admin: Client;
  let gateway: Client;
  const actor = randomUUID(),
    org = randomUUID(),
    other = randomUUID();
  beforeAll(async () => {
    if (!socket || !/\/recoup-ingestion-[A-Za-z0-9_-]+$/.test(socket))
      throw new Error("Disposable ingestion test socket required");
    admin = new Client({ host: socket, port: 55489, database: "postgres" });
    gateway = new Client({ host: socket, port: 55489, database: "postgres" });
    await admin.connect();
    await admin.query("INSERT INTO public.accounts(id) SELECT unnest($1::uuid[])", [
      [actor, org, other],
    ]);
    await admin.query("INSERT INTO public.account_organization_ids VALUES ($1,$2)", [actor, org]);
    await gateway.connect();
    await gateway.query("SET ROLE service_role");
  });
  afterAll(async () => {
    await gateway?.end();
    await admin?.end();
  });
  it("ingests into the shared database, recovers lost acknowledgement and refuses another org", async () => {
    const objects = new Map<string, Uint8Array>();
    let loseAck = true;
    const deps: IngestionDependencies = {
      authorize: async (_actor, organization) => `organization/${organization}`,
      limit: async () => undefined,
      store: {
        read: async k => objects.get(k) ?? null,
        create: async (k, v) => {
          if (objects.has(k)) return false;
          objects.set(k, v);
          return true;
        },
      },
      dispatch: async () => undefined,
      acquire: async () => {
        throw new Error("No external source");
      },
      deliver: async () => {
        throw new Error("No external database");
      },
      catalog: async (account, organization, action, input) => {
        const result = await gateway.query(
          "SELECT public.ingestion_catalog_command($1,$2,$3,$4::jsonb) AS result",
          [account, organization, action, JSON.stringify(input)],
        );
        if (action === "complete" && loseAck) {
          loseAck = false;
          throw new Error("Acknowledgement lost");
        }
        return result.rows[0].result;
      },
    };
    const job = await processIngestionOperation(
      actor,
      {
        action: "create",
        organization_id: org,
        idempotency_key: "shared-income-1",
        source: {
          kind: "inline",
          filename: "income.csv",
          format: "csv",
          content_base64: Buffer.from("ID,Amount\n001,0.1\n002,0.2").toString("base64"),
        },
        contract: {
          version: "1",
          fields: [
            { name: "id", source: "ID", type: "string" },
            { name: "amount", source: "Amount", type: "decimal" },
          ],
          controls: [{ field: "amount", expected: "0.3" }],
        },
      },
      deps,
    );
    expect(job.dataset_id).toMatch(/^[a-f0-9-]{36}$/);
    await expect(executeIngestionJob(actor, org, job.job_id as string, deps)).rejects.toThrow(
      "Acknowledgement lost",
    );
    expect([...objects.keys()].some(k => k.endsWith("/result.json"))).toBe(false);
    await executeIngestionJob(actor, org, job.job_id as string, deps);
    const page = await processIngestionOperation(
      actor,
      { action: "records", organization_id: org, dataset_id: job.dataset_id, job_id: job.job_id },
      deps,
    );
    expect(page.records).toEqual([
      { row_number: 1, record: { id: "001", amount: "0.1" } },
      { row_number: 2, record: { id: "002", amount: "0.2" } },
    ]);
    await expect(
      processIngestionOperation(
        actor,
        {
          action: "records",
          organization_id: other,
          dataset_id: job.dataset_id,
          job_id: job.job_id,
        },
        deps,
      ),
    ).rejects.toThrow("Ingestion access denied");
    await admin.query("DELETE FROM public.account_organization_ids WHERE account_id=$1", [actor]);
    await expect(
      processIngestionOperation(
        actor,
        { action: "records", organization_id: org, dataset_id: job.dataset_id, job_id: job.job_id },
        deps,
      ),
    ).rejects.toThrow("Ingestion access denied");
  });
});
