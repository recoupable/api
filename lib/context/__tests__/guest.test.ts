import { describe, it, expect, vi } from "vitest";
import { processGuestContext } from "../guest/processGuestContext";
import { runGuestContext } from "../guest/runGuestContext";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const token = "a".repeat(64),
  url = "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB";
describe("guest context ownership", () => {
  it("stores only a hashed capability and normalized metadata-only input", async () => {
    const rpc = vi.fn(async () => ({ id: "guest" })),
      dispatch = vi.fn();
    await processGuestContext(token, { action: "start", url: url + "?si=tracking" }, null, {
      rpc,
      dispatch,
      dailyLimit: 100,
    });
    expect(rpc).toHaveBeenCalledWith(
      "start_context_guest",
      expect.objectContaining({
        p_hash: expect.not.stringMatching(token),
        p_input: {
          url,
          trackId: "2ay96C6SLNv9urvXKD3ecB",
          topics: ["release_metadata", "artist_metadata"],
        },
      }),
    );
    expect(dispatch).toHaveBeenCalledWith("guest");
  });
  it("requires login and organization authorization before claiming", async () => {
    const rpc = vi.fn(),
      dispatch = vi.fn(),
      authorize = vi.fn(async () => {
        throw Error("denied");
      });
    await expect(
      processGuestContext(token, { action: "claim" }, null, { rpc, dispatch, dailyLimit: 100 }),
    ).rejects.toThrow("Sign in");
    await expect(
      processGuestContext(
        token,
        { action: "claim", organization_id: "11111111-1111-4111-8111-111111111111" },
        "actor",
        { rpc, dispatch, authorize, dailyLimit: 100 },
      ),
    ).rejects.toThrow("denied");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps the guest worker when claiming instead of starting another extraction", async () => {
    const rpc = vi.fn(async () => ({ guestId: "guest", requestId: "request" })),
      dispatch = vi.fn();
    await processGuestContext(token, { action: "claim" }, "actor", {
      rpc,
      dispatch,
      authorize: vi.fn(async () => ({
        ownerId: "actor",
        accountId: "actor",
        organizationId: null,
      })),
      dailyLimit: 100,
    });
    expect(dispatch).toHaveBeenCalledWith("guest");
  });
  it("does not accept caller-selected owners or paid modules", async () => {
    const deps = { rpc: vi.fn(), dispatch: vi.fn(), dailyLimit: 100 };
    await expect(
      processGuestContext(token, { action: "start", url, owner_id: "victim" }, null, deps),
    ).rejects.toThrow();
    await expect(
      processGuestContext(token, { action: "start", url, topics: ["lyrics"] }, null, deps),
    ).rejects.toThrow();
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it("skips duplicate workers without fetching", async () => {
    const extract = vi.fn();
    await runGuestContext("guest", { rpc: vi.fn(async () => null), extract, authorize: vi.fn() });
    expect(extract).not.toHaveBeenCalled();
  });
  it("rechecks destination access after extraction if signup happened meanwhile", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "claim_context_guest_worker"
        ? { input: { trackId: "track" } }
        : name === "context_guest_worker_scope"
          ? { actor: "actor", owner: "org" }
          : true,
    );
    const authorize = vi.fn(async () => {
      throw Error("revoked");
    });
    await expect(
      runGuestContext("guest", { rpc, extract: vi.fn(async () => ({}) as never), authorize }),
    ).rejects.toThrow("revoked");
    expect(rpc.mock.calls.some(([name]) => name === "complete_context_guest")).toBe(false);
  });
});
