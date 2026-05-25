import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendCommitChunk } from "@/lib/chat/auto-commit/sendCommitChunk";
import type { CommitData } from "@/lib/chat/auto-commit/buildCommitData";

const PENDING: CommitData = {
  status: "skipped",
  committed: false,
  pushed: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendCommitChunk", () => {
  it("writes the `data-commit` chunk into the writable with id + data", async () => {
    const written: unknown[] = [];
    const writable = new WritableStream({
      write(chunk) {
        written.push(chunk);
      },
    });

    await sendCommitChunk(writable, "msg_abc:commit", PENDING);

    expect(written).toEqual([{ type: "data-commit", id: "msg_abc:commit", data: PENDING }]);
  });

  it("releases the writer lock after writing so subsequent writes can acquire one", async () => {
    const writable = new WritableStream({ write() {} });
    await sendCommitChunk(writable, "id1", PENDING);
    // If lock weren't released, this getWriter() would throw
    const writer = writable.getWriter();
    expect(writer).toBeDefined();
    writer.releaseLock();
  });

  it("releases the writer lock even when the underlying write rejects", async () => {
    const writable = new WritableStream({
      write() {
        throw new Error("sink boom");
      },
    });
    await expect(sendCommitChunk(writable, "id1", PENDING)).rejects.toThrow(/sink boom/);
    // Lock should still be released
    expect(() => {
      const writer = writable.getWriter();
      writer.releaseLock();
    }).not.toThrow();
  });
});
