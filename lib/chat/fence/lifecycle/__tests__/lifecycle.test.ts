import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { stopFencedChatWorkflow } from "../stopFencedChatWorkflow";
import { resumeFencedChatStream } from "../resumeFencedChatStream";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
const target = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
  phase: "running" as const,
  runId: "original-run",
};
const current = {
  chat_id: "chat",
  epoch: 1,
  owner: target.owner,
  phase: "running",
  run_id: target.runId,
};
const url = new URL("https://api.test/stream?startIndex=3");
const cancel = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  rpc.mockImplementation(async (_name, args) => ({
    data: args.p_action === "state" ? current : { released: true },
    error: null,
  }));
  vi.mocked(getRun).mockReturnValue({ cancel, status: Promise.resolve("cancelled") } as never);
});
afterEach(() => vi.useRealTimers());
it("pending resume preserves ownership with zero SQL/SDK effects", async () => {
  expect(
    (await resumeFencedChatStream({ ...target, phase: "pending", runId: null }, url)).status,
  ).toBe(503);
  expect(getRun).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("pending Stop closes atomically using only captured original authority", async () => {
  const pending = { ...target, phase: "pending" as const, runId: null };
  rpc.mockImplementation(async () => {
    pending.epoch = 2;
    pending.owner = "55555555-5555-4555-8555-555555555555";
    return { data: { closed: true }, error: null };
  });
  const response = await stopFencedChatWorkflow(pending);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, stopped: true });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", {
    p_chat: target.chatId,
    p_account: target.effectiveAccount,
    p_action: "close_unattempted",
    p: { epoch: 1, owner: target.owner },
  });
  expect(getRun).not.toHaveBeenCalled();
});
it.each([
  { closed: false },
  {},
  { closed: "true" },
  { closed: true, extra: 1 },
  { released: true },
  null,
  "transport",
  "sql",
])("pending Stop cannot derive cleanup permission from %j", async receipt => {
  rpc.mockImplementation(async () => {
    if (receipt === "transport") throw new Error("lost committed close acknowledgement");
    return receipt === "sql"
      ? { data: null, error: { code: "42501" } }
      : { data: receipt, error: null };
  });
  const response = await stopFencedChatWorkflow({ ...target, phase: "pending", runId: null });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    error: "Workflow is still starting; retry Stop shortly",
  });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][1].p_action).toBe("close_unattempted");
  expect(getRun).not.toHaveBeenCalled();
});
it("cancels only the original run, then releases only after terminal evidence", async () => {
  const response = await stopFencedChatWorkflow(target);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, stopped: true });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(vi.mocked(getRun).mock.calls.every(([id]) => id === target.runId)).toBe(true);
  expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual(["state", "release"]);
  expect(rpc.mock.calls[1][1].p).toEqual({
    epoch: 1,
    owner: target.owner,
    run_id: target.runId,
    reason: "external_terminal",
  });
});
it("cancel failure returns502 without release", async () => {
  cancel.mockRejectedValue(new Error("provider failure"));
  expect((await stopFencedChatWorkflow(target)).status).toBe(502);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("terminal timeout returns504 and retains owner", async () => {
  vi.mocked(getRun).mockReturnValue({ cancel, status: Promise.resolve("running") } as never);
  const response = stopFencedChatWorkflow(target);
  await vi.advanceTimersByTimeAsync(8100);
  expect((await response).status).toBe(504);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("a stale original never looks up, cancels or releases the newer owner", async () => {
  rpc.mockResolvedValue({
    data: {
      ...current,
      epoch: 2,
      owner: "55555555-5555-4555-8555-555555555555",
      run_id: "newer-run",
    },
    error: null,
  });
  expect((await stopFencedChatWorkflow(target)).status).toBe(503);
  expect((await resumeFencedChatStream(target, url)).status).toBe(503);
  expect(getRun).not.toHaveBeenCalled();
  expect(rpc.mock.calls.every(([, args]) => args.p_action === "state")).toBe(true);
});
it.each([undefined, null, "unknown"])(
  "missing/unknown status %s is never terminal success",
  async status => {
    vi.mocked(getRun).mockReturnValue({ cancel, status: Promise.resolve(status) } as never);
    const stopping = stopFencedChatWorkflow(target);
    await vi.advanceTimersByTimeAsync(8100);
    expect((await stopping).status).toBe(504);
    expect((await resumeFencedChatStream(target, url)).status).toBe(502);
    expect(rpc.mock.calls.every(([, args]) => args.p_action === "state")).toBe(true);
  },
);
it("failed status reads preserve owner and never return a finish-only success", async () => {
  vi.mocked(getRun).mockReturnValue({
    cancel,
    get status() {
      return Promise.reject(new Error("unavailable"));
    },
  } as never);
  const stopping = stopFencedChatWorkflow(target);
  await vi.advanceTimersByTimeAsync(8100);
  expect((await stopping).status).toBe(504);
  expect((await resumeFencedChatStream(target, url)).status).toBe(502);
  expect(rpc.mock.calls.every(([, args]) => args.p_action === "state")).toBe(true);
});
it.each([
  { chat_id: "chat", epoch: 1, phase: "idle", owner: null, run_id: null },
  { ...current, phase: "pending", run_id: null },
  { ...current, run_id: "other-original-run" },
  { ...current, chat_id: "foreign" },
])("closed/mismatched current receipt never follows another run", async state => {
  rpc.mockResolvedValue({ data: state, error: null });
  expect((await stopFencedChatWorkflow(target)).status).toBe(503);
  expect((await resumeFencedChatStream(target, url)).status).toBe(503);
  expect(getRun).not.toHaveBeenCalled();
});
it("state transport failure does not look up a run or release", async () => {
  rpc.mockRejectedValue(new Error("state response lost"));
  expect((await stopFencedChatWorkflow(target)).status).toBe(503);
  expect((await resumeFencedChatStream(target, url)).status).toBe(503);
  expect(getRun).not.toHaveBeenCalled();
});
it("never treats a reservation string as a running SDK id", async () => {
  const invalid = { ...target, runId: "pending-reservation" };
  expect((await stopFencedChatWorkflow(invalid)).status).toBe(503);
  expect((await resumeFencedChatStream(invalid, url)).status).toBe(503);
  expect(getRun).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("mutation of the input cannot retarget terminal probes or release", async () => {
  const mutable = { ...target };
  cancel.mockImplementation(async () => {
    mutable.runId = "newer-run";
    mutable.epoch = 2;
  });
  expect((await stopFencedChatWorkflow(mutable)).status).toBe(200);
  expect(vi.mocked(getRun).mock.calls.every(([id]) => id === target.runId)).toBe(true);
  expect(rpc.mock.calls.at(-1)![1].p).toMatchObject({ epoch: 1, run_id: target.runId });
});
it.each([false, "transport"])(
  "new-owner or ambiguous release %s never reports successful Stop/resume",
  async failure => {
    rpc.mockImplementation(async (_name, args) => {
      if (args.p_action === "state") return { data: current, error: null };
      if (failure === "transport") throw new Error("lost release acknowledgement");
      return { data: { released: false }, error: null };
    });
    expect((await stopFencedChatWorkflow(target)).status).toBe(503);
    expect((await resumeFencedChatStream(target, url)).status).toBe(503);
    expect(vi.mocked(getRun).mock.calls.every(([id]) => id === target.runId)).toBe(true);
    expect(rpc.mock.calls.filter(([, args]) => args.p_action === "release")).toHaveLength(2);
  },
);
it("terminal resume emits finish only after scoped release", async () => {
  const response = await resumeFencedChatStream(target, url);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"type":"finish"');
  expect(cancel).not.toHaveBeenCalled();
  expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual(["state", "release"]);
});
it("a failed final authoritative probe invalidates previously observed terminal status", async () => {
  let probes = 0;
  vi.mocked(getRun).mockReturnValue({
    cancel,
    get status() {
      probes++;
      return probes === 1
        ? Promise.resolve("cancelled")
        : Promise.reject(new Error("failed final probe"));
    },
  } as never);
  expect((await resumeFencedChatStream(target, url)).status).toBe(502);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it.each(["running", "pending"])(
  "live bound-run status %s resumes original SSE; disconnect never cancels",
  async status => {
    const closeReader = vi.fn();
    const getReadable = vi.fn(() =>
      Object.assign(
        new ReadableStream({
          start(c) {
            c.enqueue({ type: "text-start", id: "a" });
          },
          cancel: closeReader,
        }),
        { getTailIndex: async () => 12 },
      ),
    );
    vi.mocked(getRun).mockReturnValue({
      cancel,
      status: Promise.resolve(status),
      getReadable,
    } as never);
    const response = await resumeFencedChatStream(target, url);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-workflow-run-id")).toBe(target.runId);
    expect(response.headers.get("x-workflow-stream-tail-index")).toBe("12");
    expect(getReadable).toHaveBeenCalledWith({ startIndex: 3, ops: expect.any(Array) });
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cancel).not.toHaveBeenCalled();
    expect(closeReader).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);
it("invalid resume index returns400 before lifecycle/SDK effects", async () => {
  expect(
    (await resumeFencedChatStream(target, new URL("https://api.test?startIndex=-1"))).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  expect(getRun).not.toHaveBeenCalled();
});
