import { describe, expect, it } from "vitest";
import { pickTopPlaylistsQuery } from "../pickTopPlaylistsQuery";

describe("pickTopPlaylistsQuery", () => {
  it("keeps limit and offset only", () => {
    expect(
      pickTopPlaylistsQuery({
        limit: "20",
        offset: "10",
        editorial: "true",
        sortColumn: "date",
      }),
    ).toEqual({ limit: "20", offset: "10" });
  });

  it("returns an empty object when no supported params are present", () => {
    expect(pickTopPlaylistsQuery({ editorial: "true" })).toEqual({});
  });
});
