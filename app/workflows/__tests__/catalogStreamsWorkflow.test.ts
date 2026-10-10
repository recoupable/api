import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogStreamsWorkflow } from "../catalogStreamsWorkflow";
import { prepareCatalogStreamRunStep } from "../prepareCatalogStreamRunStep";
import { fetchCatalogStreamTrackStep } from "../fetchCatalogStreamTrackStep";
import { writeCatalogStreamTrackStep } from "../writeCatalogStreamTrackStep";
import { markCatalogStreamRunStep } from "../markCatalogStreamRunStep";
vi.mock("../prepareCatalogStreamRunStep", () => ({
  prepareCatalogStreamRunStep: vi
    .fn()
    .mockResolvedValue({ songs: [{ isrc: "USAAA2400001" }, { isrc: "USAAA2400002" }] }),
}));
vi.mock("../fetchCatalogStreamTrackStep", () => ({ fetchCatalogStreamTrackStep: vi.fn() }));
vi.mock("../writeCatalogStreamTrackStep", () => ({
  writeCatalogStreamTrackStep: vi.fn().mockResolvedValue(true),
}));
vi.mock("../markCatalogStreamRunStep", () => ({ markCatalogStreamRunStep: vi.fn() }));
describe("catalogStreamsWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCatalogStreamTrackStep).mockReset();
    vi.mocked(writeCatalogStreamTrackStep).mockResolvedValue(true);
  });
  it("stops a catalog-wide authentication failure before querying every song", async () => {
    vi.mocked(fetchCatalogStreamTrackStep).mockRejectedValueOnce(
      new Error("Luminate authentication unavailable (HTTP 403)"),
    );
    await catalogStreamsWorkflow("run");
    expect(fetchCatalogStreamTrackStep).toHaveBeenCalledTimes(1);
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith(
      "run",
      "failed",
      "provider_authentication_failed",
    );
    vi.clearAllMocks();
  });
  it("isolates exhausted provider failures and continues remaining songs", async () => {
    vi.mocked(fetchCatalogStreamTrackStep)
      .mockRejectedValueOnce(new Error("provider failed"))
      .mockResolvedValueOnce({ state: "unavailable" });
    await catalogStreamsWorkflow("run");
    expect(writeCatalogStreamTrackStep).toHaveBeenCalledWith("run", "USAAA2400001", {
      state: "failed",
    });
    expect(writeCatalogStreamTrackStep).toHaveBeenCalledWith("run", "USAAA2400002", {
      state: "unavailable",
    });
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith("run", "partial");
  });
  it("keeps exhausted temporary auth outages isolated", async () => {
    vi.mocked(fetchCatalogStreamTrackStep)
      .mockRejectedValueOnce(new Error("Luminate authentication temporarily unavailable"))
      .mockResolvedValueOnce({ state: "unavailable" });
    await catalogStreamsWorkflow("run");
    expect(fetchCatalogStreamTrackStep).toHaveBeenCalledTimes(2);
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith("run", "partial");
  });
  it("stops repeated recording authorization failure", async () => {
    vi.mocked(fetchCatalogStreamTrackStep).mockRejectedValueOnce(
      new Error("Luminate recording unavailable (HTTP 401)"),
    );
    await catalogStreamsWorkflow("run");
    expect(fetchCatalogStreamTrackStep).toHaveBeenCalledTimes(1);
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith(
      "run",
      "failed",
      "provider_authentication_failed",
    );
  });
  it("marks preparation revocation cancelled", async () => {
    vi.mocked(prepareCatalogStreamRunStep).mockRejectedValueOnce(
      new Error("Catalog stream run revoked"),
    );
    await catalogStreamsWorkflow("run");
    expect(fetchCatalogStreamTrackStep).not.toHaveBeenCalled();
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith("run", "cancelled");
  });
  it("stops after a revocation fence refuses a write", async () => {
    vi.clearAllMocks();
    vi.mocked(fetchCatalogStreamTrackStep).mockResolvedValue({ state: "unavailable" });
    vi.mocked(writeCatalogStreamTrackStep).mockResolvedValue(false);
    await catalogStreamsWorkflow("run");
    expect(fetchCatalogStreamTrackStep).toHaveBeenCalledTimes(1);
    expect(markCatalogStreamRunStep).toHaveBeenLastCalledWith("run", "cancelled");
  });
});
