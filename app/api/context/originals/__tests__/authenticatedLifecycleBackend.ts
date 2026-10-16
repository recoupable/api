import { expect, vi } from "vitest";
const backend = vi.hoisted(() => ({
  actor: "11111111-1111-4111-8111-111111111111",
  owner: "22222222-2222-4222-8222-222222222222",
  source: "33333333-3333-4333-8333-333333333333",
  member: true,
  withdrawn: false,
  loseAck: false,
  revokeOnDownload: false,
  withdrawOnDownload: false,
  keyHash: "",
  path: "",
  stored: undefined as Blob | undefined,
  saved: undefined as Record<string, unknown> | undefined,
  uploads: 0,
  registrations: 0,
  admissions: 0,
}));
vi.mock("@/lib/const", () => ({ PRIVY_PROJECT_SECRET: "synthetic-secret" }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: () => {
    throw new Error("Privy must not be called");
  },
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        then: (resolve: (value: unknown) => void) =>
          resolve({
            error: null,
            data:
              table === "account_api_keys"
                ? filters.key_hash === backend.keyHash
                  ? [{ account: backend.actor, expires_at: null }]
                  : []
                : table === "account_organization_ids" &&
                    backend.member &&
                    filters.account_id === backend.actor &&
                    filters.organization_id === backend.owner
                  ? [{ account_id: backend.actor, organization_id: backend.owner }]
                  : [],
          }),
      };
      return query;
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "consume_oauth_rate_limit") {
        // Synthetic admissions represent requests in permitted windows; not a limiter algorithm test.
        backend.admissions++;
        return { abortSignal: async () => ({ data: 0, error: null }) };
      }
      return (async () => {
        if (!backend.member || backend.withdrawn || args.p_owner !== backend.owner)
          return { data: null, error: { message: "synthetic scope denied" } };
        if (name === "register_context_original") {
          expect(args.p_actor).toBe(backend.actor);
          expect(args.p_source).toBe(backend.source);
          expect(args.p_key).toBe("synthetic-work");
          expect(args.p_storage_path).toBe(backend.path);
          backend.registrations++;
          backend.saved ??= {
            id: "44444444-4444-4444-8444-444444444444",
            owner_id: args.p_owner,
            source_id: args.p_source,
            source_version_id: "55555555-5555-4555-8555-555555555555",
            fingerprint: args.p_sha256,
            bytes: args.p_bytes,
            media_type: args.p_media_type,
            status: "registered",
            evidence_kind: "customer_assertion",
            created_at: "2026-10-10T00:00:00Z",
          };
          if (backend.loseAck) {
            backend.loseAck = false;
            throw new Error("synthetic lost acknowledgment");
          }
          return { data: backend.saved, error: null };
        }
        if (!backend.saved || args.p_receipt !== backend.saved.id)
          return { data: null, error: { message: "synthetic missing receipt" } };
        return {
          data:
            name === "get_context_original_retrieval"
              ? { ...backend.saved, bucket: "context-private", storage_path: backend.path }
              : backend.saved,
          error: null,
        };
      })();
    },
    storage: {
      from: (bucket: string) => {
        if (bucket !== "context-private") throw new Error("wrong bucket");
        return {
          upload: async (path: string, file: Blob, options: { upsert: boolean }) => {
            expect(options.upsert).toBe(false);
            backend.uploads++;
            if (backend.stored) return { data: null, error: new Error("exists") };
            backend.path = path;
            backend.stored = file;
            return { data: { path }, error: null };
          },
          download: async (path: string) => ({
            data: path === backend.path ? backend.stored : null,
            error: null,
          }),
        };
      },
    },
  },
}));

export { backend };
