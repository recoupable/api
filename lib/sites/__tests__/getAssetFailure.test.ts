import { expect, it } from "vitest";
import { ValidationError } from "@fal-ai/client";
import { getAssetFailure } from "../production/getAssetFailure";
it("reports rejected image fields without copying raw provider inputs", () => {
  const error = new ValidationError({
    status: 422,
    message: "Invalid",
    requestId: "job-1",
    body: {
      detail: [
        {
          loc: ["body", "image_urls"],
          type: "value_error",
          msg: "Image could not be downloaded",
          input: "private input",
        },
      ],
    },
  });
  const result = getAssetFailure(error);
  expect(result).toMatchObject({
    requestId: "job-1",
    fields: [
      { path: "body.image_urls", code: "value_error", message: "Image could not be downloaded" },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("private input");
});
