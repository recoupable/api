import { describe, it, expect } from "vitest";
import { extractVideoFiles, type SlackFile } from "../extractVideoFiles";

describe("extractVideoFiles", () => {
  it("returns empty array when files is undefined", () => {
    expect(extractVideoFiles(undefined)).toEqual([]);
  });

  it("returns empty array when files is empty", () => {
    expect(extractVideoFiles([])).toEqual([]);
  });

  it("extracts permalinks from video files", () => {
    const files: SlackFile[] = [
      {
        id: "F123",
        name: "artist-video.mp4",
        mimetype: "video/mp4",
        permalink: "https://workspace.slack.com/files/U123/F123/artist-video.mp4",
      },
    ];
    expect(extractVideoFiles(files)).toEqual([
      "https://workspace.slack.com/files/U123/F123/artist-video.mp4",
    ]);
  });

  it("filters out non-video files", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "photo.png",
        mimetype: "image/png",
        permalink: "https://workspace.slack.com/files/U1/F1/photo.png",
      },
      {
        id: "F2",
        name: "video.mp4",
        mimetype: "video/mp4",
        permalink: "https://workspace.slack.com/files/U1/F2/video.mp4",
      },
    ];
    expect(extractVideoFiles(files)).toEqual(["https://workspace.slack.com/files/U1/F2/video.mp4"]);
  });

  it("skips files without a permalink", () => {
    const files: SlackFile[] = [{ id: "F1", name: "video.mp4", mimetype: "video/mp4" }];
    expect(extractVideoFiles(files)).toEqual([]);
  });

  it("handles multiple video files", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "v1.mp4",
        mimetype: "video/mp4",
        permalink: "https://slack.com/F1",
      },
      {
        id: "F2",
        name: "v2.mp4",
        mimetype: "video/quicktime",
        permalink: "https://slack.com/F2",
      },
    ];
    expect(extractVideoFiles(files)).toEqual(["https://slack.com/F1", "https://slack.com/F2"]);
  });

  it("deduplicates identical permalinks", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "v1.mp4",
        mimetype: "video/mp4",
        permalink: "https://slack.com/same",
      },
      {
        id: "F2",
        name: "v2.mp4",
        mimetype: "video/mp4",
        permalink: "https://slack.com/same",
      },
    ];
    expect(extractVideoFiles(files)).toEqual(["https://slack.com/same"]);
  });
});
