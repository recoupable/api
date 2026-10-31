import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { expect, it } from "vitest";
import { readAgentRequestBody } from "../readAgentRequestBody";

it("drains the remaining upload after rejecting an oversized body", async () => {
  const stream = new PassThrough();
  const request = Object.assign(stream, {
    headers: { "content-type": "application/json" },
  }) as unknown as IncomingMessage;
  const read = readAgentRequestBody(request, "application/json", 10);
  stream.write("01234567890");
  await expect(read).rejects.toMatchObject({ status: 413 });
  stream.end("remaining upload");
  const drained = await Promise.race([
    new Promise<boolean>(resolve => stream.once("end", () => resolve(true))),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100)),
  ]);
  stream.destroy();
  expect(drained).toBe(true);
});
