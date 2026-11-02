import { AreaPetaOffline, DataSpasialItem } from "../types";
import { eksporKeGeoJSON } from "./geoUtils";
const encoder = new TextEncoder();
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** ZIP STORE standar, tanpa dependency/jaringan. Nama berkas dibatasi pada nama internal. */
export function buatZipLokal(files: { nama: string; isi: string }[]): Uint8Array {
  const locals: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0,
    total = 0;
  for (const f of files) {
    const nama = encoder.encode(f.nama),
      bytes = encoder.encode(f.isi);
    total += bytes.length;
    if (total > 128 * 1024 * 1024) throw new Error("Cadangan melebihi 128 MB. Ekspor data per bagian.");
    const crc = crc32(bytes),
      local = new Uint8Array(30 + nama.length + bytes.length),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, bytes.length, true);
    l.setUint32(22, bytes.length, true);
    l.setUint16(26, nama.length, true);
    local.set(nama, 30);
    local.set(bytes, 30 + nama.length);
    const entry = new Uint8Array(46 + nama.length),
      c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, nama.length, true);
    c.setUint32(42, offset, true);
    entry.set(nama, 46);
    locals.push(local);
    central.push(entry);
    offset += local.length;
  }
  const size = central.reduce((n, a) => n + a.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const b of [...locals, ...central, end]) {
    result.set(b, at);
    at += b.length;
  }
  return result;
}
export function cadanganSurveiZip(data: DataSpasialItem[], peta: AreaPetaOffline[]): Uint8Array {
  return buatZipLokal([
    { nama: "survei.geojson", isi: eksporKeGeoJSON(data) },
    { nama: "survei-lengkap.json", isi: JSON.stringify({ versi: 1, dibuatPada: new Date().toISOString(), data }, null, 2) },
    {
      nama: "peta-metadata.json",
      isi: JSON.stringify(
        peta.map((p) => ({
          ...p,
          petaKustomDataUrl: undefined,
          thumbnailDataUrl: undefined,
          petaKustomUrl: undefined,
          thumbnailUrl: undefined
        })),
        null,
        2
      )
    },
    {
      nama: "BACA-SAYA.txt",
      isi: "Cadangan survei Titik Tapak. survei.geojson untuk GIS; survei-lengkap.json memuat atribut, foto dan memo suara data URL. Berkas peta offline dan akun/sandi tidak termasuk. Simpan arsip pada perangkat/penyimpanan yang Anda percaya."
    }
  ]);
}
export function unduhLokal(nama: string, isi: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([isi], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
