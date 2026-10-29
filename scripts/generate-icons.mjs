/* global console */
import fs from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const iconSvg = fs.readFileSync("public/icon.svg", "utf-8");
const maskableSvg = fs.readFileSync("public/icon-maskable.svg", "utf-8");

function renderToPng(svgString, width, height, outputPath) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width }
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Rendered: ${outputPath} (${width}x${height})`);
}

renderToPng(iconSvg, 48, 48, "public/favicon-48.png");
renderToPng(iconSvg, 180, 180, "public/apple-touch-icon.png");
renderToPng(iconSvg, 192, 192, "public/icon-192.png");
renderToPng(iconSvg, 512, 512, "public/icon-512.png");
renderToPng(maskableSvg, 512, 512, "public/icon-maskable-512.png");
console.log("All app icon PNGs generated successfully!");
