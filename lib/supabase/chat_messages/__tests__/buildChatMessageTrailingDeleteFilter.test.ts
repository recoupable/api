import { expect, it } from "vitest";
import { buildChatMessageTrailingDeleteFilter } from "../buildChatMessageTrailingDeleteFilter";
const id = "11111111-1111-4111-8111-111111111111";
it.each(["2026-10-25T12:00:00.123456Z", "2026-10-25T12:00:00.123456+05:30"])(
  "keeps exact timestamp %s and inclusive UUID tie break",
  fromTimestamp => {
    expect(buildChatMessageTrailingDeleteFilter({ fromTimestamp, fromMessageId: id })).toBe(
      `created_at.gt."${fromTimestamp}",and(created_at.eq."${fromTimestamp}",id.gte.${id})`,
    );
  },
);
it.each(["", "2026-02-30T12:00:00Z", "infinity", '2026-10-25T12:00:00Z",id.gt.0', "2026-10-25"])(
  "rejects invalid timestamp %s",
  fromTimestamp => {
    expect(() =>
      buildChatMessageTrailingDeleteFilter({ fromTimestamp, fromMessageId: id }),
    ).toThrow();
  },
);
it("rejects malformed UUID before predicate interpolation", () => {
  expect(() =>
    buildChatMessageTrailingDeleteFilter({
      fromTimestamp: "2026-10-25T12:00:00Z",
      fromMessageId: "bad,or(id.gt.0)",
    }),
  ).toThrow();
});
