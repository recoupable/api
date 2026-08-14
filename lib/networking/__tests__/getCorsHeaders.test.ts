import { describe, it, expect } from "vitest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

describe("getCorsHeaders", () => {
  it("keeps the existing allow-* headers", () => {
    const h = getCorsHeaders();
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
    expect(h["Access-Control-Allow-Methods"]).toContain("GET");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-api-key");
  });

  // Browsers hide every non-safelisted response header from cross-origin JS
  // unless it is named here. `x-workflow-run-id` has been documented as part
  // of the 200 on the chat endpoints since the workflow cutover and has never
  // been readable by chat.recoupable.dev; a live read of
  // `x-workflow-stream-tail-index` returned null for the same reason
  // (chat#1923).
  it("exposes the workflow stream headers to cross-origin JS", () => {
    const exposed = getCorsHeaders()["Access-Control-Expose-Headers"];
    expect(exposed).toBeDefined();
    expect(exposed).toContain("x-workflow-run-id");
    expect(exposed).toContain("x-workflow-stream-tail-index");
  });
});
