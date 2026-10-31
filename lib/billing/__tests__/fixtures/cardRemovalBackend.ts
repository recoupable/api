import { createHmac } from "node:crypto";
import type { CreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

export const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
export const API_KEY = "recoup_sk_card_removal_acceptance_only";

type Customer = {
  id: string;
  created: number;
  invoice_settings: { default_payment_method: string | null };
};
type PaymentMethod = {
  id: string;
  customer: string | null;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    funding: string;
  };
};

/** In-memory provider state. Real handlers, selectors and DB adapters run above it. */
export function createCardRemovalBackend() {
  const customers: Customer[] = [];
  const methods: PaymentMethod[] = [];
  const events: { operation: string; args: unknown }[] = [];
  const credits: CreditsUsage = {
    id: 1,
    account_id: ACCOUNT,
    remaining_credits: 0,
    timestamp: "2026-10-20T00:00:00.000Z",
    auto_topup_enabled: true,
    auto_topup_amount: 100_000,
    auto_topup_threshold: 10_000,
    auto_topup_last_run_at: null,
    auto_topup_last_error: null,
  };
  const subscriptions = [{ id: "sub_fixture", status: "active", customer: "cus_current" }];
  const invoices = [{ id: "in_fixture", status: "open", amount_due: 5000 }];
  const faults = { detach: false, settingsWrite: false };
  const forbiddenOperations: string[] = [];
  const unexpected = (operation: string): never => {
    forbiddenOperations.push(operation);
    throw new Error(`Unexpected external operation: ${operation}`);
  };
  const protectedResource = (name: string) =>
    new Proxy({}, { get: (_, property) => () => unexpected(`${name}.${String(property)}`) });
  const clone = <T>(value: T): T => structuredClone(value);
  const findCustomer = (id: string) => {
    const customer = customers.find(value => value.id === id);
    if (!customer) throw new Error("Unknown synthetic customer");
    return customer;
  };
  const findMethod = (id: string) => {
    const method = methods.find(value => value.id === id);
    if (!method) throw new Error("Unknown synthetic payment method");
    return method;
  };

  return {
    customers,
    methods,
    credits,
    subscriptions,
    invoices,
    faults,
    events,
    forbiddenOperations,
    addCard(customerId = "cus_current", methodId = "pm_current", created = 2, last4 = "4242") {
      customers.push({
        id: customerId,
        created,
        invoice_settings: { default_payment_method: methodId },
      });
      methods.push({
        id: methodId,
        customer: customerId,
        type: "card",
        card: {
          brand: "visa",
          last4,
          exp_month: 12,
          exp_year: 2030,
          funding: "credit",
        },
      });
    },
    stripe: {
      customers: {
        search: async (args: { query: string }) => {
          events.push({ operation: "customers.search", args });
          if (args.query !== `metadata['accountId']:'${ACCOUNT}'`) {
            return unexpected("customer search outside the fixture account");
          }
          return { data: clone(customers), has_more: false };
        },
        retrieve: async (id: string) => clone(findCustomer(id)),
      },
      paymentMethods: {
        retrieve: async (id: string) => clone(findMethod(id)),
        list: async ({ customer }: { customer: string }) => ({
          data: clone(
            methods.filter(method => method.customer === customer && method.type === "card"),
          ),
        }),
        detach: async (id: string) => {
          events.push({ operation: "paymentMethods.detach", args: id });
          if (faults.detach) throw new Error("Synthetic Stripe failure: private detail");
          const method = findMethod(id);
          const customer = findCustomer(method.customer!);
          method.customer = null;
          if (customer.invoice_settings.default_payment_method === id) {
            customer.invoice_settings.default_payment_method = null;
          }
          return clone(method);
        },
      },
      paymentIntents: {
        create: async (args: unknown) => {
          events.push({ operation: "paymentIntents.create", args });
          return { id: "pi_synthetic_only", status: "succeeded" };
        },
      },
      subscriptions: protectedResource("subscriptions"),
      invoices: protectedResource("invoices"),
    },
    email: {
      send: async (args: unknown) => {
        events.push({ operation: "emails.send", args });
        return { data: { id: "email_synthetic_only" }, error: null };
      },
    },
    supabase: {
      from(table: string) {
        if (!["account_api_keys", "credits_usage", "account_emails"].includes(table)) {
          return unexpected(`database table ${table}`);
        }
        const filters = new Map<string, unknown>();
        let updates: Partial<CreditsUsage> | undefined;
        const execute = (single = false) => {
          let rows: Record<string, unknown>[];
          if (table === "account_api_keys") {
            rows = [
              {
                account: ACCOUNT,
                key_hash: createHmac("sha256", "test-secret").update(API_KEY).digest("hex"),
                expires_at: null,
              },
            ];
          } else if (table === "account_emails") {
            rows = [{ account_id: ACCOUNT, email: "billing@example.invalid" }];
          } else {
            rows = [credits];
          }
          rows = rows.filter(row => [...filters].every(([key, value]) => row[key] === value));
          if (updates) {
            if (table !== "credits_usage") return unexpected(`database write ${table}`);
            events.push({ operation: "credits_usage.update", args: clone(updates) });
            if (faults.settingsWrite) {
              return { data: null, error: new Error("Synthetic database write failure") };
            }
            rows.forEach(row => Object.assign(row, updates));
          }
          return { data: clone(single ? (rows[0] ?? null) : rows), error: null };
        };
        const query = {
          select: () => query,
          update: (value: Partial<CreditsUsage>) => {
            updates = value;
            return query;
          },
          eq: (column: string, value: unknown) => {
            filters.set(column, value);
            return query;
          },
          in: (column: string, values: unknown[]) => {
            if (values.length !== 1) return unexpected("database fixture multi-value filter");
            filters.set(column, values[0]);
            return query;
          },
          single: async () => execute(true),
          then: (resolve: (result: ReturnType<typeof execute>) => unknown) =>
            Promise.resolve(execute()).then(resolve),
        };
        return query;
      },
    },
  };
}
