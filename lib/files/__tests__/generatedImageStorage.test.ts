import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/x402/image/generate/route";
import { generateAndProcessImage } from "@/lib/image/generateAndProcessImage";
import generateImage from "@/lib/ai/generateImage";
import { uploadImageAndCreateMoment } from "@/lib/image/uploadImageAndCreateMoment";
vi.mock("@/lib/ai/generateImage", () => ({ default: vi.fn() }));
vi.mock("@/lib/image/uploadImageAndCreateMoment", () => ({ uploadImageAndCreateMoment: vi.fn() }));
vi.mock("@/lib/x402/getBuyerAccount", () => ({ getBuyerAccount: vi.fn(() => "buyer") }));
const image = { base64: "AQI=", mediaType: "image/png" };
describe("generated image storage adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateImage).mockResolvedValue({ image, usage: {} } as never);
    vi.mocked(uploadImageAndCreateMoment).mockResolvedValue({
      imageUrl: "https://storage/image",
      arweaveResult: null,
      moment: null,
      uploadError: null,
      arweaveError: null,
    });
  });
  it("preserves generated and edited image URLs and forwards trusted attribution", async () => {
    const files = [{ url: "https://storage/source", type: "image/png" }];
    expect(await generateAndProcessImage("edit", "legacy-target", files, "caller")).toEqual({
      imageUrl: "https://storage/image",
    });
    expect(generateImage).toHaveBeenCalledWith("edit", [
      { type: "file", data: "https://storage/source", mediaType: "image/png" },
    ]);
    expect(uploadImageAndCreateMoment).toHaveBeenCalledWith({
      image,
      prompt: "edit",
      account: "legacy-target",
      uploaderAccountId: "caller",
    });
  });
  it("keeps x402 image/usage/imageUrl and deprecated null transaction field", async () => {
    const response = await GET(
      new NextRequest("https://api.example/api/x402/image/generate?prompt=hello"),
    );
    expect(await response.json()).toEqual({
      image,
      usage: {},
      imageUrl: "https://storage/image",
      arweaveResult: null,
      moment: null,
    });
  });
  it("keeps old error alias while adding neutral uploadError", async () => {
    vi.mocked(uploadImageAndCreateMoment).mockResolvedValue({
      imageUrl: null,
      arweaveResult: null,
      moment: null,
      uploadError: "Could not store generated image",
      arweaveError: "Could not store generated image",
    });
    const response = await GET(
      new NextRequest("https://api.example/api/x402/image/generate?prompt=hello"),
    );
    expect(await response.json()).toMatchObject({
      imageUrl: null,
      uploadError: "Could not store generated image",
      arweaveError: "Could not store generated image",
    });
  });
});
