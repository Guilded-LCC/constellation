import sharp from "sharp";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL("../verification/", import.meta.url));
const temp = "C:/Users/Sailish/AppData/Local/Temp/";
const sources = {
  roles: { file: "codex-clipboard-d8f4b47b-c7b0-43cc-85b6-a61e86041777.png" },
  overview: {
    file: "codex-clipboard-4764d492-f036-4b76-9fbe-dc095b688a3b.png",
    crop: { left: 115, top: 1495, width: 995, height: 520 },
  },
  dropdown: {
    file: "codex-clipboard-4764d492-f036-4b76-9fbe-dc095b688a3b.png",
    crop: { left: 115, top: 88, width: 995, height: 545 },
  },
  chat: {
    file: "codex-clipboard-9ab5f381-fce2-4ddc-b68b-fbe92c43e2ba.png",
    crop: { left: 115, top: 90, width: 990, height: 545 },
  },
};
for (const [view, ref] of Object.entries(sources))
  for (const width of [1280, 900, 390]) {
    let source = sharp(temp + ref.file);
    if (ref.crop) source = source.extract(ref.crop);
    const reference = await source
      .resize(width, 800, {
        fit: "contain",
        position: "northwest",
        withoutEnlargement: true,
        background: "#373941",
      })
      .png()
      .toBuffer();
    const current = await sharp(
      output + `phase-a-existing-${view}-${width}.png`,
    )
      .png()
      .toBuffer();
    const labels = Buffer.from(
      `<svg width="${width * 2 + 20}" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#17191e"/><text x="12" y="25" fill="white" font-family="Arial" font-size="15">Guilded reference</text><text x="${width + 32}" y="25" fill="white" font-family="Arial" font-size="15">Constellation · ${view} · ${width}×800</text></svg>`,
    );
    await sharp({
      create: {
        width: width * 2 + 20,
        height: 838,
        channels: 4,
        background: "#17191e",
      },
    })
      .composite([
        { input: labels, top: 0, left: 0 },
        { input: reference, top: 38, left: 0 },
        { input: current, top: 38, left: width + 20 },
      ])
      .png()
      .toFile(output + `phase-a-compare-${view}-${width}.png`);
  }
console.log(
  "Saved 12 comparisons using supplied reference screenshots and actual Playwright captures.",
);
