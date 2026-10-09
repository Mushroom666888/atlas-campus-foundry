import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

async function sources(root) {
  const entries = await readdir(root, { withFileTypes: true });
  let text = "";
  for (const entry of entries) {
    if (entry.isDirectory()) text += await sources(path.join(root, entry.name));
    else if (/\.(tsx?|css)$/.test(entry.name))
      text += await readFile(path.join(root, entry.name), "utf8");
  }
  return text;
}
const characters = [
  ...new Set(
    ((await sources("web")) + (await sources("packages/modules/src"))).match(
      /[\p{Script=Han}]/gu,
    ),
  ),
].sort();
await mkdir("public/assets", { recursive: true });
let css =
  "/* Generated local Noto Sans SC subsets, SIL OFL. See noto-sans-sc-OFL.txt. */\n";
for (let start = 0; start < characters.length; start += 300) {
  const chars = characters.slice(start, start + 300),
    index = Math.floor(start / 300);
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..700&display=swap&text=${encodeURIComponent(chars.join(""))}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" },
  });
  if (!response.ok) throw new Error(`Font CSS: ${response.status}`);
  const remote = await response.text(),
    fontUrl = remote.match(/url\((https:[^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error("Missing font URL");
  const font = await fetch(fontUrl);
  if (!font.ok) throw new Error(`Font asset: ${font.status}`);
  await writeFile(
    `public/assets/atlas-cjk-${index}.woff2`,
    Buffer.from(await font.arrayBuffer()),
  );
  css += `@font-face{font-family:Atlas Sans SC;font-style:normal;font-weight:400 700;font-display:swap;src:url('/assets/atlas-cjk-${index}.woff2') format('woff2');unicode-range:${chars.map((c) => `U+${c.codePointAt(0).toString(16)}`).join(",")}}\n`;
}
await writeFile("public/assets/atlas-fonts.css", css);
console.log(
  `Prepared ${characters.length} CJK glyphs in ${Math.ceil(characters.length / 300)} local subsets.`,
);
