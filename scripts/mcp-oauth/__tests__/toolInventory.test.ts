import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import inventory from "../tool-policy.json";
import { assertDirectRegistrations } from "../assertDirectRegistrations";

// Deliberately inspects source, not runtime imports: inventory must never initialize providers
// or contact production services. New registration patterns fail instead of silently disappearing.
const root = resolve(import.meta.dirname, "../../..");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.name === "__tests__") return [];
    return entry.isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("MCP OAuth tool authorization inventory", () => {
  it("requires an explicit launch policy for every registered tool, including dynamic site tools", () => {
    const discovered: Array<{ name: string; file: string }> = [];
    for (const path of files(resolve(root, "lib/mcp/tools"))) {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      assertDirectRegistrations(source);
      const siteNames: string[] = [];
      const collect = (node: ts.Node) => {
        if (
          ts.isVariableDeclaration(node) &&
          node.name.getText(source) === "operations" &&
          node.initializer &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          for (const property of node.initializer.properties) {
            if (
              !ts.isPropertyAssignment(property) ||
              !ts.isArrayLiteralExpression(property.initializer) ||
              !ts.isStringLiteral(property.initializer.elements[0])
            )
              throw new Error("Review the new site registration pattern");
            siteNames.push(property.initializer.elements[0].text);
          }
        }
        ts.forEachChild(node, collect);
      };
      collect(source);
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "registerTool"
        ) {
          const name = node.arguments[0];
          const names = ts.isStringLiteral(name)
            ? [name.text]
            : relative(root, path) === "lib/mcp/tools/sites/index.ts" &&
                name.getText(source) === "name"
              ? siteNames
              : [];
          if (!names.length)
            throw new Error(`Unclassified dynamic tool registration: ${relative(root, path)}`);
          discovered.push(...names.map(name => ({ name, file: relative(root, path) })));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(
      inventory
        .map(({ name, file }) => ({ name, file }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual(discovered.sort((a, b) => a.name.localeCompare(b.name)));
    expect(new Set(inventory.map(tool => tool.name)).size).toBe(inventory.length);
    for (const tool of inventory) {
      expect(tool.authorizationWork.length).toBeGreaterThan(15);
      expect(tool.scopes.length > 0 || tool.name === "get_api_key").toBe(true);
    }
  });
});
