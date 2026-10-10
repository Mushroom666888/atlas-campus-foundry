import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { catalog } from "../packages/modules/src/catalog.js";
const en = {
  ...JSON.parse(await readFile("web/locales/en.json", "utf8")),
  ...JSON.parse(await readFile("web/locales/metadata.en.json", "utf8")),
};
const keys = new Set<string>();
for (const name of await readdir("web")) {
  if (!name.endsWith(".tsx")) continue;
  const source = ts.createSourceFile(
    name,
    await readFile(`web/${name}`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node: ts.Node) => {
    if (process.argv.includes("--unwrapped") && ts.isStringLiteral(node))
      keys.add(node.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "t" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      keys.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (process.argv.includes("--catalog"))
  console.log(
    JSON.stringify(
      catalog.map((m) => ({
        id: m.moduleId,
        name: m.name,
        description: m.description,
      })),
      null,
      2,
    ),
  );
else if (process.argv.includes("--fields")) {
  const fields = new Set<string>();
  for (const m of catalog) {
    if (m.recordDefinition) {
      fields.add(m.recordDefinition.titleLabel);
      for (const status of m.recordDefinition.statuses) fields.add(status);
    }
    for (const f of [
      ...m.configurationFields,
      ...(m.recordDefinition?.fields || []),
    ]) {
      fields.add(f.label);
      for (const option of f.options || []) fields.add(option);
    }
    for (const tag of m.tags) fields.add(tag);
  }
  console.log(
    JSON.stringify(
      [...fields].filter((k) => /[\u3400-\u9fff]/.test(k) && !(k in en)),
      null,
      2,
    ),
  );
} else {
  const missing = [...keys].filter(
    (key) => /[\u3400-\u9fff]/.test(key) && !(key in en),
  );
  console.log(JSON.stringify({ keys: keys.size, missing }, null, 2));
  if (missing.length) process.exitCode = 1;
}
