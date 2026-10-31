import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadPublicAsset } from "../uploadPublicAsset";
import { uploadPublicFileByKey } from "@/lib/supabase/storage/uploadPublicFileByKey";
import { publicUploadUrl } from "@/lib/supabase/storage/publicUploadUrl";
import { generateAndStoreTxtFile } from "../generateAndStoreTxtFile";
import { uploadImageAndCreateMoment } from "@/lib/image/uploadImageAndCreateMoment";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
import { createMoment } from "@/lib/inprocess/createMoment";
import { createKnowledgeBase } from "@/lib/artist/createKnowledgeBase";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";

vi.mock("@/lib/supabase/storage/uploadPublicFileByKey", () => ({ uploadPublicFileByKey: vi.fn() }));
vi.mock("@/lib/supabase/storage/publicUploadUrl", () => ({
  publicUploadUrl: vi.fn((key: string) => `https://storage.example/${key}`),
}));
vi.mock("@/lib/inprocess/createMoment", () => ({ createMoment: vi.fn() }));
vi.mock("@/lib/supabase/account_info/selectAccountInfo", () => ({ selectAccountInfo: vi.fn() }));
vi.mock("@/lib/supabase/account_info/insertAccountInfo", () => ({ insertAccountInfo: vi.fn() }));
vi.mock("@/lib/supabase/account_info/updateAccountInfo", () => ({ updateAccountInfo: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
describe("public storage writer migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadPublicFileByKey).mockResolvedValue(undefined);
    vi.mocked(createMoment).mockResolvedValue({
      contractAddress: "contract",
      tokenId: "1",
      hash: "hash",
    });
    vi.mocked(selectAccountInfo).mockResolvedValue(null);
  });
  it("uploads immutable account-scoped bytes with authenticated uploader metadata", async () => {
    const bytes = Buffer.from([0, 1, 255, 10]);
    const result = await uploadPublicAsset({
      data: bytes,
      contentType: "application/pdf",
      uploaderAccountId: account,
    });
    const [key, blob, options] = vi.mocked(uploadPublicFileByKey).mock.calls[0];
    expect(key).toMatch(new RegExp(`^${account}/[a-f0-9-]{36}$`));
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(bytes);
    expect(options).toEqual({
      contentType: "application/pdf",
      upsert: false,
      metadata: { uploaded_by: account },
    });
    expect(publicUploadUrl).toHaveBeenCalledWith(key);
    expect(result).toEqual({ storageKey: key, url: `https://storage.example/${key}` });
  });
  it("does not return a URL after upload failure", async () => {
    vi.mocked(uploadPublicFileByKey).mockRejectedValue(new Error("storage unavailable"));
    await expect(uploadPublicAsset({ data: "text", contentType: "text/plain" })).rejects.toThrow();
    expect(publicUploadUrl).not.toHaveBeenCalled();
  });
  it("stores TXT and metadata without losing legacy URL aliases", async () => {
    const result = await generateAndStoreTxtFile("Hello\nworld", account);
    const calls = vi.mocked(uploadPublicFileByKey).mock.calls;
    expect(calls).toHaveLength(2);
    expect(await calls[0][1].text()).toBe("Hello\nworld");
    expect(result.txtUrl).toBe(result.arweave);
    expect(result.metadataUrl).toBe(result.metadataArweave);
    expect(result.txt.base64Data).toBe(Buffer.from("Hello\nworld").toString("base64"));
    expect(JSON.parse(await calls[1][1].text()).content.uri).toBe(result.txtUrl);
  });
  it("fails TXT generation when the primary upload fails", async () => {
    vi.mocked(uploadPublicFileByKey).mockRejectedValueOnce(new Error("offline"));
    await expect(generateAndStoreTxtFile("hello", account)).rejects.toThrow();
  });
  it("keeps stored TXT usable when only metadata storage fails", async () => {
    vi.mocked(uploadPublicFileByKey)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("metadata failed"));
    const result = await generateAndStoreTxtFile("hello", account);
    expect(result.txtUrl).toMatch(/^https:\/\/storage.example\//);
    expect(result.metadataUrl).toBeNull();
    expect(result.metadataArweave).toBeNull();
  });
  it("passes durable HTTPS metadata to existing moment creation", async () => {
    await createImageMoment({
      prompt: "Picture",
      account,
      imageUri: "https://storage.example/image",
      mediaType: "image/png",
      uploaderAccountId: account,
    });
    const metadata = JSON.parse(await vi.mocked(uploadPublicFileByKey).mock.calls[0][1].text());
    expect(metadata.content.uri).toBe("https://storage.example/image");
    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({
        contract: { name: "Picture", uri: expect.stringMatching(/^https:\/\/storage.example\//) },
      }),
    );
  });
  it("preserves generated image bytes, URL and best-effort moment behavior", async () => {
    vi.mocked(createMoment).mockRejectedValueOnce(new Error("moment failed"));
    const bytes = Buffer.from([0, 1, 2, 255]);
    const result = await uploadImageAndCreateMoment({
      image: { base64: bytes.toString("base64"), mediaType: "image/png" } as never,
      prompt: "p",
      account,
      uploaderAccountId: account,
    });
    expect(
      Buffer.from(await vi.mocked(uploadPublicFileByKey).mock.calls[0][1].arrayBuffer()),
    ).toEqual(bytes);
    expect(result.imageUrl).toMatch(/^https:\/\/storage.example\//);
    expect(result.moment).toBeNull();
    expect(result.arweaveResult).toBeNull();
  });
  it("preserves partial image failure shape without provider detail leakage", async () => {
    vi.mocked(uploadPublicFileByKey).mockRejectedValueOnce(new Error("provider-secret"));
    const result = await uploadImageAndCreateMoment({
      image: { base64: "AQ==", mediaType: "image/png" } as never,
      prompt: "p",
      account,
    });
    expect(result).toMatchObject({
      imageUrl: null,
      moment: null,
      arweaveResult: null,
      uploadError: "Could not store generated image",
      arweaveError: "Could not store generated image",
    });
  });
  it("keeps knowledge entries usable as public HTTPS links", async () => {
    const knowledge = await createKnowledgeBase(account, "Bio\nDetails", account);
    expect(knowledge).toEqual({
      url: expect.stringMatching(/^https:\/\/storage.example\//),
      name: "Bio",
      type: "text/plain",
    });
    expect(insertAccountInfo).toHaveBeenCalledWith({
      account_id: account,
      knowledges: [knowledge],
    });
    expect(updateAccountInfo).not.toHaveBeenCalled();
  });
  it("does not persist a broken knowledge reference when upload fails", async () => {
    vi.mocked(uploadPublicFileByKey).mockRejectedValueOnce(new Error("offline"));
    await expect(createKnowledgeBase(account, "Bio", account)).rejects.toThrow();
    expect(insertAccountInfo).not.toHaveBeenCalled();
    expect(updateAccountInfo).not.toHaveBeenCalled();
  });
});
