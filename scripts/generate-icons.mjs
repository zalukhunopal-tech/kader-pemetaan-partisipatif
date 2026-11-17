/* global console */
import fs from "node:fs";
import { chromium } from "playwright";

const iconSvg = fs.readFileSync("public/icon.svg", "utf-8");
const maskableSvg = fs.readFileSync("public/icon-maskable.svg", "utf-8");

const targets = [
  { svg: iconSvg, size: 48, out: "public/favicon-48.png" },
  { svg: iconSvg, size: 180, out: "public/apple-touch-icon.png" },
  { svg: iconSvg, size: 192, out: "public/icon-192.png" },
  { svg: iconSvg, size: 512, out: "public/icon-512.png" },
  { svg: maskableSvg, size: 512, out: "public/icon-maskable-512.png" }
];

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
});

for (const t of targets) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1
  });
  await page.setContent(
    `<!doctype html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${t.size}px;height:${t.size}px;background:#000000;overflow:hidden}svg{width:${t.size}px;height:${t.size}px;display:block}</style></head><body>${t.svg}</body></html>`
  );
  await page.screenshot({ path: t.out, type: "png" });
  await page.close();
  console.log(`Rendered: ${t.out} (${t.size}x${t.size})`);
}

await browser.close();
console.log("All app icon PNGs generated successfully!");
