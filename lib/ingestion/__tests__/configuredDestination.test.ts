import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverConfiguredIngestion } from "../deliverConfiguredIngestion";
const mocks = vi.hoisted(() => ({ on: vi.fn(), connect: vi.fn(), end: vi.fn(), deliver: vi.fn() }));
vi.mock("pg", () => ({
  Client: class {
    on = mocks.on;
    connect = mocks.connect;
    end = mocks.end;
  },
}));
vi.mock("../deliverIngestionToPostgres", () => ({ deliverIngestionToPostgres: mocks.deliver }));
const scope = "account/11111111-1111-4111-8111-111111111111";
const config = {
  id: "db",
  scope,
  connection_env: "INGESTION_DB_TEST",
  database_id: "33333333-3333-4333-8333-333333333333",
  schema: "public",
  table: "income",
  columns: ["id"],
  mode: "append",
};
const gold = {
  engine_version: "1",
  contract_version: "1",
  records: [{ id: "001" }],
  field_types: { id: "string" as const },
};
describe("configured destination boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_DESTINATIONS_JSON", JSON.stringify([config]));
    vi.stubEnv("INGESTION_DB_TEST", "postgresql://test:secret@database.example/test");
    mocks.deliver.mockResolvedValue({ committed: true, rows: 1 });
  });
  function store() {
    const objects = new Map<string, Uint8Array>();
    return {
      read: async (k: string) => objects.get(k) ?? null,
      create: async (k: string, b: Uint8Array) => {
        if (objects.has(k)) return false;
        objects.set(k, b);
        return true;
      },
    };
  }
  it("attaches a safe error listener before connecting", async () => {
    await deliverConfiguredIngestion(scope, "db", "a".repeat(64), gold, "b".repeat(64), store());
    expect(mocks.on.mock.calls[0][0]).toBe("error");
    expect(() => mocks.on.mock.calls[0][1](new Error("connection dropped"))).not.toThrow();
  });
  it("refuses rebinding one destination ID to another logical database", async () => {
    const storage = store();
    await deliverConfiguredIngestion(scope, "db", "a".repeat(64), gold, "b".repeat(64), storage);
    vi.stubEnv(
      "INGESTION_DESTINATIONS_JSON",
      JSON.stringify([{ ...config, database_id: "44444444-4444-4444-8444-444444444444" }]),
    );
    await expect(
      deliverConfiguredIngestion(scope, "db", "a".repeat(64), gold, "b".repeat(64), storage),
    ).rejects.toThrow("Artifact conflict");
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });
});
