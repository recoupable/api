import ts from "typescript";

/** Fail closed on registration aliases that the static tool inventory cannot classify. */
export function assertDirectRegistrations(source: ts.SourceFile): void {
  const visit = (node: ts.Node) => {
    if ((ts.isIdentifier(node) || ts.isStringLiteral(node)) && node.text === "registerTool") {
      const access = node.parent;
      if (
        !ts.isPropertyAccessExpression(access) ||
        access.name !== node ||
        !ts.isCallExpression(access.parent) ||
        access.parent.expression !== access
      )
        throw new Error(`Unsupported registerTool reference: ${source.fileName}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
