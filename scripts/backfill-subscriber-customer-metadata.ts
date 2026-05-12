/**
 * One-time backfill: stamp `metadata.accountId` onto Stripe Customers that
 * are linked to a Subscription with `metadata.accountId` but don't yet have
 * the same metadata on the Customer itself.
 *
 * Background: existing subscription Checkouts auto-created Customers without
 * stamping accountId metadata. The new credits auto-charge flow uses
 * `stripe.customers.search` by `metadata['accountId']`, so legacy Customers
 * need a one-time stamp to be discoverable.
 *
 * Idempotent: re-runs are safe. Skips Customers that are already stamped.
 *
 * Usage (run once, after PR 2a deploys):
 *   STRIPE_SK=sk_live_... npx tsx scripts/backfill-subscriber-customer-metadata.ts --dry-run
 *   STRIPE_SK=sk_live_... npx tsx scripts/backfill-subscriber-customer-metadata.ts
 */

import Stripe from "stripe";
import { shouldStampCustomerMetadata } from "./shouldStampCustomerMetadata";

const PAGE_LIMIT = 100;

type Stats = {
  subscriptions: number;
  missingAccountIdOnSub: number;
  customersInspected: number;
  customersStamped: number;
  customersAlreadyStamped: number;
  customersWithConflict: number;
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

async function backfill(): Promise<Stats> {
  const stats: Stats = {
    subscriptions: 0,
    missingAccountIdOnSub: 0,
    customersInspected: 0,
    customersStamped: 0,
    customersAlreadyStamped: 0,
    customersWithConflict: 0,
    errors: 0,
  };

  log(`Starting subscription scan (page size ${PAGE_LIMIT})`);

  for await (const sub of stripe.subscriptions.list({ limit: PAGE_LIMIT })) {
    stats.subscriptions += 1;
    const accountId = sub.metadata?.accountId;
    if (!accountId) {
      stats.missingAccountIdOnSub += 1;
      continue;
    }

    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    try {
      const retrieved = await stripe.customers.retrieve(customerId);
      if ("deleted" in retrieved && retrieved.deleted) {
        log(`Skipping deleted customer ${customerId}`);
        continue;
      }
      const customer = retrieved as Stripe.Customer;
      stats.customersInspected += 1;

      const decision = shouldStampCustomerMetadata(customer.metadata, accountId);
      if (decision.action === "skip" && decision.reason === "already-stamped") {
        stats.customersAlreadyStamped += 1;
        continue;
      }
      if (decision.action === "skip" && decision.reason === "conflict") {
        stats.customersWithConflict += 1;
        log(
          `Conflict: customer ${customerId} has metadata.accountId=${customer.metadata?.accountId} but subscription ${sub.id} says accountId=${accountId}. Skipping.`,
        );
        continue;
      }

      log(`Stamping customer ${customerId} with accountId=${accountId} (sub ${sub.id})`);
      if (!dryRun) {
        await stripe.customers.update(customerId, {
          metadata: { ...(customer.metadata ?? {}), accountId },
        });
      }
      stats.customersStamped += 1;
    } catch (error) {
      stats.errors += 1;
      log(`Error processing subscription ${sub.id} -> customer ${customerId}:`, error);
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
