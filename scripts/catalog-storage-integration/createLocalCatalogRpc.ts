import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  CatalogScheduleRpc,
  CatalogScheduleRpcIdentity,
} from "@/lib/supabase/catalog_report_schedules/CatalogScheduleRpc";
import type { DisabledCatalogScheduleCommand } from "@/lib/catalog/reports/management/disabledCatalogScheduleOperation";
interface LocalSetup {
  socket_dir: string;
  cluster: string;
  pg_bin: string;
  user: string;
  nonce: string;
  port: number;
}
type Args = CatalogScheduleRpcIdentity & {
  p_id?: string;
  p_request?: string;
  p_command?: DisabledCatalogScheduleCommand;
};
/** Test-only Unix-socket psql transport. Never imported by production code. */
export function createLocalCatalogRpc(setup: LocalSetup) {
  const socket = realpathSync(setup.socket_dir);
  const temporaryRoot = realpathSync(tmpdir());
  if (
    !socket.startsWith(temporaryRoot + path.sep) ||
    !path.basename(socket).startsWith("catalog-disabled-") ||
    setup.port !== 55476 ||
    readFileSync(path.join(socket, "integration-marker"), "utf8") !== setup.nonce
  ) {
    throw new Error("Disposable catalog cluster marker required");
  }
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("PG")) delete env[key];
  }
  const execute = (sql: string) =>
    spawnSync(
      path.join(setup.pg_bin, "psql"),
      [
        "-h",
        socket,
        "-p",
        String(setup.port),
        "-U",
        setup.user,
        "-d",
        "postgres",
        "-XqAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
      ],
      { input: sql, encoding: "utf8", env, timeout: 15000, maxBuffer: 1024 * 1024 },
    );
  const admin = (sql: string) => {
    const result = execute(sql);
    if (result.error || result.status !== 0)
      throw new Error(`Disposable SQL failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  if (realpathSync(admin("SHOW data_directory")) !== realpathSync(setup.cluster))
    throw new Error("Wrong disposable cluster");
  const major = Number(admin("SHOW server_version_num")) / 10000;
  if (Math.floor(major) !== 15 && Math.floor(major) !== 17)
    throw new Error("Only PostgreSQL15/17 qualified");
  const quote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
  const calls: { name: string; args: Args }[] = [];
  const transport: CatalogScheduleRpc = {
    async rpc(name: "read_catalog_report_schedule" | "mutate_catalog_report_schedule", args: Args) {
      calls.push({ name, args });
      const identity = `${quote(args.p_actor)}::uuid,${quote(JSON.stringify(args.p_principal))}::jsonb`;
      let sql: string;
      if (name === "read_catalog_report_schedule")
        sql = `SELECT public.read_catalog_report_schedule(${identity},${quote(args.p_id)}::uuid);`;
      else if (name === "mutate_catalog_report_schedule")
        sql = `SELECT public.mutate_catalog_report_schedule(${identity},${quote(args.p_request)}::uuid,${quote(JSON.stringify(args.p_command))}::jsonb);`;
      else throw new Error("Unsupported local RPC");
      const result = execute(`SET standard_conforming_strings=on; SET ROLE service_role; ${sql}`);
      if (result.error || result.status !== 0)
        return {
          data: null,
          error: {
            code: result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? "local_transport_failure",
          },
        };
      return { data: JSON.parse(result.stdout.trim()), error: null };
    },
  };
  return { transport, calls, admin };
}
