/** The customer-facing api host, used by production and as the safe default. */
const PRODUCTION_API_URL = "https://api.recoupable.dev";

/**
 * The Recoup API base a sandbox should call back to.
 *
 * Sandboxed commands had no way to learn this, so skills hardcoded
 * `api.recoupable.dev` — which works in production and fails everywhere else:
 * a preview mints its Privy tokens against a different app, and production
 * rejects them with a 401 (measured 2026-09-03, recoupable/app#2052). The
 * sandbox has to talk to the deployment that spawned it.
 *
 * Production keeps the canonical domain rather than `VERCEL_URL` so the value
 * is stable across deploys; previews use their own deployment URL.
 *
 * @returns Origin with no trailing slash, so callers can append `/api`.
 */
export function getRecoupApiUrl(): string {
  const override = process.env.RECOUP_API_URL;
  if (override) return override.replace(/\/+$/, "");

  if (process.env.VERCEL_ENV === "production") return PRODUCTION_API_URL;

  const deploymentUrl = process.env.VERCEL_URL;
  if (deploymentUrl) return `https://${deploymentUrl.replace(/\/+$/, "")}`;

  return PRODUCTION_API_URL;
}
