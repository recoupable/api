import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchIngestionJob } from "../dispatchIngestionJob";
const mocks = vi.hoisted(() => ({ claim: vi.fn(), start: vi.fn() }));
vi.mock("../claimIngestionDispatch", () => ({ claimIngestionDispatch: mocks.claim }));
vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@/app/workflows/ingestion/ingestionWorkflow", () => ({
  ingestionWorkflow: () => undefined,
}));
describe("ingestion dispatch lease", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not fan out when a job already holds its dispatch lease", async () => {
    let claimed = false;
    mocks.claim.mockImplementation(async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    });
    await Promise.all(
      Array.from({ length: 10 }, () => dispatchIngestionJob("actor", undefined, "a".repeat(64))),
    );
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });
  it("does not forward private source bytes to workflow arguments", async () => {
    mocks.claim.mockResolvedValue(true);
    await dispatchIngestionJob("actor", undefined, "a".repeat(64));
    expect(mocks.start.mock.calls[0][1]).toEqual(["actor", undefined, "a".repeat(64)]);
  });
});
