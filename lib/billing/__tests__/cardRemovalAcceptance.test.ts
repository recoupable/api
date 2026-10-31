import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCOUNT, API_KEY, createCardRemovalBackend } from "./fixtures/cardRemovalBackend";
import { deletePaymentMethodHandler } from "@/lib/billing/deletePaymentMethodHandler";
import { getPaymentMethodHandler } from "@/lib/billing/getPaymentMethodHandler";
import { getAutoTopUpHandler } from "@/lib/billing/getAutoTopUpHandler";
import { maybeAutoTopUp } from "@/lib/credits/maybeAutoTopUp";

const boundary = vi.hoisted(() => ({
  stripe: {
    customers: { search: vi.fn(), retrieve: vi.fn() },
    paymentMethods: { retrieve: vi.fn(), list: vi.fn(), detach: vi.fn() },
    paymentIntents: { create: vi.fn() },
  },
  database: { from: vi.fn() },
  email: { send: vi.fn() },
}));

// Only external clients are replaced. Authentication, handlers, selectors,
// settings adapters and the automatic purchase path retain their real code.
vi.mock("@/lib/stripe/client", () => ({ default: boundary.stripe }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: boundary.database }));
vi.mock("@/lib/emails/client", () => ({
  getResendClient: () => ({ emails: boundary.email }),
}));
vi.mock("@/lib/privy/client", () => ({
  default: new Proxy(
    {},
    {
      get: () => {
        throw new Error("Privy must not be contacted by API-key acceptance cases");
      },
    },
  ),
}));

let backend: ReturnType<typeof createCardRemovalBackend>;
const params = () => Promise.resolve({ id: ACCOUNT });
const request = (path: string, method = "GET", key = API_KEY) =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/${path}`, {
    method,
    headers: { "x-api-key": key },
  });
const removeCard = () => deletePaymentMethodHandler(request("payment-method", "DELETE"), params());
const settings = async () => {
  const response = await getAutoTopUpHandler(request("auto-top-up"), params());
  expect(response.status).toBe(200);
  return response.json();
};
const savedCard = async () => {
  const response = await getPaymentMethodHandler(request("payment-method"), params());
  expect(response.status).toBe(200);
  return response.json();
};

beforeEach(() => {
  vi.resetAllMocks();
  backend = createCardRemovalBackend();
  for (const group of ["customers", "paymentMethods", "paymentIntents"] as const) {
    Object.entries(boundary.stripe[group]).forEach(([method, mock]) => {
      mock.mockImplementation(backend.stripe[group][method]);
    });
  }
  Object.assign(boundary.stripe, {
    subscriptions: backend.stripe.subscriptions,
    invoices: backend.stripe.invoices,
  });
  boundary.database.from.mockImplementation(backend.supabase.from);
  boundary.email.send.mockImplementation(backend.email.send);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real HTTP is forbidden in billing acceptance");
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  expect(backend.forbiddenOperations).toEqual([]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  // The fixture rejects every subscription/invoice operation, including reads.
  expect(backend.subscriptions).toEqual([
    { id: "sub_fixture", status: "active", customer: "cus_current" },
  ]);
  expect(backend.invoices).toEqual([{ id: "in_fixture", status: "open", amount_due: 5000 }]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("card removal acceptance with synthetic providers", () => {
  it("can exercise the real automatic purchase path before card removal (positive control)", async () => {
    backend.addCard();

    await expect(maybeAutoTopUp({ accountId: ACCOUNT })).resolves.toEqual({
      kind: "charged",
      paymentIntentId: "pi_synthetic_only",
    });

    expect(boundary.stripe.paymentIntents.create).toHaveBeenCalledOnce();
    expect(boundary.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_current",
        payment_method: "pm_current",
        off_session: true,
      }),
      expect.any(Object),
    );
    expect(boundary.email.send).toHaveBeenCalledOnce();
  });

  it("immediately disables automatic purchases after 204 without erasing the other credit settings", async () => {
    backend.addCard();
    const before = structuredClone(backend.credits);

    const response = await removeCard();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect.soft(await settings()).toMatchObject({ account_id: ACCOUNT, enabled: false });
    expect.soft(backend.credits).toEqual({ ...before, auto_topup_enabled: false });
    expect(await savedCard()).toEqual({ account_id: ACCOUNT, card: null });
    await expect(maybeAutoTopUp({ accountId: ACCOUNT })).resolves.toEqual({ kind: "skipped" });
    expect(boundary.stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(boundary.email.send).not.toHaveBeenCalled();
  });

  it("leaves another customer's card intact but cannot automatically charge that fallback after removal", async () => {
    backend.addCard("cus_older", "pm_older", 1, "1111");
    backend.addCard();

    const response = await removeCard();

    expect(response.status).toBe(204);
    expect(backend.methods.map(({ id, customer }) => ({ id, customer }))).toEqual([
      { id: "pm_older", customer: "cus_older" },
      { id: "pm_current", customer: null },
    ]);
    // Characterize the existing selector, without inventing account-wide deletion.
    expect(await savedCard()).toMatchObject({ card: { last4: "1111" } });
    expect.soft(await settings()).toMatchObject({ enabled: false });
    await expect(maybeAutoTopUp({ accountId: ACCOUNT })).resolves.toEqual({ kind: "skipped" });
    expect(boundary.stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(boundary.email.send).not.toHaveBeenCalled();
  });

  it.each(["no customer", "no card", "non-card default"] as const)(
    "returns 404 for %s without a removal",
    async scenario => {
      backend.credits.auto_topup_enabled = false;
      if (scenario !== "no customer") {
        backend.addCard();
        if (scenario === "no card") {
          backend.methods[0].customer = null;
          backend.customers[0].invoice_settings.default_payment_method = null;
        } else {
          backend.methods[0].type = "us_bank_account";
          delete backend.methods[0].card;
        }
      }

      const response = await removeCard();

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "No payment method on file" });
      expect(boundary.stripe.paymentMethods.detach).not.toHaveBeenCalled();
      expect(boundary.stripe.paymentIntents.create).not.toHaveBeenCalled();
    },
  );

  it("reports a failed Stripe detachment as 500 and retains the card", async () => {
    backend.addCard();
    backend.faults.detach = true;

    const response = await removeCard();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(await savedCard()).toMatchObject({ card: { last4: "4242" } });
    expect(boundary.stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("does not claim successful removal when disabling automatic purchases cannot be saved", async () => {
    backend.addCard();
    backend.faults.settingsWrite = true;

    const response = await removeCard();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(boundary.stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("denies an unknown API key before Stripe or credit changes", async () => {
    backend.addCard();
    const before = structuredClone(backend.credits);

    const response = await deletePaymentMethodHandler(
      request("payment-method", "DELETE", "recoup_sk_unknown_synthetic_key"),
      params(),
    );

    expect(response.status).toBe(401);
    expect(backend.events).toEqual([]);
    expect(backend.credits).toEqual(before);
    expect(boundary.stripe.paymentMethods.detach).not.toHaveBeenCalled();
  });
});
