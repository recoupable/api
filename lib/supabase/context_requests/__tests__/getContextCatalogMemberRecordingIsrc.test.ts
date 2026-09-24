import { expect, it, vi } from "vitest";
import { getContextCatalogMemberRecordingIsrc } from "../getContextCatalogMemberRecordingIsrc";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";

it("reads one current request-bound recording ISRC", async () => {
  rpc.mockResolvedValue({ subjectId: subject, isrc: "USAT22103065" });
  await expect(getContextCatalogMemberRecordingIsrc(owner, request, subject)).resolves.toBe(
    "USAT22103065",
  );
  expect(rpc).toHaveBeenCalledWith("resolve_context_catalog_member_recording", {
    p_owner: owner,
    p_request: request,
    p_recording: subject,
  });
});

it("rejects a different subject or malformed identity", async () => {
  rpc.mockResolvedValueOnce({ subjectId: owner, isrc: "USAT22103065" });
  await expect(getContextCatalogMemberRecordingIsrc(owner, request, subject)).rejects.toThrow(
    /mismatch/,
  );
  rpc.mockResolvedValueOnce({ subjectId: subject, isrc: "bad" });
  await expect(getContextCatalogMemberRecordingIsrc(owner, request, subject)).rejects.toThrow();
});
