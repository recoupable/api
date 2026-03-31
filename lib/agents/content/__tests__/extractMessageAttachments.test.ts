import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMessageAttachments } from "../extractMessageAttachments";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
}));

const { put } = await import("@vercel/blob");

describe("extractMessageAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null values when message has no attachments", async () => {
    const message = { text: "hello", attachments: [] };
    const result = await extractMessageAttachments(message as never);
    expect(result).toEqual({ songUrl: null, imageUrl: null });
  });

  it("returns null values when attachments is undefined", async () => {
    const message = { text: "hello" };
    const result = await extractMessageAttachments(message as never);
    expect(result).toEqual({ songUrl: null, imageUrl: null });
  });

  it("uploads audio with correct contentType", async () => {
    const audioBuffer = Buffer.from("fake-audio-data");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "audio",
          name: "my-song.mp3",
          fetchData: vi.fn().mockResolvedValue(audioBuffer),
        },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/content-attachments/my-song.mp3",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(message.attachments[0].fetchData).toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith(expect.stringContaining("my-song.mp3"), audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    });
    expect(result.songUrl).toBe("https://blob.vercel-storage.com/content-attachments/my-song.mp3");
    expect(result.imageUrl).toBeNull();
  });

  it("extracts and uploads an image attachment", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "image",
          name: "face.png",
          fetchData: vi.fn().mockResolvedValue(imageBuffer),
        },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/content-attachments/face.png",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(result.imageUrl).toBe("https://blob.vercel-storage.com/content-attachments/face.png");
    expect(result.songUrl).toBeNull();
  });

  it("extracts both audio and image when both are attached", async () => {
    const audioBuffer = Buffer.from("fake-audio");
    const imageBuffer = Buffer.from("fake-image");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "audio",
          name: "song.mp3",
          fetchData: vi.fn().mockResolvedValue(audioBuffer),
        },
        {
          type: "image",
          name: "photo.jpg",
          fetchData: vi.fn().mockResolvedValue(imageBuffer),
        },
      ],
    };
    vi.mocked(put).mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/song.mp3",
    } as never);
    vi.mocked(put).mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/photo.jpg",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(result.songUrl).toBe("https://blob.vercel-storage.com/song.mp3");
    expect(result.imageUrl).toBe("https://blob.vercel-storage.com/photo.jpg");
  });

  it("uses attachment data buffer if fetchData is not available", async () => {
    const audioBuffer = Buffer.from("inline-audio");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "audio",
          name: "inline.mp3",
          data: audioBuffer,
        },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/inline.mp3",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(put).toHaveBeenCalledWith(expect.stringContaining("inline.mp3"), audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    });
    expect(result.songUrl).toBe("https://blob.vercel-storage.com/inline.mp3");
  });

  it("uses first audio and first image when multiple of same type exist", async () => {
    const audio1 = Buffer.from("audio1");
    const audio2 = Buffer.from("audio2");
    const message = {
      text: "hello",
      attachments: [
        { type: "audio", name: "first.mp3", fetchData: vi.fn().mockResolvedValue(audio1) },
        { type: "audio", name: "second.mp3", fetchData: vi.fn().mockResolvedValue(audio2) },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/first.mp3",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(put).toHaveBeenCalledTimes(1);
    expect(result.songUrl).toBe("https://blob.vercel-storage.com/first.mp3");
  });

  it("detects image from file type with image mimeType (Slack uploads)", async () => {
    const imageBuffer = Buffer.from("fake-image");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "file",
          name: "photo.jpg",
          mimeType: "image/jpeg",
          fetchData: vi.fn().mockResolvedValue(imageBuffer),
        },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/photo.jpg",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(result.imageUrl).toBe("https://blob.vercel-storage.com/photo.jpg");
  });

  it("detects audio from file type with audio mimeType (Slack uploads)", async () => {
    const audioBuffer = Buffer.from("fake-audio");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "file",
          name: "song.mp3",
          mimeType: "audio/mpeg",
          fetchData: vi.fn().mockResolvedValue(audioBuffer),
        },
      ],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/song.mp3",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(result.songUrl).toBe("https://blob.vercel-storage.com/song.mp3");
  });

  it("ignores file attachments that are not audio or image", async () => {
    const message = {
      text: "hello",
      attachments: [
        { type: "file", name: "document.pdf", fetchData: vi.fn() },
        { type: "video", name: "clip.mp4", fetchData: vi.fn() },
      ],
    };

    const result = await extractMessageAttachments(message as never);

    expect(put).not.toHaveBeenCalled();
    expect(result).toEqual({ songUrl: null, imageUrl: null });
  });

  it("returns null when attachment has no data and no fetchData", async () => {
    const message = {
      text: "hello",
      attachments: [
        {
          type: "audio",
          name: "empty.mp3",
        },
      ],
    };

    const result = await extractMessageAttachments(message as never);

    expect(put).not.toHaveBeenCalled();
    expect(result.songUrl).toBeNull();
  });

  it("gracefully handles upload failure without crashing", async () => {
    const audioBuffer = Buffer.from("fake-audio");
    const imageBuffer = Buffer.from("fake-image");
    const message = {
      text: "hello",
      attachments: [
        {
          type: "audio",
          name: "song.mp3",
          fetchData: vi.fn().mockResolvedValue(audioBuffer),
        },
        {
          type: "image",
          name: "photo.jpg",
          fetchData: vi.fn().mockResolvedValue(imageBuffer),
        },
      ],
    };
    // First call (audio) throws, second call (image) succeeds
    vi.mocked(put).mockRejectedValueOnce(new Error("upload failed"));
    vi.mocked(put).mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/photo.jpg",
    } as never);

    const result = await extractMessageAttachments(message as never);

    expect(result.songUrl).toBeNull();
    expect(result.imageUrl).toBe("https://blob.vercel-storage.com/photo.jpg");
  });

  it("falls back to generic name when attachment name is missing", async () => {
    const audioBuffer = Buffer.from("audio");
    const message = {
      text: "hello",
      attachments: [{ type: "audio", fetchData: vi.fn().mockResolvedValue(audioBuffer) }],
    };
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/attachment",
    } as never);

    await extractMessageAttachments(message as never);

    expect(put).toHaveBeenCalledWith(expect.stringContaining("attachment"), audioBuffer, {
      access: "public",
      contentType: "audio/mpeg",
    });
  });
});
