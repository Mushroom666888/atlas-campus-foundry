import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MoveUpRight } from "lucide-react";

// The source image is NASA/ESA/CSA/STScI's Cosmic Cliffs, downloaded without credentials.
await mkdir("public/assets", { recursive: true });
const source = await readFile(".data/design-references/carina.jpg");
const { data, info } = await sharp(source)
  .resize(1920)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const base = Buffer.from(data),
  front = Buffer.from(data);
const skyline = [];
for (let x = 0; x < info.width; x++) {
  let run = 0,
    edge = Math.round(info.height * 0.56);
  for (let y = Math.round(info.height * 0.17); y < info.height * 0.57; y++) {
    const p = (y * info.width + x) * 4;
    run =
      data[p] > data[p + 2] + 9 && data[p] > data[p + 1] * 1.05 ? run + 1 : 0;
    if (run >= 6) {
      edge = y - 5;
      break;
    }
  }
  skyline.push(edge);
}
const edges = skyline.map((_, x) => {
  const neighbors = skyline
    .slice(Math.max(0, x - 25), Math.min(info.width, x + 26))
    .sort((a, b) => a - b);
  return neighbors[Math.floor(neighbors.length / 2)];
});
for (let p = 0; p < data.length; p += 4) {
  const r = data[p],
    g = data[p + 1],
    b = data[p + 2];
  const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
  base[p] = Math.min(255, 25 + 245 * lum);
  base[p + 1] = Math.min(255, 15 + 137 * lum ** 1.3);
  base[p + 2] = Math.min(255, 23 + 101 * lum ** 1.6);
  front[p] = base[p];
  front[p + 1] = base[p + 1];
  front[p + 2] = base[p + 2];
  const y = Math.floor(p / 4 / info.width) / info.height;
  const shade = 1 - Math.max(0, y - 0.45) * 0.65;
  for (let c = 0; c < 3; c++) {
    base[p + c] *= shade;
    front[p + c] = base[p + c];
  }
  front[p + 3] = Math.round(
    255 *
      Math.max(
        0,
        Math.min(1, (y * info.height - edges[(p / 4) % info.width]) / 3),
      ),
  );
}
await sharp(base, { raw: info })
  .webp({ quality: 88 })
  .toFile("public/assets/atlas-cosmic-cliffs.webp");
await sharp(front, { raw: info })
  .webp({ quality: 90 })
  .toFile("public/assets/atlas-cosmic-foreground.webp");
await sharp(base, { raw: info })
  .resize(900)
  .webp({ quality: 85 })
  .toFile("public/assets/atlas-cosmic-mobile.webp");
await sharp(front, { raw: info })
  .resize(900)
  .webp({ quality: 85 })
  .toFile("public/assets/atlas-cosmic-foreground-mobile.webp");
console.log("Atlas bitmap layers prepared from credited NASA source.");
const mark = renderToStaticMarkup(
  createElement(MoveUpRight, { color: "#181b1e", size: 40, strokeWidth: 3 }),
);
await sharp({
  create: { width: 64, height: 64, channels: 4, background: "#ed553b" },
})
  .composite([{ input: Buffer.from(mark), gravity: "center" }])
  .png()
  .toFile("public/assets/atlas-icon.png");
