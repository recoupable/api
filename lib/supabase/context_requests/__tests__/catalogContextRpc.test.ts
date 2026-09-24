import { beforeEach, expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import { processContextOperation } from "@/lib/context/processContextOperation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
const catalog = "00000000-0000-4000-8000-000000000002";
const dispatch = vi.fn();
const ingest = () =>
  processContextOperation(
    account,
    { action: "ingest_catalog", catalog_id: catalog, idempotency_key: "catalog-test" },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch,
    },
  );
beforeEach(() => vi.clearAllMocks());
it("passes authorized catalog ingestion through the real database adapter", async () => {
  rpc.mockResolvedValue({ data: { id: "request", status: "partial" }, error: null });
  const result = await ingest();
  expect(rpc).toHaveBeenCalledWith("create_catalog_context_request", {
    p_owner: account,
    p_actor: account,
    p_catalog: catalog,
    p_key: "catalog-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});
it("passes a linked artist entry through the scoped RPC without dispatching providers", async () => {
  rpc.mockResolvedValue({ data: { id: "artist-request", status: "partial" }, error: null });
  const result = await processContextOperation(
    account,
    { action: "ingest_artist", artist_id: catalog, idempotency_key: "artist-test" },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch,
    },
  );
  expect(rpc).toHaveBeenCalledWith("create_context_artist_request", {
    p_owner: account,
    p_actor: account,
    p_artist: catalog,
    p_key: "artist-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});
it("passes a Spotify album entry through the scoped RPC without dispatching a track worker", async () => {
  const album = "3vX9jU6Ix8t7XsAWLoZs10";
  rpc.mockResolvedValue({ data: { id: "release-request", status: "partial" }, error: null });
  const result = await processContextOperation(
    account,
    {
      action: "ingest_release",
      url: `https://open.spotify.com/album/${album}`,
      idempotency_key: "release-test",
    },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch,
    },
  );
  expect(rpc).toHaveBeenCalledWith("create_context_release_request", {
    p_owner: account,
    p_actor: account,
    p_album: album,
    p_key: "release-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});
it("propagates database permission failures without dispatching work", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "Catalog access denied" } });
  await expect(ingest()).rejects.toThrow("Context storage operation failed: Catalog access denied");
  expect(dispatch).not.toHaveBeenCalled();
});
it("continues rejecting operations outside the context allowlist", async () => {
  await expect(callContextRpc("unrelated_operation", {})).rejects.toThrow(
    "Unknown context operation",
  );
  expect(rpc).not.toHaveBeenCalled();
});
it("allows the scoped release identity lookup without widening to arbitrary operations", async () => {
  rpc.mockResolvedValue({ data: { releaseId: "3vX9jU6Ix8t7XsAWLoZs10" }, error: null });
  const params = { p_owner: account, p_request: catalog, p_subject: catalog };
  await expect(callContextRpc("resolve_context_spotify_release", params)).resolves.toEqual({
    releaseId: "3vX9jU6Ix8t7XsAWLoZs10",
  });
  expect(rpc).toHaveBeenCalledWith("resolve_context_spotify_release", params);
});
it("allows the exact enrichment lifecycle and release review RPCs", async () => {
  rpc.mockResolvedValue({ data: {}, error: null });
  const names = [
    "claim_context_enrichment",
    "complete_context_enrichment",
    "fail_context_enrichment",
    "save_context_spotify_release_track_slots",
    "list_context_release_track_slots",
    "review_context_release_track_identities",
  ];
  for (const name of names) await callContextRpc(name, { p_owner: account });
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(names);
});
