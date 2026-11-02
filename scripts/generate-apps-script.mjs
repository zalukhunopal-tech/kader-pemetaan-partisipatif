import { readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
writeFileSync(
  new URL("../src/lib/skripAppsScript.ts", import.meta.url),
  `// Dihasilkan oleh node scripts/generate-apps-script.mjs dari sumber Apps Script.\nexport const KODE_APPS_SCRIPT = ${JSON.stringify(read("../apps-script/Code.gs"))};\n\nexport const MANIFES_APPS_SCRIPT = ${JSON.stringify(read("../apps-script/appsscript.json"))};\n`
);
