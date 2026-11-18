import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { readFileSync, statSync, realpathSync } from "node:fs";
import pins from "./sources.json";
export const state = {
  calls: [] as { name: string; args: Record<string, unknown> }[],
  errors: [] as string[],
  denyWorkspace: false,
  beforePublish: undefined as undefined | (() => void),
  afterPublish: "",
};
export function resetTransport() {
  state.calls = [];
  state.errors = [];
  state.denyWorkspace = false;
  state.beforePublish = undefined;
  state.afterPublish = "";
}
export function literal(value: unknown): string {
  return value === null
    ? "NULL"
    : "'" +
        (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") +
        "'";
}
export function fixtureSql(sql: string) {
  const socket = process.env.SITES_BRIDGE_SOCKET;
  if (!socket || !isAbsolute(socket) || realpathSync(socket) !== socket)
    throw new Error("Owned absolute fixture socket required");
  const info = statSync(socket);
  if (info.uid !== process.getuid!() || (info.mode & 0o077) !== 0)
    throw new Error("Unowned fixture directory");
  const marker = JSON.parse(readFileSync(join(socket, "sites-bridge.json"), "utf8"));
  if (
    marker.offline_only !== true ||
    marker.database_commit !== pins.database_commit ||
    marker.socket !== socket
  )
    throw new Error("Invalid fixture marker");
  const result = spawnSync(
    process.env.SITES_BRIDGE_PSQL!,
    [
      "-h",
      socket,
      "-p",
      "55473",
      "-d",
      "postgres",
      "-U",
      marker.user,
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    {
      input: sql,
      encoding: "utf8",
      timeout: 15000,
      env: {
        PATH: process.env.PATH!,
        HOME: socket,
        LANG: "C",
        LC_ALL: "C",
        PGCLIENTENCODING: "UTF8",
        NODE_ENV: "test",
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Object.assign(new Error(result.stderr), {
      sqlstate: result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1],
    });
  return result.stdout.trim();
}
const keys: Record<string, string[]> = {
  record_evidence: [
    "p_actor",
    "p_owner",
    "p_site",
    "p_revision",
    "p_key",
    "p_candidate",
    "p_candidate_canonical",
    "p_candidate_sha",
    "p_decision",
    "p_review_canonical",
  ],
  read_evidence: ["p_actor", "p_owner", "p_site", "p_record"],
  publish_candidate: [
    "p_actor",
    "p_owner",
    "p_site",
    "p_revision",
    "p_record",
    "p_candidate_sha",
    "p_expected_pointer",
    "p_expected_artist_id",
  ],
};
export async function rpc(name: string, args: Record<string, unknown>) {
  if (
    !keys[name] ||
    JSON.stringify(Object.keys(args).sort()) !== JSON.stringify([...keys[name]].sort())
  )
    throw new Error("Unexpected RPC envelope");
  state.calls.push({ name, args: structuredClone(args) });
  if (name === "publish_candidate") state.beforePublish?.();
  let data: unknown;
  try {
    data = JSON.parse(
      fixtureSql(
        `SET ROLE service_role; SELECT sites_evidence_proposal.${name}(${keys[name].map(k => `${k} => ${literal(args[k])}`).join(",")});`,
      ),
    );
  } catch (error) {
    const code = (error as { sqlstate?: string }).sqlstate;
    if (!code) throw error;
    state.errors.push(code);
    return { data: null, error: { code } };
  }
  if (name === "publish_candidate") {
    if (state.afterPublish === "lost") throw new Error("Synthetic postcommit response loss");
    if (state.afterPublish === "tamper")
      (data as { humanApproval: string }).humanApproval = "approved";
    if (state.afterPublish === "null") data = null;
  }
  return { data, error: null };
}
