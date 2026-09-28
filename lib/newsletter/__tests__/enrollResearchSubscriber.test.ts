import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), add: vi.fn() }));
vi.mock("resend", () => ({ Resend: class {
  contacts = { get: mocks.get, create: mocks.create, segments: { add: mocks.add } };
} }));
import { enrollResearchSubscriber } from "../enrollResearchSubscriber";

describe("research enrollment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("RESEND_RESEARCH_SEGMENT_ID", "research");
    vi.stubEnv("RESEND_RESEARCH_READY", "true");
    mocks.get.mockResolvedValue({ data: { id: "person", unsubscribed: false } });
    mocks.add.mockResolvedValue({ data: { id: "research" } });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("fails closed before launch readiness", async () => {
    vi.stubEnv("RESEND_RESEARCH_READY", "false");
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(false);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("preserves unsubscribe and never reenrolls it", async () => {
    mocks.get.mockResolvedValue({ data: { id: "person", unsubscribed: true } });
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(false);
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not create on provider authentication or rate errors", async () => {
    mocks.get.mockResolvedValue({ error: { name: "rate_limit_exceeded" } });
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("normalizes email and reuses existing contacts", async () => {
    expect(await enrollResearchSubscriber(" A@Example.com ")).toEqual({ success: true });
    expect(mocks.get).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates only a missing contact without overriding unsubscribe", async () => {
    mocks.get.mockResolvedValue({ error: { name: "not_found" } });
    mocks.create.mockResolvedValue({ data: { id: "new" } });
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(mocks.add).toHaveBeenCalledWith({ contactId: "new", segmentId: "research" });
  });
  it("never reports success on failed membership or network failure", async () => {
    mocks.add.mockResolvedValue({ error: { name: "not_found" } });
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(false);
    mocks.get.mockRejectedValue(new Error("network"));
    expect((await enrollResearchSubscriber("a@example.com")).success).toBe(false);
  });
});
