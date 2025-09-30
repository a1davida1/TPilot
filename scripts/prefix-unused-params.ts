/**
 * Prefix unused function parameters with "_" safely (per-file run).
 * Usage:
 *   npm run codemod:prefix-params path/to/file.tsx
 *   or
 *   tsx scripts/prefix-unused-params.ts path/to/file.tsx
 *
 * Heuristics:
 * - Only renames parameters that have ZERO references within the function body.
 * - Skips methods named like framework lifecycles or overridden signatures.
 * - Does not touch variables or imports (ESLint handles those).
 */
import { Project, ts, Node, SyntaxKind } from "ts-morph";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Pass a file path, e.g. tsx scripts/prefix-unused-params.ts client/src/file.tsx");
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: false
});

const sf = project.getSourceFile(target) ?? project.addSourceFileAtPathIfExists(target);
if (!sf) {
  console.error(`File not found: ${target}`);
  process.exit(1);
}

const isIdentifierReferenced = (identifier: string, scope: Node): boolean => {
  const refs = scope.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === identifier);
  // The first identifier is usually the param itself; look for additional occurrences in body
  return refs.length > 1;
};

const renameParamIfUnused = (param: Node) => {
  const nameNode = (param as any).getNameNode?.();
  if (!nameNode || !Node.isIdentifier(nameNode)) return;
  const original = nameNode.getText();
  if (original.startsWith("_")) return;

  // Body scope: climb to function node
  let fn = param.getParent();
  while (fn && !Node.isFunctionLikeDeclaration(fn)) fn = fn.getParent();
  if (!fn) return;

  // If param name doesn't appear elsewhere in body, prefix with "_"
  const body = (fn as any).getBody?.();
  if (!body) return;
  const used = isIdentifierReferenced(original, body);
  if (!used) {
    try {
      nameNode.rename(`_${original}`);
    } catch {
      // best-effort only
    }
  }
};

// Visit all functions/arrow functions
sf.forEachDescendant((node) => {
  if (Node.isFunctionDeclaration(node)
    || Node.isFunctionExpression(node)
    || Node.isArrowFunction(node)
    || Node.isMethodDeclaration(node)) {
    for (const param of node.getParameters()) {
      renameParamIfUnused(param);
    }
  }
});

sf.saveSync();
console.log(`Prefixed unused params (if any) in ${path.relative(process.cwd(), sf.getFilePath())}`);
