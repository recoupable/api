import { describe, expect, it } from "vitest";
import {
  contentPromptFlagsSchema,
  DEFAULT_CONTENT_PROMPT_FLAGS,
} from "../createContentPromptAgent";

describe("content artist prompt schema", () => {
  it("retains explicit artist names, including multiple names for rejection", () => {
    const artistNames = ["North Star", "South Star"];
    expect(
      contentPromptFlagsSchema.parse({ ...DEFAULT_CONTENT_PROMPT_FLAGS, artistNames }).artistNames,
    ).toEqual(artistNames);
  });

  it("never supplies a default artist", () => {
    expect(contentPromptFlagsSchema.parse(DEFAULT_CONTENT_PROMPT_FLAGS).artistNames ?? []).toEqual(
      [],
    );
  });
});
