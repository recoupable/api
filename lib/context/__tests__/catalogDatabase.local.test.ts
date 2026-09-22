import { z } from "zod";
import { collectContextCatalogEstimate } from "../enrichment/collectContextCatalogEstimate";
import { collectContextCatalogValuation } from "../providers/collectContextCatalogValuation";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

// Explicit opt-in: local fixture only. One connection, transaction and unconditional rollback.
it.skipIf(process.env.CONTEXT_LOCAL_DATABASE_TEST !== "1")(
  "runs catalog domain operation through local SQL with fixture auth",
  async () => {
    const child = spawn(
      "/opt/homebrew/bin/psql",
      [
        "-h",
        "127.0.0.1",
        "-p",
        "55439",
        "-d",
        "context_final",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let pending:
        | { marker: string; resolve: (s: string) => void; reject: (e: Error) => void }
        | undefined,
      buffer = "",
      errors = "";
    child.stdout.on("data", chunk => {
      buffer += chunk.toString();
      if (pending && buffer.includes(pending.marker)) {
        const text = buffer.slice(0, buffer.indexOf(pending.marker)).trim();
        buffer = buffer.slice(buffer.indexOf(pending.marker) + pending.marker.length).trimStart();
        const p = pending;
        pending = undefined;
        p.resolve(text);
      }
    });
    child.stderr.on("data", chunk => {
      errors += chunk.toString();
    });
    child.on("error", error => pending?.reject(error));
    child.on("exit", code => pending?.reject(new Error(`Local psql exited ${code}: ${errors}`)));
    const query = (sql: string) =>
      new Promise<string>((resolve, reject) => {
        if (pending) return reject(new Error("Concurrent test SQL not supported"));
        const marker = "END_" + randomUUID().replaceAll("-", "");
        pending = { marker, resolve, reject };
        child.stdin.write(sql + "\n\\echo " + marker + "\n");
      });
    const quote = (value: unknown) =>
      "'" +
      (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") +
      "'";
    try {
      const root = resolve("../../database/context-provider-evidence/supabase/migrations");
      const read = (name: string) => readFileSync(resolve(root, name), "utf8");
      const catalogMigration = read("20260922070000_context_catalog_entry.sql")
        .replace("begin;\n", "")
        .replace(/commit;\s*$/, "");
      await query(
        "begin;\n" +
          read("20250129222308_updated_at_trigger_function.sql").split("alter table")[0] +
          read("20251005212508_create_catalogs_table.sql") +
          read("20251005214926_create_account_catalogs_table.sql") +
          read("20260922060000_context_provider_evidence.sql")
            .replace("begin;\n", "")
            .replace(/commit;\s*$/, "") +
          catalogMigration +
          "\ncreate temporary table rpc_output(value jsonb) on commit drop;",
      );
      const owner = await query("select owner_id from public.context_requests limit 1;");
      const catalog = randomUUID(),
        other = randomUUID(),
        key = "catalog-local-" + randomUUID();
      await query(
        `insert into public.catalogs(id,name) values(${quote(catalog)},'Fixture catalog'),(${quote(other)},'Other fixture');insert into public.account_catalogs(account,catalog) values(${quote(owner)},${quote(catalog)}),(${quote(owner)},${quote(other)});`,
      );
      const rpc = async (name: string, args: Record<string, unknown>) => {
        if (
          ![
            "create_catalog_context_request",
            "resolve_context_catalog",
            "claim_context_enrichment",
            "complete_context_enrichment",
            "fail_context_enrichment",
          ].includes(name)
        )
          throw new Error("Unexpected RPC");
        const params = Object.entries(args)
          .map(([key, value]) => {
            if (!/^p_[a-z]+$/.test(key)) throw new Error("Unexpected parameter");
            return key + " => " + quote(value);
          })
          .join(",");
        const raw = await query(
          `do $rpc$ begin begin insert into rpc_output select public.${name}(${params});exception when others then insert into rpc_output values(jsonb_build_object('testError',SQLERRM));end;end $rpc$;select value from rpc_output;truncate rpc_output;`,
        );
        const value = JSON.parse(raw);
        if (value.testError) throw new Error(value.testError);
        return value;
      };
      const deps = {
        authorize: async () => ({ accountId: owner, ownerId: owner, organizationId: null }),
        rpc,
        dispatch: vi.fn(),
      };
      const input = { action: "ingest_catalog", catalog_id: catalog, idempotency_key: key };
      const first = await processContextOperation(owner, input, deps),
        again = await processContextOperation(owner, input, deps);
      expect(first).toHaveProperty("request.status", "partial");
      expect(again).toHaveProperty("request.id", "request" in first ? first.request.id : null);
      await expect(
        processContextOperation(owner, { ...input, catalog_id: other }, deps),
      ).rejects.toThrow("different input");
      if (!("request" in first)) throw new Error("Missing request");
      const request = z
        .object({ id: z.uuid(), output: z.object({ subjectIds: z.array(z.uuid()).min(1) }) })
        .parse(first.request);
      const collect = vi.fn(async () =>
        collectContextCatalogValuation(owner, catalog, {
          authorize: async () => {},
          aggregate: async () => ({ measuredSongCount: 1, totalStreams: 100 }),
          songCount: async () => 3,
          earliestDate: async () => null,
        }),
      );
      const valuationInput = {
        subjectId: request.output.subjectIds[0],
        collectionVersion: "fixture-v1",
      };
      const saved = await collectContextCatalogEstimate(owner, owner, request.id, valuationInput, {
        ...deps,
        collect,
      });
      expect(saved).toHaveProperty("state", "saved");
      expect(
        await collectContextCatalogEstimate(owner, owner, request.id, valuationInput, {
          ...deps,
          collect,
        }),
      ).toHaveProperty("state", "reused");
      expect(collect).toHaveBeenCalledOnce();
      const kind = await query(
        `select evidence_kind from public.context_results where subject_id=${quote(valuationInput.subjectId)} and topic='catalog_valuation';`,
      );
      expect(kind).toBe("estimate");
      await query(
        `delete from public.account_catalogs where account=${quote(owner)} and catalog=${quote(catalog)};`,
      );
      await expect(processContextOperation(owner, input, deps)).rejects.toThrow("not accessible");
      await expect(
        collectContextCatalogEstimate(owner, owner, request.id, valuationInput, {
          ...deps,
          collect,
        }),
      ).rejects.toThrow("not accessible");
      expect(deps.dispatch).not.toHaveBeenCalled();
    } finally {
      if (child.exitCode === null) {
        await query("rollback;");
        child.stdin.end("\\q\n");
      }
    }
  },
  30000,
);
