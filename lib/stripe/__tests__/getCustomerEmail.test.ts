import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { customersRetrieveMock } = vi.hoisted(() => ({ customersRetrieveMock: vi.fn() }));

vi.mock("@/lib/stripe/client", () => ({
  default: { customers: { retrieve: customersRetrieveMock } },
}));

const { getCustomerEmail } = await import("@/lib/stripe/getCustomerEmail");

describe("getCustomerEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns the email of a live customer", async () => {
    customersRetrieveMock.mockResolvedValue({ id: "cus_1", email: "fan@example.com" });
    await expect(getCustomerEmail("cus_1")).resolves.toBe("fan@example.com");
    expect(customersRetrieveMock).toHaveBeenCalledWith("cus_1");
  });

  it("returns null for a deleted customer", async () => {
    customersRetrieveMock.mockResolvedValue({ id: "cus_1", deleted: true });
    await expect(getCustomerEmail("cus_1")).resolves.toBeNull();
  });

  it("returns null when the customer has no email", async () => {
    customersRetrieveMock.mockResolvedValue({ id: "cus_1", email: null });
    await expect(getCustomerEmail("cus_1")).resolves.toBeNull();
  });

  it("returns null and logs when the lookup fails", async () => {
    customersRetrieveMock.mockRejectedValue(new Error("stripe down"));
    await expect(getCustomerEmail("cus_1")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
