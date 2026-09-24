import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

// Explicit opt-in against a disposable PostgreSQL fixture with DB PR77 staged.
// This test shares one connection and rolls back every row, even on failure.
it.skipIf(process.env.CONTEXT_LOCAL_ARTIST_DATABASE_TEST !== "1")(
  "saves a scoped artist entry through the authenticated API operation and real SQL",
  async () => {
    const child = spawn(
      "/opt/homebrew/opt/postgresql@17/bin/psql",
      [
        "-h",
        "127.0.0.1",
        "-p",
        process.env.CONTEXT_LOCAL_POSTGRES_PORT ?? "55440",
        "-d",
        "postgres",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let pending:
        | { marker: string; resolve: (value: string) => void; reject: (error: Error) => void }
        | undefined,
      buffer = "",
      errors = "";
    child.stdout.on("data", chunk => {
      buffer += chunk.toString();
      if (!pending || !buffer.includes(pending.marker)) return;
      const value = buffer.slice(0, buffer.indexOf(pending.marker)).trim();
      buffer = buffer.slice(buffer.indexOf(pending.marker) + pending.marker.length).trimStart();
      const current = pending;
      pending = undefined;
      current.resolve(value);
    });
    child.stderr.on("data", chunk => {
      errors += chunk.toString();
    });
    child.on("error", error => pending?.reject(error));
    child.on("exit", code => pending?.reject(new Error(`Local psql exited ${code}: ${errors}`)));
    const query = (sql: string) =>
      new Promise<string>((resolve, reject) => {
        if (pending) return reject(new Error("Concurrent fixture SQL is unsupported"));
        const marker = `END_${randomUUID().replaceAll("-", "")}`;
        pending = { marker, resolve, reject };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    const quote = (value: unknown) =>
      `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
    try {
      const owner = randomUUID(),
        artist = randomUUID(),
        outsider = randomUUID(),
        key = `artist-local-${randomUUID()}`;
      await query(
        `begin;create temporary table rpc_output(value jsonb) on commit drop;` +
          `insert into public.accounts(id,name) values(${quote(owner)},'Owner'),(${quote(artist)},'Fixture artist'),(${quote(outsider)},'Other workspace');` +
          `insert into public.account_artist_ids(account_id,artist_id) values(${quote(owner)},${quote(artist)});`,
      );
      const rpc = async (name: string, args: Record<string, unknown>) => {
        if (!["create_context_artist_request", "list_context_artist_request_target"].includes(name))
          throw new Error("Unexpected fixture RPC");
        const params = Object.entries(args)
          .map(([field, value]) => {
            if (!/^p_[a-z]+$/.test(field)) throw new Error("Unexpected RPC parameter");
            return `${field} => ${quote(value)}`;
          })
          .join(",");
        const raw = await query(
          `do $rpc$ begin begin insert into rpc_output select public.${name}(${params});` +
            `exception when others then insert into rpc_output values(jsonb_build_object('testError',SQLERRM));` +
            `end;end $rpc$;select value from rpc_output;truncate rpc_output;`,
        );
        const result = JSON.parse(raw);
        if (result.testError) throw new Error(result.testError);
        return result;
      };
      const dispatch = vi.fn();
      const input = { action: "ingest_artist", artist_id: artist, idempotency_key: key };
      const deps = {
        authorize: async () => ({ accountId: owner, ownerId: owner, organizationId: null }),
        rpc,
        dispatch,
      };
      const first = await processContextOperation(owner, input, deps);
      const again = await processContextOperation(owner, input, deps);
      if (!("request" in first) || !("request" in again)) throw new Error("Missing artist request");
      expect(first.request.status).toBe("partial");
      expect(again.request.id).toBe(first.request.id);
      const target = (await rpc("list_context_artist_request_target", {
        p_owner: owner,
        p_request: first.request.id,
      })) as { kind: string; identityConfirmed: boolean; availableFields: string[] };
      expect(target).toMatchObject({ kind: "artist", identityConfirmed: true });
      expect(target.availableFields).toContain("artist_account_link");
      await expect(
        processContextOperation(
          outsider,
          { ...input, idempotency_key: `${key}-other` },
          {
            ...deps,
            authorize: async () => ({
              accountId: outsider,
              ownerId: outsider,
              organizationId: null,
            }),
          },
        ),
      ).rejects.toThrow("Artist not linked to selected workspace");
      await query(
        `delete from public.account_artist_ids where account_id=${quote(owner)} and artist_id=${quote(artist)};`,
      );
      await expect(
        rpc("list_context_artist_request_target", { p_owner: owner, p_request: first.request.id }),
      ).rejects.toThrow();
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      if (child.exitCode === null) {
        await query("rollback;");
        child.stdin.end("\\q\n");
      }
    }
  },
  30000,
);
