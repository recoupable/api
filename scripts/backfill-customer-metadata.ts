/**
 * One-time backfill: stamp `metadata.accountId` onto Stripe Customers so the
 * credits auto-charge flow (PR 2b) can find them via `customers.search`.
 *
 * Resolves each Customer's accountId in two stages:
 *  1. **Subscription map** (authoritative) — built by scanning all Stripe
 *     subscriptions for `metadata.accountId`, indexed by `customer.id`.
 *  2. **Email lookup** (heuristic) — falls back to matching the Customer's
 *     email against `account_emails` in our DB. Catches ex-subscribers and
 *     non-subscriber Customers (trial users, manual/admin creates, etc.).
 *
 * Idempotent: re-runs are safe. Skips already-stamped Customers; logs
 * conflicts (existing different accountId) without overwriting.
 *
 * Usage (run once, after PR 2a deploys):
 *   SUPABASE_URL=... SUPABASE_KEY=... STRIPE_SK=sk_live_... \
 *     npx tsx scripts/backfill-customer-metadata.ts --dry-run
 *   SUPABASE_URL=... SUPABASE_KEY=... STRIPE_SK=sk_live_... \
 *     npx tsx scripts/backfill-customer-metadata.ts
 */

import Stripe from "stripe";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { resolveAccountIdForCustomer } from "./resolveAccountIdForCustomer";
import { shouldStampCustomerMetadata } from "./shouldStampCustomerMetadata";

const PAGE_LIMIT = 100;

type Stats = {
  customersScanned: number;
  customersAlreadyStamped: number;
  stampedViaSub: number;
  stampedViaEmail: number;
  conflicts: number;
  unresolved: number;
  errors: number;
};

const dryRun = process.argv.includes("--dry-run");

if (!process.env.STRIPE_SK) {
  console.error("Missing STRIPE_SK env var");
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SK);

const log = (...args: unknown[]) => {
  const prefix = dryRun ? "[dry-run]" : "[live]";
  console.log(prefix, ...args);
};

async function buildSubMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let subCount = 0;
  for await (const sub of stripe.subscriptions.list({ limit: PAGE_LIMIT })) {
    subCount += 1;
    const accountId = sub.metadata?.accountId;
    if (!accountId) continue;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    map.set(customerId, accountId);
  }
  log(
    `Subscription pass complete: ${subCount} subs scanned, ${map.size} customerId→accountId pairs indexed`,
  );
  return map;
}

async function backfill(): Promise<Stats> {
  const stats: Stats = {
    customersScanned: 0,
    customersAlreadyStamped: 0,
    stampedViaSub: 0,
    stampedViaEmail: 0,
    conflicts: 0,
    unresolved: 0,
    errors: 0,
  };

  const subMap = await buildSubMap();
  log(`Starting customer scan (page size ${PAGE_LIMIT})`);

  for await (const customer of stripe.customers.list({ limit: PAGE_LIMIT })) {
    stats.customersScanned += 1;
    try {
      if (customer.metadata?.accountId) {
        stats.customersAlreadyStamped += 1;
        continue;
      }

      const resolution = await resolveAccountIdForCustomer({
        customer,
        subMap,
        accountByEmail: selectAccountByEmail,
      });
      if (!resolution) {
        stats.unresolved += 1;
        log(`Unresolved: customer ${customer.id} (email=${customer.email ?? "none"}). Skipping.`);
        continue;
      }

      const decision = shouldStampCustomerMetadata(customer.metadata, resolution.accountId);
      if (decision.action === "skip") {
        // already-stamped was handled above; only "conflict" remains
        stats.conflicts += 1;
        log(
          `Conflict: customer ${customer.id} has metadata.accountId=${customer.metadata?.accountId} but resolved accountId=${resolution.accountId} via ${resolution.source}. Skipping.`,
        );
        continue;
      }

      log(
        `Stamping customer ${customer.id} accountId=${resolution.accountId} (source=${resolution.source})`,
      );
      if (!dryRun) {
        await stripe.customers.update(customer.id, {
          metadata: { ...(customer.metadata ?? {}), accountId: resolution.accountId },
        });
      }
      if (resolution.source === "subscription") stats.stampedViaSub += 1;
      else stats.stampedViaEmail += 1;
    } catch (error) {
      stats.errors += 1;
      log(`Error processing customer ${customer.id}:`, error);
    }
  }

  return stats;
}

backfill()
  .then(stats => {
    log("Done.", JSON.stringify(stats, null, 2));
    process.exit(stats.errors > 0 ? 2 : 0);
  })
  .catch(error => {
    console.error("Fatal:", error);
    process.exit(1);
  });
