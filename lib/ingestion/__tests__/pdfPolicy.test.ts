import { afterEach, describe, expect, it, vi } from "vitest";
import { runIngestionPipeline } from "../runIngestionPipeline";
import { ingestionContractSchema } from "../schemas";
const mocks = vi.hoisted(() => ({ pages: ["ID|Amount\n001|0.3", ""], destroy: vi.fn() }));
vi.mock("unpdf", () => ({
  getDocumentProxy: async () => ({
    numPages: mocks.pages.length,
    loadingTask: { destroy: mocks.destroy },
  }),
  extractText: async () => ({ text: mocks.pages, totalPages: mocks.pages.length }),
}));
const contract = ingestionContractSchema.parse({
  version: "1",
  fields: [
    { name: "id", source: "ID", type: "string" },
    { name: "amount", source: "Amount", type: "string" },
  ],
  text_table: { review_ref: "review", separator: "|" },
});
describe("PDF page acceptance", () => {
  afterEach(() => vi.clearAllMocks());
  it("refuses mixed text and unextracted pages rather than silently dropping a page", async () => {
    mocks.pages = ["ID|Amount\n001|0.3", ""];
    const result = await runIngestionPipeline(Buffer.from("%PDF-fixture"), "pdf", contract);
    expect(result.status).toBe("rejected");
    expect(result.issues[0].code).toBe("OCR_REQUIRED");
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it("does not turn repeated page headers into text data rows", async () => {
    mocks.pages = ["ID|Amount\n001|0.3", "ID|Amount\n002|0.4"];
    const result = await runIngestionPipeline(Buffer.from("%PDF-fixture"), "pdf", contract);
    expect(result.status).toBe("rejected");
    expect(result.issues[0].code).toBe("REPEATED_HEADER");
  });
});
