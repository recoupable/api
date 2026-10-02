import { describe, expect, it } from "vitest";
import { actionSchema } from "../schema";
import { siteOperationSchemas } from "../siteOperationSchemas";

describe("publish request contract", () => {
  it("passes the editor's return URL through both validation layers", () => {
    const { action, ...input } = actionSchema.parse({
      action: "publish",
      revision: 2,
      generationToken: "signed-build",
      returnUrl: "https://app.recoupable.dev/s/afdd53d0-ee16-4e7f-94f8-ae02f27a0315",
    });
    expect(action).toBe("publish");
    expect(
      siteOperationSchemas.publish.parse({ id: "afdd53d0-ee16-4e7f-94f8-ae02f27a0315", ...input })
        .generationToken,
    ).toBe("signed-build");
    expect(
      siteOperationSchemas.publish.parse({
        id: "afdd53d0-ee16-4e7f-94f8-ae02f27a0315",
        ...input,
      }).returnUrl,
    ).toBe(input.returnUrl);
  });

  it("keeps the URL optional for existing API clients", () => {
    expect(actionSchema.safeParse({ action: "publish", revision: 2 }).success).toBe(true);
  });

  it.each([
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/#fragment",
  ])("rejects an unsafe return URL: %s", returnUrl => {
    expect(actionSchema.safeParse({ action: "publish", revision: 2, returnUrl }).success).toBe(
      false,
    );
  });
});
