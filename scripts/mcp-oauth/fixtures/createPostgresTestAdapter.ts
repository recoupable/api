import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { errors } from "oidc-provider";
import { createOAuthAdapter } from "../../../lib/oauth/createOAuthAdapter";
import { createOAuthCipher } from "../../../lib/oauth/createOAuthCipher";
import { createOAuthStore } from "../../../lib/supabase/oauth_provider_artifacts/createOAuthStore";

const execute = promisify(execFile);

/** Test-only bridge to an isolated Unix-socket cluster created by testPostgres.sh. */
export function createPostgresTestAdapter(namespace: string) {
  const socket = process.env.OAUTH_TEST_PG_SOCKET;
  const psql = process.env.OAUTH_TEST_PSQL;
  if (
    !psql ||
    !socket ||
    !/^\/(private\/)?tmp\/recoup-oauth-adapter\.[^/]+\/socket$/.test(socket)
  ) {
    throw new Error("Use testPostgres.sh to create an isolated OAuth test cluster");
  }
  const allowed = new Set([
    "oauth_store_upsert",
    "oauth_store_find",
    "oauth_store_consume",
    "oauth_store_destroy",
    "oauth_store_revoke_grant",
    "oauth_store_list_connections",
  ]);
  const store = createOAuthStore(async (name, args) => {
    if (!allowed.has(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key)))
      throw new Error("Unexpected fixture RPC");
    const literal = (value: string | number | null) =>
      value === null
        ? "NULL"
        : typeof value === "number"
          ? String(value)
          : `'${value.replaceAll("'", "''")}'`;
    const parameters = Object.entries(args)
      .map(([key, value]) => `${key} => ${literal(value)}`)
      .join(", ");
    const { stdout } = await execute(
      psql,
      [
        "-X",
        "-q",
        "-w",
        "-h",
        socket,
        "-p",
        "5432",
        "-U",
        "oauth_test_admin",
        "-d",
        "postgres",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `SET ROLE service_role; SELECT row_to_json(result) FROM (SELECT public.${name}(${parameters}) AS data) result`,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    return { data: JSON.parse(stdout).data, error: null };
  });
  return createOAuthAdapter({
    namespace,
    store,
    // Fixed synthetic test keys are never loaded by any production entry point.
    indexKey: Buffer.alloc(32, 1),
    cipher: createOAuthCipher({ activeKeyId: "fixture", keys: { fixture: Buffer.alloc(32, 2) } }),
    invalidGrant: () => new errors.InvalidGrant(),
  });
}
