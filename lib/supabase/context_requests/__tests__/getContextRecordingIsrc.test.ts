import { beforeEach, expect, it, vi } from "vitest";
import { getContextRecordingIsrc } from "../getContextRecordingIsrc";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";

beforeEach(() => vi.clearAllMocks());

it("gets an ISRC only through the request-bound accepted-identity resolver", async () => {
  rpc.mockResolvedValue({ subjectId: subject, isrc: "USAT22103065" });
  await expect(getContextRecordingIsrc(owner, request, subject)).resolves.toBe("USAT22103065");
  expect(rpc).toHaveBeenCalledWith("resolve_context_recording_isrc", {
    p_owner: owner,
    p_request: request,
    p_subject: subject,
  });
});

it("fails closed when the accepted link is gone or a different subject is returned", async () => {
  rpc.mockRejectedValueOnce(new Error("Recording identity not confirmed for request"));
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow(/not confirmed/);
  rpc.mockResolvedValueOnce({ subjectId: owner, isrc: "USAT22103065" });
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow(/mismatch/);
});

it("rejects malformed resolver output and invalid request identifiers", async () => {
  rpc.mockResolvedValueOnce({ subjectId: subject, isrc: "bad" });
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow();
  await expect(getContextRecordingIsrc(owner, "invalid", subject)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
