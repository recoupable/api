import { expect, it, vi } from "vitest";

import { buildContextOperationCatalog } from "../buildContextOperationCatalog";

vi.mock("@/lib/context/processContextOperation", () => {
  throw new Error("Request contracts must not load Context execution services");
});

it("exports request contracts without loading authenticated execution services", () => {
  const catalog = buildContextOperationCatalog();
  expect(catalog.requestSchemas.length).toBeGreaterThan(0);
});
