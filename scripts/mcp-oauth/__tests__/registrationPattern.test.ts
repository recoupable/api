import ts from "typescript";
import { expect, it } from "vitest";
import { assertDirectRegistrations } from "../assertDirectRegistrations";

it.each([
  "const register = server.registerTool.bind(server);",
  "const { registerTool: register } = server;",
  'server["registerTool"]("hidden", {}, handler);',
  "wrap(server.registerTool);",
])("rejects unsupported registration references: %s", text => {
  const source = ts.createSourceFile("fixture.ts", text, ts.ScriptTarget.Latest, true);
  expect(() => assertDirectRegistrations(source)).toThrow("Unsupported registerTool reference");
});
it("allows direct registrations for the inventory scanner", () => {
  const source = ts.createSourceFile(
    "fixture.ts",
    'server.registerTool("visible", {}, handler);',
    ts.ScriptTarget.Latest,
    true,
  );
  expect(() => assertDirectRegistrations(source)).not.toThrow();
});
