import { beforeEach, expect, it, vi } from "vitest";
import { getContextRecordingIsrc } from "../getContextRecordingIsrc";
const { rpc, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("../../serverClient", () => ({ default: { rpc, from } }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subject = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ eq, maybeSingle });
  rpc.mockResolvedValue({
    data: { owner_id: owner, status: "completed", output: { subjectIds: [subject] } },
    error: null,
  });
  maybeSingle.mockResolvedValue({ data: { song_isrc: "USAT22103065" }, error: null });
});
it("loads only the recording attached to the selected owner request", async () => {
  await expect(getContextRecordingIsrc(owner, request, subject)).resolves.toBe("USAT22103065");
  expect(rpc).toHaveBeenCalledWith("read_context_request", { p_owner: owner, p_request: request });
  expect(eq).toHaveBeenCalledWith("id", subject);
  expect(eq).toHaveBeenCalledWith("kind", "recording");
});
it.each([
  null,
  { owner_id: request, status: "completed", output: { subjectIds: [subject] } },
  { owner_id: owner, status: "cancelled", output: { subjectIds: [subject] } },
  { owner_id: owner, status: "completed", output: { subjectIds: [] } },
])("rejects inaccessible requests before reading shared recording identity", async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow();
  expect(from).not.toHaveBeenCalled();
});
it("rejects a missing recording or failed database lookup", async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow();
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
  await expect(getContextRecordingIsrc(owner, request, subject)).rejects.toThrow();
});
