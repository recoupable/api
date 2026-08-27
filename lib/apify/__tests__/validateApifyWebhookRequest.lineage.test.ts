import { describe, it, expect } from "vitest";
import { apifyWebhookPayloadSchema } from "../validateApifyWebhookRequest";

const base = {
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { id: "run_1", defaultDatasetId: "ds_1" },
};

describe("apifyWebhookPayloadSchema lineage fields", () => {
  it("accepts origin + parentRunId stamped by getApifyWebhooks", () => {
    const parsed = apifyWebhookPayloadSchema.parse({
      ...base,
      origin: "fan",
      parentRunId: "run_parent",
    });
    expect(parsed.origin).toBe("fan");
    expect(parsed.parentRunId).toBe("run_parent");
  });

  it("leaves origin undefined on a legacy payload (a run started before lineage shipped)", () => {
    const parsed = apifyWebhookPayloadSchema.parse(base);
    expect(parsed.origin).toBeUndefined();
    expect(parsed.parentRunId).toBeUndefined();
  });

  it("rejects an origin outside artist|fan", () => {
    expect(apifyWebhookPayloadSchema.safeParse({ ...base, origin: "bot" }).success).toBe(false);
  });
});
