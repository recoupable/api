import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import isActiveSubscription from "@/lib/stripe/isActiveSubscription";

export type SubscriptionSource = "account" | "organization" | null;

export interface SubscriptionResponse {
  /** True when the account or any of its organizations has an active subscription. */
  isPro: boolean;
  /** Where the active subscription is anchored. `null` when there is no active subscription. */
  source: SubscriptionSource;
  /** The active Stripe Subscription (account preferred over organization), or `null`. */
  subscription: Stripe.Subscription | null;
}

/**
 * Handles GET /api/subscription — returns the authenticated account's
 * active Stripe subscription (account preferred over org) along with a
 * derived `isPro` flag and `source` marker. Returns `subscription: null`
 * when the account has no active subscription anywhere.
 */
export async function getSubscriptionHandler(request: NextRequest): Promise<NextResponse> {
  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const [accountSubscription, orgSubscription] = await Promise.all([
      getActiveSubscriptionDetails(authContext.accountId),
      getOrgSubscription(authContext.accountId),
    ]);

    const accountActive = isActiveSubscription(accountSubscription);
    const orgActive = isActiveSubscription(orgSubscription);

    let subscription: Stripe.Subscription | null = null;
    let source: SubscriptionSource = null;
    if (accountActive) {
      subscription = accountSubscription ?? null;
      source = "account";
    } else if (orgActive) {
      subscription = orgSubscription ?? null;
      source = "organization";
    }

    const body: SubscriptionResponse = {
      isPro: accountActive || orgActive,
      source,
      subscription,
    };

    return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/subscription error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
