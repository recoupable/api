import "./denyNetwork.mjs";
import { vi, beforeEach, afterEach, expect } from "vitest";
import { createHmac } from "node:crypto";
if (
  process.env.PRIVY_PROJECT_SECRET !== "synthetic-registration-secret" ||
  process.env.REGISTRATION_DOTENV_POISON ||
  process.env.REGISTRATION_AMBIENT_POISON
)
  throw new Error("Isolated proposed registration runner required before auth imports");
const fixture = vi.hoisted(() => ({
  actor: "11111111-1111-4111-8111-111111111111",
  keyId: "22222222-2222-4222-8222-222222222222",
  key: "recoup_sk_synthetic_only",
  expires: null as string | null,
  keyPresent: true,
  accountPresent: true,
  privyValid: true,
  queries: [] as string[],
  sends: 0,
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from(table: string) {
      fixture.queries.push(table);
      if (!["account_api_keys", "account_emails"].includes(table))
        throw new Error("Forbidden fixture database effect");
      return {
        select(columns: string) {
          expect(columns).toBe("*");
          return {
            eq(field: string, hash: string) {
              expect(table).toBe("account_api_keys");
              expect(field).toBe("key_hash");
              return Promise.resolve({
                error: null,
                data:
                  fixture.keyPresent &&
                  hash ===
                    createHmac("sha256", "synthetic-registration-secret")
                      .update(fixture.key)
                      .digest("hex")
                    ? [{ id: fixture.keyId, account: fixture.actor, expires_at: fixture.expires }]
                    : [],
              });
            },
            in(field: string, values: string[]) {
              expect(table).toBe("account_emails");
              expect(field).toBe("email");
              expect(values).toEqual(["fixture@example.invalid"]);
              return Promise.resolve({
                error: null,
                data: fixture.accountPresent ? [{ account_id: fixture.actor }] : [],
              });
            },
          };
        },
      };
    },
  },
}));
vi.mock("@/lib/privy/client", () => ({
  default: {
    utils: () => ({
      auth: () => ({
        verifyAuthToken: async (token: string) => {
          if (!fixture.privyValid || token !== "synthetic-privy")
            throw new Error("Synthetic invalid token");
          return { app_id: "synthetic-app", issuer: "privy.io", user_id: "synthetic-subject" };
        },
      }),
    }),
  },
}));
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: () => {
    fixture.sends++;
    throw new Error("Forbidden email effect");
  },
}));
vi.mock("@/lib/stripe/client", () => ({
  default: new Proxy(
    {},
    {
      get() {
        throw new Error("Forbidden Stripe effect");
      },
    },
  ),
}));
beforeEach(() => {
  fixture.actor = "11111111-1111-4111-8111-111111111111";
  fixture.keyPresent = true;
  fixture.accountPresent = true;
  fixture.privyValid = true;
  fixture.expires = null;
  fixture.queries = [];
  fixture.sends = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (url !== "https://api.privy.io/v1/users/synthetic-subject")
        throw new Error("Uncontrolled synthetic fetch");
      return {
        ok: true,
        json: async () => ({
          id: "synthetic-subject",
          linked_accounts: [{ type: "email", address: "fixture@example.invalid" }],
        }),
      };
    }),
  );
});
afterEach(() => {
  expect(fixture.sends).toBe(0);
  expect(fixture.queries.every(t => ["account_api_keys", "account_emails"].includes(t))).toBe(true);
  vi.unstubAllGlobals();
});

export { fixture };
