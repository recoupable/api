import { describe, it, expect, vi } from "vitest";
import { closeChatStream } from "@/app/lib/workflows/closeChatStream";

describe("closeChatStream", () => {
  it("calls close() on the writable", async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const writable = { close: closeMock } as unknown as WritableStream;

    await closeChatStream(writable);

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("swallows errors from close() so cleanup never throws (defensive)", async () => {
    const writable = {
      close: vi.fn().mockRejectedValue(new Error("already closed")),
    } as unknown as WritableStream;

    await expect(closeChatStream(writable)).resolves.toBeUndefined();
  });

  it("works when the writable is already closed (idempotent contract)", async () => {
    const writable = {
      close: vi.fn().mockRejectedValueOnce(new TypeError("Cannot close a CLOSED writable")),
    } as unknown as WritableStream;

    await expect(closeChatStream(writable)).resolves.toBeUndefined();
  });
});
