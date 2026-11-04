/**
 * Utilitas pembersih dan penyingkat label peta adaptif.
 * Memastikan nama berkas atau label spasial yang panjang (misalnya GeoPDF/PMTiles)
 * tampil ringkas, adaptif di layar HP/mobile, tidak overlap dengan kotak dialog,
 * tidak terpotong sembarangan (tidak ke-enter ke bawah), dan tetap mempertahankan makna esensial.
 */

/**
 * Menyederhanakan dan mengadaptasikan nama peta/label spasial agar ringkas,
 * mudah dibaca di layar HP/mobile, tidak terpotong sembarangan,
 * dan tetap mempertahankan makna esensial wilayah/fungsinya.
 */
export function singkatkanLabelPeta(nama: string, maxLen = 30): string {
  if (!nama) return "";

  // 1. Bersihkan ekstensi berkas spasial umum
  let bersih = nama.replace(
    /\.(geopdf|pdf|pmtiles|mbtiles|geotiff|tiff|tif|geojson|json|gpx|kml|kmz)$/i,
    ""
  );

  // 2. Ubah underscore (_) dan tanda strip berulang (-) menjadi spasi
  bersih = bersih.replace(/[_\-]+/g, " ").trim();

  // 3. Singkatkan istilah administratif, wilayah, dan fungsi tutupan lahan
  const kamusSingkatan: [RegExp, string][] = [
    [/\bKecamatan\b/gi, "Kec."],
    [/\bKabupaten\b/gi, "Kab."],
    [/\bProvinsi\b/gi, "Prov."],
    [/\bKelurahan\b/gi, "Kel."],
    [/\bDesa\b/gi, "Ds."],
    [/\bTanjung\b/gi, "Tg."],
    [/\bKawasan\b/gi, "Kws."],
    [/\bHutan\b/gi, "Htn."],
    [/\bLindung\b/gi, "Ldg."],
    [/\bProduksi\b/gi, "Prod."],
    [/\bKonservasi\b/gi, "Kons."],
    [/\bPenggunaan\b/gi, "Peng."],
    [/\bLainnya?\b/gi, "Lain"],
    [/\bPartisipatif\b/gi, "Part."],
    [/\bKeanekaragaman\b/gi, "Kehati"],
    [/\bHayati\b/gi, ""],
    [/\bMasyarakat\b/gi, "Masy."],
    [/\bWilayah\b/gi, "Wil."],
    [/\bAdat\b/gi, "Adat"]
  ];

  for (const [pola, ganti] of kamusSingkatan) {
    bersih = bersih.replace(pola, ganti);
  }

  // Rapikan spasi berlebih
  bersih = bersih.replace(/\s+/g, " ").trim();

  // Jika panjang masih melebihi batas maxLen, lakukan pemotongan adaptif pada batas kata
  if (bersih.length > maxLen) {
    const kata = bersih.split(" ");
    let hasil = "";
    for (const k of kata) {
      const calon = hasil ? `${hasil} ${k}` : k;
      if (calon.length <= maxLen - 3) {
        hasil = calon;
      } else {
        break;
      }
    }
    if (hasil && hasil.length >= 8) {
      return `${hasil}...`;
    }
    return `${bersih.slice(0, maxLen - 3)}...`;
  }

  return bersih;
}
