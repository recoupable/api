#!/usr/bin/env bash
set -euo pipefail
# Requires an explicit migration file from the owning database checkout. Never uses DATABASE_URL.
migration="${1:?Pass the OAuth store migration SQL path}"
test -f "$migration"
pg_bin="${PG_BINDIR:-$(dirname "$(command -v initdb)")}"
cluster_root="$(mktemp -d /tmp/recoup-oauth-adapter.XXXXXX)"
cleanup() {
  "$pg_bin/pg_ctl" -D "$cluster_root/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$cluster_root"
}
trap cleanup EXIT
mkdir "$cluster_root/socket"
"$pg_bin/initdb" -D "$cluster_root/data" -A trust -U oauth_test_admin --no-locale >"$cluster_root/init.log"
"$pg_bin/pg_ctl" -D "$cluster_root/data" -l "$cluster_root/server.log" -o "-k $cluster_root/socket -p 5432 -h ''" start >/dev/null
export OAUTH_TEST_PSQL="$pg_bin/psql"
export OAUTH_TEST_PG_SOCKET="$cluster_root/socket"
psql_args=(-X -w -h "$cluster_root/socket" -p 5432 -U oauth_test_admin -d postgres -v ON_ERROR_STOP=1)
"$pg_bin/psql" "${psql_args[@]}" -c 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;' >/dev/null
"$pg_bin/psql" "${psql_args[@]}" -f "$migration" >/dev/null
shift
for additional_migration in "$@"; do
  "$pg_bin/psql" "${psql_args[@]}" -f "$additional_migration" >/dev/null
done
"$pg_bin/pg_ctl" --version
"${OAUTH_TEST_NODE:-node}" node_modules/vitest/vitest.mjs run --config vitest.oauth.config.ts
