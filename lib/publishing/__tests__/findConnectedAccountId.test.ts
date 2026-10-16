import { describe, it, expect, vi } from "vitest";
import { findConnectedAccountId } from "../findConnectedAccountId";
import { getConnectors } from "@/lib/composio/connectors/getConnectors";

vi.mock("@/lib/composio/connectors/getConnectors", () => ({ getConnectors: vi.fn() }));

describe("findConnectedAccountId", () => {
  it("maps x to the twitter toolkit and returns the account's own connection", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "twitter", name: "X", isConnected: true, connectedAccountId: "ca_x" },
    ]);
    expect(await findConnectedAccountId("acct", "x")).toBe("ca_x");
    expect(getConnectors).toHaveBeenCalledWith("acct");
  });

  it("returns null for an inactive or missing connection", async () => {
    vi.mocked(getConnectors).mockResolvedValue([
      { slug: "youtube", name: "YouTube", isConnected: false, connectedAccountId: "ca_old" },
    ]);
    expect(await findConnectedAccountId("acct", "youtube")).toBeNull();
    expect(await findConnectedAccountId("acct", "instagram")).toBeNull();
  });
});
