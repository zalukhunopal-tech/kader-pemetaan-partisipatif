import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Aturan UI yang dijaga otomatis (lihat CLAUDE.md, bagian "Aturan UI").
 *
 * 1. Tanpa label bertanda "&". Bila satu kontrol mewakili dua hal, pakai satu kata yang mewakili
 *    keduanya ("Lapisan", bukan "Peta Dasar & Lapisan"); dalam kalimat pakai "dan".
 * 2. Kontrol yang mengapung di atas peta tinggal di grid HUD (.avz-hud) agar tidak bisa bertumpuk.
 *    Pemeriksaan tumpang tindih di browser ada di e2e/peta-tata-letak.spec.ts.
 */

const AKAR = resolve(__dirname, "..");

/** Berkas yang isinya bukan label antarmuka */
const DIKECUALIKAN = new Set([
  "lib/skripAppsScript.ts", // salinan Code.gs, dibuat oleh skrip
  "lib/atributPrmAid.ts" // nama kelas baku dari standar PRM-AID dan SNI, harus sama persis
]);

function semuaBerkas(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return nama === "__tests__" ? [] : semuaBerkas(jalur);
    return /\.(ts|tsx)$/.test(nama) && !/\.test\.tsx?$/.test(nama) && !nama.endsWith(".d.ts") ? [jalur] : [];
  });
}

/** Teks yang bisa tampil ke pengguna: literal string, template, dan teks JSX (komentar dan regex tidak ikut) */
function teksTampil(berkas: string, kode: string): string[] {
  const sumber = ts.createSourceFile(
    berkas,
    kode,
    ts.ScriptTarget.Latest,
    true,
    berkas.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const hasil: string[] = [];
  const kunjungi = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) hasil.push(n.text);
    else if (ts.isTemplateExpression(n)) hasil.push(n.head.text, ...n.templateSpans.map((x) => x.literal.text));
    else if (ts.isJsxText(n)) hasil.push(n.text);
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sumber);
  return hasil;
}

const ENTITAS_HTML = new Set(["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]);

describe("Aturan UI", () => {
  it("tidak ada label yang memakai tanda & (ganti dengan satu kata yang mewakili, atau 'dan' dalam kalimat)", () => {
    const pelanggaran: string[] = [];
    for (const berkas of semuaBerkas(AKAR)) {
      const rel = relative(AKAR, berkas).split("\\").join("/");
      if (DIKECUALIKAN.has(rel)) continue;
      for (const teks of teksTampil(berkas, readFileSync(berkas, "utf8"))) {
        if (ENTITAS_HTML.has(teks.trim())) continue;
        // "A & B" atau "A &amp; B" di antara kata; "&" tunggal (mis. pemisah query URL) bukan label
        if (/\S\s*(&|&amp;)\s*\S/.test(teks) && /[A-Za-z0-9)]\s+(&|&amp;)\s+[A-Za-z0-9(]/.test(teks)) {
          pelanggaran.push(`${rel}: "${teks.trim().slice(0, 80)}"`);
        }
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it("kontrol di atas peta berada di grid HUD (kotak lokasi, kompas, zoom, panel, skala, bilah alat)", () => {
    const peta = readFileSync(resolve(AKAR, "components/InteractiveMap.tsx"), "utf8");
    const awalHud = peta.indexOf('<div className="avz-hud">');
    const akhirHud = peta.indexOf("{/* POPOVER LAPISAN");
    expect(awalHud).toBeGreaterThan(-1);
    expect(akhirHud).toBeGreaterThan(awalHud);
    const hud = peta.slice(awalHud, akhirHud);
    for (const bagian of [
      "<ChipKoordinatPeta",
      "avz-kompas-pod",
      '<RailAlatPeta bagian="zoom"',
      "<PanelPerekaman",
      "field-resume-draft",
      "map-feature-strip",
      "avenza-scale-bar-wrap",
      'id="atribusi-peta"',
      '<RailAlatPeta bagian="alat"'
    ]) {
      expect(hud, `${bagian} harus berada di dalam .avz-hud`).toContain(bagian);
    }
    // Di luar grid hanya boleh ada satu salinan tiap kontrol (tidak ada versi kedua yang mengapung sendiri)
    expect(peta.split("<RailAlatPeta").length - 1).toBe(2);
    expect(peta.split("<PanelPerekaman").length - 1).toBe(1);

    const css = readFileSync(resolve(AKAR, "styles/petaAvenza.css"), "utf8");
    expect(css).toMatch(/\.avz-hud\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(/grid-template-rows:\s*auto minmax\(0, 1fr\) minmax\(0, auto\) auto/);
  });
});
