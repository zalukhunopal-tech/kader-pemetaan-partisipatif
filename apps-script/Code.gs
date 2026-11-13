/**
 * TITIK TAPAK - PENERIMA DATA DI GOOGLE DRIVE (Code.gs)
 *
 * Dipasang SEKALI oleh pemilik Google Drive tujuan (langkah lengkap di README, bagian "Google Drive"):
 *   1. Buka script.google.com > Proyek baru, tempel berkas ini sebagai Code.gs dan appsscript.json.
 *   2. Pilih fungsi pasangTitikTapak > Jalankan, lalu izinkan aksesnya. Log menampilkan token.
 *   3. Terapkan > Deployment baru > Aplikasi web: Jalankan sebagai "Saya", Akses "Siapa saja".
 *   4. Isi URL berakhiran /exec ke VITE_GDRIVE_URL dan token ke VITE_GDRIVE_TOKEN, lalu build ulang aplikasi.
 *
 * Setelah itu tidak ada lagi yang perlu diatur. Folder dibuat otomatis saat data masuk:
 *
 * Titik_Tapak_Database/
 *   Master_Data_Titik_Tapak                     Spreadsheet, satu baris per objek
 *   <Provinsi>/<Kabupaten atau Kota>/<Kecamatan>/<Kelurahan atau Desa>/
 *     budi_sebaran_anggrek_november_2026.geojson      semua objek "Sebaran Anggrek" milik Budi, November 2026
 *     budi_sebaran_anggrek_november_2026_foto_1.jpg
 *
 * Nama berkas = nama akun pembuat, nama data (judul objek), bulan dan tahun perekaman. Wilayah diambil dari
 * akun pembuat yang diisi admin; tingkat yang kosong masuk folder Wilayah_Belum_Diisi.
 *
 * Penyimpanan idempoten & diperkeras (hardened):
 * - Perbandingan token waktu-tetap (constant-time)
 * - Pencegahan timpa lintas kader (anti-IDOR berdasarkan ID_Kader)
 * - Sanitasi formula spreadsheet (mencegah CSV/Spreadsheet Formula Injection pada sel berawalan =,+,-,@)
 * - Batas ukuran blob foto (maksimal 2 MB per foto)
 */

var NAMA_FOLDER_INDUK = "Titik_Tapak_Database";
var NAMA_SPREADSHEET = "Master_Data_Titik_Tapak";
var NAMA_TAB = "Data_Spasial";
var TAB_POLYGON = "Polygon";
var TAB_LINE = "Line";
var TAB_POINT = "Point";

var KOLOM_POLYGON = ["label", "luas_ha", "keterangan", "url", "tepi", "warna"];
var KOLOM_LINE = ["label", "panjang_m", "keterangan", "url", "warna"];
var KOLOM_POINT = ["label", "kategori", "keterangan", "url", "simbol"];
var BELUM_DIISI = "Wilayah_Belum_Diisi";
var BATAS_FOTO_BYTE = 2 * 1024 * 1024;
var NAMA_BULAN = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember"
];

var KOLOM = [
  "ID_Data",
  "ID_Kader",
  "Nama_Kader",
  "Provinsi",
  "Kabupaten_Kota",
  "Kecamatan",
  "Kelurahan_Desa",
  "Jenis_Geometri",
  "Kategori",
  "Judul",
  "Nama_Lokal",
  "Nama_Ilmiah",
  "Jumlah_Individu",
  "Panjang_Km",
  "Luas_Ha",
  "Koordinat_WKT",
  "Nama_Berkas",
  "Tautan_Berkas",
  "Tautan_Foto_Drive",
  "Status_Verifikasi",
  "Waktu_Rekam",
  "Waktu_Sinkron",
  "ID_Berkas",
  "Catatan_Admin"
];
var K = {};
for (var k = 0; k < KOLOM.length; k++) K[KOLOM[k]] = k;

/** Jalankan sekali dari editor: membuat folder induk, spreadsheet, dan token, lalu menampilkannya di Log */
function pasangTitikTapak() {
  var props = PropertiesService.getScriptProperties();
  var induk = folderInduk_();
  var ss = spreadsheetInduk_(induk);
  var token = props.getProperty("TITIK_TAPAK_TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "");
    props.setProperty("TITIK_TAPAK_TOKEN", token);
  }
  Logger.log("Folder data : " + induk.getUrl());
  Logger.log("Spreadsheet : " + ss.getUrl());
  Logger.log("Token       : " + token);
  Logger.log(
    "Berikutnya: Terapkan > Deployment baru > Aplikasi web (Jalankan sebagai: Saya, Akses: Siapa saja). " +
      "Isi URL /exec ke VITE_GDRIVE_URL dan token di atas ke VITE_GDRIVE_TOKEN, lalu build ulang aplikasi."
  );
  return { folder: induk.getUrl(), spreadsheet: ss.getUrl(), token: token };
}

/** Alias kompatibilitas: memanggil pasangTitikTapak */
function pasangGeoKader() {
  return pasangTitikTapak();
}

/** Membuka URL Web App di browser menampilkan status, untuk memeriksa pemasangan */
function doGet() {
  return balas_({ sukses: true, pesan: "Penerima data Titik Tapak aktif." });
}

/** Perbandingan waktu-tetap agar token tidak dapat ditebak karakter demi karakter lewat selisih waktu */
function samaWaktuTetap_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  var selisih = 0;
  for (var i = 0; i < a.length; i++) {
    selisih |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return selisih === 0;
}

/** Menetralkan awalan formula berbahaya (=, +, -, @, tab, CR) agar tidak dieksekusi di Google Sheets */
function sanitasiSel_(nilai) {
  if (nilai === undefined || nilai === null) return "";
  if (typeof nilai === "number") return nilai;
  var s = String(nilai);
  if (/^[=+\-@]/.test(s) && !/^-[0-9]+(\.[0-9]+)?$/.test(s)) {
    return "'" + s;
  }
  if (/^[\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = JSON.parse(e.postData.contents);

    var tokenTersimpan = PropertiesService.getScriptProperties().getProperty("TITIK_TAPAK_TOKEN");
    if (!tokenTersimpan) {
      return balas_({
        sukses: false,
        pesan: "TITIK_TAPAK_TOKEN belum diatur. Jalankan fungsi pasangTitikTapak sekali di editor Apps Script."
      });
    }
    if (!samaWaktuTetap_(body.token, tokenTersimpan)) {
      return balas_({ sukses: false, protokol: 3, pesan: "Token tidak cocok. Samakan VITE_GDRIVE_TOKEN aplikasi dengan token dari pasangTitikTapak." });
    }

    if (/^sync_(capabilities|metadata_v3|chunk_v3|finalize_v3)$/.test(String(body.action))) return balas_(sinkronV3_(body));

    var induk = folderInduk_();
    var sheet = tabData_(spreadsheetInduk_(induk));

    var barisAda = {};
    var jmlBaris = sheet.getLastRow();
    if (jmlBaris > 1) {
      var idAda = sheet.getRange(2, 1, jmlBaris - 1, 1).getValues();
      for (var i = 0; i < idAda.length; i++) barisAda[String(idAda[i][0])] = i + 2;
    }

    var fiturPerId = {};
    if (body.geojsonBundle) {
      var fitur = JSON.parse(body.geojsonBundle).features || [];
      for (var f = 0; f < fitur.length; f++) fiturPerId[String(fitur[f].id)] = fitur[f];
    }

    var konteks = { induk: induk, sheet: sheet, barisAda: barisAda, folder: {}, waktu: new Date().toISOString() };
    if (body.action === "rename_wilayah_folder" || body.action === "migrasi_wilayah") {
      return balas_(migrasiFolderWilayah_(body, konteks));
    }

    var records = body.records || [];
    var diterima = [];
    var gagal = [];
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      try {
        simpanRekaman_(r, fiturPerId[String(r.id)], konteks);
        diterima.push(r.id);
      } catch (err) {
        gagal.push({ id: r.id, pesan: String(err && err.message ? err.message : err) });
      }
    }

    return balas_({ sukses: gagal.length === 0, diterima: diterima, gagal: gagal, jumlah: diterima.length });
  } catch (err) {
    return balas_({ sukses: false, protokol: 3, pesan: String(err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

/** Satu objek: GeoJSON di folder desanya, foto (sekali), dan baris di spreadsheet induk */
function simpanRekaman_(r, fitur, konteks) {
  var id = String(r.id);
  var w = wilayahRekaman_(r);
  var folderDesa = folderWilayah_(konteks, w);
  var nama = namaBerkasRekaman_(r);

  var baris = konteks.barisAda[id];
  var lama = baris ? konteks.sheet.getRange(baris, 1, 1, KOLOM.length).getValues()[0] : null;

  // Cegah penimpaan data lintas kader (Anti-IDOR)
  if (lama) {
    var idKaderLama = String(lama[K.ID_Kader] || "");
    if (idKaderLama && idKaderLama !== String(r.idKader || "")) {
      throw new Error("ID data milik kader lain tidak boleh ditimpa.");
    }
  }

  // Foto lebih dulu: foto rusak atau terlalu besar menggagalkan data ini sebelum ada yang ditulis ke berkas GeoJSON
  var fotoUrl = lama ? String(lama[K.Tautan_Foto_Drive] || "") : "";
  if ((!fotoUrl || konteks.protokolV3) && r.fotoBase64 && String(r.fotoBase64).indexOf("base64,") !== -1) {
    var bytes = Utilities.base64Decode(String(r.fotoBase64).split("base64,")[1]);
    if (bytes.length > BATAS_FOTO_BYTE) {
      throw new Error("Ukuran foto melebihi batas 2 MB.");
    }
    var namaFoto = konteks.protokolV3 ? nama + "_foto_" + hashTeksV3_(id + sha256V3_(bytes)) + ".jpg" : nama + "_foto_" + nomorFotoBerikut_(folderDesa, nama) + ".jpg";
    var fotoAda = konteks.protokolV3 ? berkasAktif_(folderDesa.getFilesByName(namaFoto)) : null;
    fotoUrl = (fotoAda || folderDesa.createFile(Utilities.newBlob(bytes, "image/jpeg", namaFoto))).getUrl();
  }

  var fiturSiap = siapkanFiturRekaman_(r, fitur, fotoUrl);
  var berkas = simpanFitur_(folderDesa, nama + ".geojson", id, fiturSiap);
  var idBerkasLama = lama ? String(lama[K.ID_Berkas] || "") : "";
  if (idBerkasLama && idBerkasLama !== berkas.getId()) hapusFiturLama_(idBerkasLama, id);

  // Status yang diubah admin langsung di spreadsheet tidak ditimpa saat data dikirim ulang
  var status = lama ? String(lama[K.Status_Verifikasi] || "Tersinkron_GDrive") : "Tersinkron_GDrive";
  var nilai = [
    sanitasiSel_(id),
    sanitasiSel_(r.idKader),
    sanitasiSel_(r.namaKader),
    sanitasiSel_(w.provinsi),
    sanitasiSel_(w.kabupaten),
    sanitasiSel_(w.kecamatan),
    sanitasiSel_(w.desa),
    sanitasiSel_(r.jenisGeometri),
    sanitasiSel_(r.kategori),
    sanitasiSel_(r.judul),
    sanitasiSel_(r.namaLokal),
    sanitasiSel_(r.namaIlmiah),
    r.jumlahIndividu === undefined ? "" : r.jumlahIndividu,
    r.panjangKm,
    r.luasHa,
    sanitasiSel_(String(r.wkt || "").length > 40000 ? "GEOMETRI_DI_GEOJSON: " + berkas.getUrl() : r.wkt),
    sanitasiSel_(nama),
    berkas.getUrl(),
    fotoUrl,
    sanitasiSel_(status),
    sanitasiSel_(r.createdAt),
    konteks.waktu,
    berkas.getId(),
    lama ? String(lama[K.Catatan_Admin] || "") : ""
  ];
  if (konteks.sebelumTulis) konteks.sebelumTulis(nilai);
  if (baris) {
    konteks.sheet.getRange(baris, 1, 1, nilai.length).setValues([nilai]);
  } else {
    konteks.sheet.appendRow(nilai);
    konteks.barisAda[id] = konteks.sheet.getLastRow();
  }

  // Sinkronkan data ke tabel atribut terstruktur Google Spreadsheet (Polygon, Line, Point) sesuai standar PRM-AID
  try {
    var ssUtama = spreadsheetInduk_(konteks.induk);
    simpanKeTabGeometriPrmAid_(ssUtama, r, fiturSiap.properties);
  } catch (errTab) {
    Logger.log("Peringatan sinkron tab geometri: " + errTab);
  }

  // Automasi migrasi folder: bila wilayah kader kini sudah lengkap, pindahkan rekaman lama kader ini yang masih di Wilayah_Belum_Diisi
  if (r.idKader && wilayahLengkapGs_(w)) {
    migrasiDataKaderKeWilayahBaru_(String(r.idKader), w, folderDesa, konteks, true);
  }
}

function wilayahRekaman_(r) {
  var w = r.wilayah || {};
  return {
    provinsi: namaFolder_(w.provinsi),
    kabupaten: namaFolder_(w.kabupaten),
    kecamatan: namaFolder_(w.kecamatan),
    desa: namaFolder_(w.desa || r.desaWilayah)
  };
}

/** Garis miring diganti (bukan pemisah folder), spasi dirapikan; kosong menjadi Wilayah_Belum_Diisi */
function namaFolder_(s) {
  var t = String(s === undefined || s === null ? "" : s)
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return t && t !== "-" ? t.slice(0, 100) : BELUM_DIISI;
}

function folderWilayah_(konteks, w) {
  var tingkat = [w.provinsi, w.kabupaten, w.kecamatan, w.desa];
  var kunci = tingkat.join("/").toLowerCase();
  if (konteks.folder[kunci]) return konteks.folder[kunci];
  var folder = konteks.induk;
  for (var i = 0; i < tingkat.length; i++) folder = dapatkanAtauBuatFolder_(folder, tingkat[i]);
  konteks.folder[kunci] = folder;
  return folder;
}

/** Nama dari aplikasi (akun_data_bulan_tahun), dibersihkan lagi; dihitung di sini bila aplikasi versi lama */
function namaBerkasRekaman_(r) {
  var dariAplikasi = slug_(r.namaBerkas, 140);
  if (dariAplikasi) return dariAplikasi;
  var t = new Date(r.createdAt);
  if (isNaN(t.getTime())) t = new Date();
  var akun = slug_(r.namaKader, 40) || "kader";
  var data = slug_(r.judul, 60) || slug_(r.kategori, 40) || "data";
  return [akun, data, NAMA_BULAN[t.getMonth()], t.getFullYear()].join("_");
}

function slug_(s, maks) {
  var t = String(s === undefined || s === null ? "" : s).toLowerCase();
  if (t.normalize) t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  t = t.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return t.slice(0, maks).replace(/_+$/, "");
}

/** Memasukkan (atau mengganti) fitur ber-ID ini ke FeatureCollection dalam berkas bernama sama */
function simpanFitur_(folder, namaBerkas, id, fitur) {
  var berkas = berkasAktif_(folder.getFilesByName(namaBerkas));
  var koleksi = null;
  if (berkas) {
    try {
      koleksi = JSON.parse(berkas.getBlob().getDataAsString());
    } catch (e) {}
  }
  if (!koleksi || !koleksi.features) koleksi = { type: "FeatureCollection", features: [] };

  var diganti = false;
  for (var i = 0; i < koleksi.features.length; i++) {
    if (String(koleksi.features[i].id) === id) {
      koleksi.features[i] = fitur;
      diganti = true;
    }
  }
  if (!diganti) koleksi.features.push(fitur);

  var isi = JSON.stringify(koleksi);
  if (berkas) {
    berkas.setContent(isi);
    return berkas;
  }
  return folder.createFile(namaBerkas, isi, MimeType.PLAIN_TEXT);
}

/** Data pindah berkas (nama atau wilayah berubah): keluarkan dari berkas lama, buang berkas yang jadi kosong */
function hapusFiturLama_(idBerkas, id) {
  try {
    var berkas = DriveApp.getFileById(idBerkas);
    if (!/.geojson$/i.test(berkas.getName())) return;
    var koleksi = JSON.parse(berkas.getBlob().getDataAsString());
    if (!koleksi || koleksi.type !== "FeatureCollection" || !Array.isArray(koleksi.features)) return;
    var sisa = [];
    for (var i = 0; i < koleksi.features.length; i++) {
      if (String(koleksi.features[i].id) !== id) sisa.push(koleksi.features[i]);
    }
    if (sisa.length === 0) {
      berkas.setTrashed(true);
    } else {
      koleksi.features = sisa;
      berkas.setContent(JSON.stringify(koleksi));
    }
  } catch (e) {
    // Berkas lama sudah dihapus atau dipindah pemilik Drive: tidak ada yang perlu dibersihkan
  }
}

function fiturCadangan_(r) {
  var geom = geometriDariWktGs_(r.wkt, r.jenisGeometri);
  return { type: "Feature", id: r.id, geometry: geom, properties: susunAtributPrmAidGs_(r, null, "") };
}

function geometriDariWktGs_(wkt, jenis) {
  var s = String(wkt || "").trim();
  var m = s.match(/^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\s*\)$/i);
  if (m) {
    var pt = [Number(m[1]), Number(m[2])];
    if (m[3] !== undefined) pt.push(Number(m[3]));
    return { type: "Point", coordinates: pt };
  }
  var ml = s.match(/^LINESTRING\s*\((.+)\)$/i);
  if (ml) {
    var coords = ml[1].split(",").map(function(pair) {
      var p = pair.trim().split(/\s+/).map(Number);
      return p;
    });
    return { type: "LineString", coordinates: coords };
  }
  var mp = s.match(/^POLYGON\s*\(\((.+)\)\)$/i);
  if (mp) {
    var ring = mp[1].split(",").map(function(pair) {
      var p = pair.trim().split(/\s+/).map(Number);
      return p;
    });
    return { type: "Polygon", coordinates: [ring] };
  }
  void jenis;
  return null;
}

/**
 * Menyusun tabel atribut standar WebGIS PRM-AID + SNI 6502:
 * - Polygon : { label, luas_ha, keterangan, url, tepi, warna }
 * - Line    : { label, panjang_m, keterangan, url, warna }
 * - Point   : { label, kategori, keterangan, url, simbol }
 */
var ATURAN_POLYGON_GS_ = [
  { nama: "Area Penggunaan Lain", k: ["area penggunaan lain", "areal penggunaan lain", "apl"], tepi: "Transparent", warna: "#FFFFFF" },
  { nama: "Hutan Produksi Konversi", k: ["hutan produksi konversi", "hpk"], tepi: "Transparent", warna: "#FF5EFF" },
  { nama: "Hutan Produksi Terbatas", k: ["hutan produksi terbatas", "hpt"], tepi: "Transparent", warna: "#8AF200" },
  { nama: "Hutan Produksi", k: ["hutan produksi"], tepi: "Transparent", warna: "#FFFF00" },
  { nama: "Hutan Lindung", k: ["hutan lindung"], tepi: "Transparent", warna: "#02AD00" },
  { nama: "Hutan Konservasi", k: ["hutan konservasi", "kawasan konservasi"], tepi: "Transparent", warna: "#AD3FFF" },
  { nama: "Zona Religi, Sejarah & Budaya", k: ["zona religi", "sejarah & budaya", "sejarah dan budaya", "zona budaya"], tepi: "Transparent", warna: "#6600CC" },
  { nama: "Zona Khusus", k: ["zona khusus"], tepi: "Transparent", warna: "#969696" },
  { nama: "Zona Rehabilitasi", k: ["zona rehabilitasi"], tepi: "Transparent", warna: "#00FFFF" },
  { nama: "Zona Tradisional", k: ["zona tradisional"], tepi: "Transparent", warna: "#993300" },
  { nama: "Zonasi Pemanfaatan", k: ["zonasi pemanfaatan", "zona pemanfaatan"], tepi: "Transparent", warna: "#94C800" },
  { nama: "Zona Rimba", k: ["zona rimba"], tepi: "Transparent", warna: "#E7E200" },
  { nama: "Zona Inti", k: ["zona inti"], tepi: "Transparent", warna: "#FF0000" },
  { nama: "Ruang Lindung", k: ["ruang lindung"], tepi: "Transparent", warna: "#D32F2F" },
  { nama: "Ruang Pemanfaatan", k: ["ruang pemanfaatan"], tepi: "Transparent", warna: "#00C8FF" },
  { nama: "Hutan Adat", k: ["hutan adat"], tepi: "#4E4E4E", warna: "#4e4e4e" },
  { nama: "Hutan Desa", k: ["hutan desa"], tepi: "#00C8FF", warna: "Transparent" },
  { nama: "Hutan Kemasyarakatan", k: ["hutan kemasyarakatan", "hkm"], tepi: "#004DA8", warna: "Transparent" },
  { nama: "Hutan Tanaman Rakyat", k: ["hutan tanaman rakyat", "htr"], tepi: "#FF3264", warna: "Transparent" },
  { nama: "Kemitraan Kehutanan", k: ["kemitraan kehutanan"], tepi: "#A80000", warna: "Transparent" },
  { nama: "Wilayah MHA", k: ["wilayah mha", "masyarakat hukum adat", "wilayah adat"], tepi: "#8d4513", warna: "#C68642" },
  { nama: "PBPH", k: ["pbph", "perizinan berusaha pemanfaatan hutan", "hph", "hti"], tepi: "#F4A460", warna: "#F4A460" },
  { nama: "Area Perladangan", k: ["area perladangan", "perladangan", "ladang"], tepi: "#000000", warna: "#98E600" },
  { nama: "Area Perkebunan", k: ["area perkebunan", "perkebunan", "kebun"], tepi: "#000000", warna: "#00B050" },
  { nama: "Area Persawahan", k: ["area persawahan", "persawahan", "sawah"], tepi: "#000000", warna: "#FFFF00" },
  { nama: "Provinsi", k: ["provinsi", "batas provinsi"], tepi: "#000000", warna: "Transparent" },
  { nama: "Kabupaten", k: ["kabupaten", "batas kabupaten", "kota"], tepi: "#000000", warna: "Transparent" },
  { nama: "Kecamatan", k: ["kecamatan", "batas kecamatan"], tepi: "#000000", warna: "Transparent" },
  { nama: "Klaster/Lanskap", k: ["klaster", "lanskap"], tepi: "#000000", warna: "Transparent" },
  { nama: "Desa", k: ["batas desa", "wilayah desa", "desa"], tepi: "#000000", warna: "#F5F5DC" },
  { nama: "Mangrove / Rawa", k: ["mangrove", "bakau", "rawa", "gambut"], tepi: "#004D00", warna: "#02AD00" },
  { nama: "Badan Air / Danau", k: ["danau", "waduk", "embung", "kolam", "tambak", "perairan"], tepi: "#004DA8", warna: "#00BFFF" }
];

var FALLBACK_POLYGON_GS_ = {
  "Wilayah Adat / Lahan": { tepi: "#8d4513", warna: "#C68642" },
  "Flora": { tepi: "#004D00", warna: "#02AD00" },
  "Fauna": { tepi: "#6600CC", warna: "#AD3FFF" },
  "Mata Air": { tepi: "#004DA8", warna: "#00BFFF" },
  "Tanda Batas": { tepi: "#000000", warna: "Transparent" },
  "Ancaman / Temuan": { tepi: "#A80000", warna: "#FF0000" },
  "Sarana Desa": { tepi: "#000000", warna: "#F5F5DC" },
  "Situs Budaya": { tepi: "#4A0099", warna: "#6600CC" }
};

var ATURAN_POINT_GS_ = [
  { kat: "Kuburan", k: ["kuburan", "makam", "tpu", "pemakaman", "pekuburan"], s: "cross.png" },
  { kat: "Sanitasi", k: ["sampah", "tps", "tpa", "limbah", "daur ulang"], s: "trash.png" },
  { kat: "Sanitasi", k: ["sanitasi", "mck", "toilet", "jamban", "wc", "kamar mandi"], s: "toilets.png" },
  { kat: "Sanitasi", k: ["bak air bersih", "air bersih", "pdam", "sumur bor", "pipa air"], s: "water.png" },
  { kat: "Komunikasi", k: ["wifi", "internet", "hotspot", "starlink"], s: "wifi.png" },
  { kat: "Komunikasi", k: ["telepon", "telkom", "wartel"], s: "telephone.png" },
  { kat: "Komunikasi", k: ["komunikasi", "tower", "bts", "pemancar", "antena", "sinyal", "radio"], s: "tower.png" },
  { kat: "Transportasi", k: ["bandara", "bandar udara", "lapangan terbang", "airstrip", "helipad"], s: "airport.png" },
  { kat: "Transportasi", k: ["pelabuhan", "dermaga", "tambatan perahu", "ketinting", "longboat", "ferry"], s: "port.png" },
  { kat: "Transportasi", k: ["terminal", "halte", "bus", "angkot", "damri"], s: "bus.png" },
  { kat: "Transportasi", k: ["parkir", "garasi"], s: "parking.png" },
  { kat: "Transportasi", k: ["transportasi", "jembatan", "gantung", "gorong-gorong", "simpang"], s: "bridge.png" },
  { kat: "Pendidikan", k: ["perpustakaan", "taman baca", "rumah baca"], s: "library.png" },
  { kat: "Pendidikan", k: ["universitas", "kampus", "akademi", "sekolah tinggi"], s: "university.png" },
  { kat: "Pendidikan", k: ["pendidikan", "sekolah", "sd", "sdn", "smp", "smpn", "sma", "sman", "smk", "paud", "tk", "madrasah", "pesantren"], s: "school.png" },
  { kat: "Kesehatan", k: ["posyandu", "polindes", "poskesdes", "bidan", "dokter", "klinik", "apotek"], s: "doctor.png" },
  { kat: "Kesehatan", k: ["kesehatan", "puskesmas", "pustu", "rumah sakit", "rsud", "balai pengobatan"], s: "hospital.png" },
  { kat: "Agama", k: ["masjid", "mushola", "musala", "surau", "langgar", "islamic"], s: "mosque.png" },
  { kat: "Agama", k: ["pura", "vihara", "klenteng", "pagoda"], s: "pagoda.png" },
  { kat: "Agama", k: ["kapel"], s: "chapel.png" },
  { kat: "Agama", k: ["agama", "gereja", "gkii", "gpib", "gmim", "hkbp", "katolik", "protestan", "rumah ibadah", "tempat ibadah"], s: "church.png" },
  { kat: "Tempat Pertemuan", k: ["kantor desa", "kantor kepala desa", "kantor camat", "kantor adat", "kantor", "rumah dinas", "sekretariat"], s: "home.png" },
  { kat: "Tempat Pertemuan", k: ["tempat pertemuan", "balai pertemuan", "bpu", "balai desa", "balai adat", "aula", "gedung pertemuan", "pendopo"], s: "conference.png" },
  { kat: "Situs Budaya", k: ["museum", "rumah adat", "lamin", "uma dado"], s: "museum.png" },
  { kat: "Situs Budaya", k: ["patung", "arca", "ukiran"], s: "statue.png" },
  { kat: "Situs Budaya", k: ["situs budaya", "cagar budaya", "situs", "budaya", "sejarah", "batu adat", "tugu", "monumen", "keramat", "leluhur"], s: "monument.png" },
  { kat: "Mata Air", k: ["air terjun", "curug", "rueb", "riam", "jeram"], s: "waterfall.png" },
  { kat: "Mata Air", k: ["dam", "bendungan", "pintu air", "irigasi", "embung"], s: "dam.png" },
  { kat: "Mata Air", k: ["danau", "telaga", "kolam"], s: "lake.png" },
  { kat: "Mata Air", k: ["mata air", "sumber air", "sumur", "pancuran"], s: "water.png" },
  { kat: "Flora", k: ["sawah", "ladang", "kebun", "pertanian", "padi"], s: "agriculture.png" },
  { kat: "Flora", k: ["anggrek", "bunga", "tanaman obat", "herbal", "taman"], s: "garden.png" },
  { kat: "Flora", k: ["pohon", "kayu", "meranti", "bengkirai", "ulin", "hutan", "mangrove", "bambu", "rotan", "flora"], s: "forest.png" },
  { kat: "Fauna", k: ["satwa", "hewan", "harimau", "orangutan", "burung", "rangkong", "ikan", "jejak", "sarang", "fauna"], s: "animals.png" },
  { kat: "Ancaman / Temuan", k: ["banjir", "genangan", "abrasi"], s: "flood.png" },
  { kat: "Ancaman / Temuan", k: ["tambang", "galian", "emas", "batubara", "kuari"], s: "mine.png" },
  { kat: "Ancaman / Temuan", k: ["kebakaran", "api", "titik panas", "hotspot", "pembalakan", "illegal logging", "longsor", "ancaman", "kerusakan"], s: "fire.png" },
  { kat: "Sarana Desa", k: ["bumdes", "koperasi", "bank", "pasar", "warung", "toko", "ekonomi"], s: "bank.png" },
  { kat: "Sarana Desa", k: ["lapangan", "olahraga", "bola", "voli", "stadion"], s: "soccer.png" },
  { kat: "Sarana Desa", k: ["poskamling", "pos keamanan", "polisi", "polsek", "koramil", "babinsa"], s: "police.png" },
  { kat: "Toponimi", k: ["gua", "liang"], s: "cave.png" },
  { kat: "Toponimi", k: ["bukit", "gunung", "buduk", "puncak", "tanjung", "pulau", "toponimi"], s: "default.png" },
  { kat: "Tanda Batas", k: ["tanda batas", "patok", "pilar", "batas desa", "batas wilayah", "batas adat", "batas"], s: "default-icon.png" }
];

var FALLBACK_POINT_GS_ = {
  "Kuburan": "cross.png",
  "Sanitasi": "toilets.png",
  "Komunikasi": "tower.png",
  "Transportasi": "bridge.png",
  "Pendidikan": "school.png",
  "Kesehatan": "hospital.png",
  "Agama": "church.png",
  "Tempat Pertemuan": "conference.png",
  "Situs Budaya": "monument.png",
  "Flora": "forest.png",
  "Fauna": "animals.png",
  "Mata Air": "water.png",
  "Tanda Batas": "default-icon.png",
  "Ancaman / Temuan": "fire.png",
  "Wilayah Adat / Lahan": "agriculture.png",
  "Sarana Desa": "default-icon.png"
};

function gayaPolygonPrmAidGs_(label, kategori, keterangan, tepiAwal, warnaAwal) {
  var tepi = String(tepiAwal || "").trim();
  var warna = String(warnaAwal || "").trim();
  if (tepi && warna) return { tepi: tepi, warna: warna };
  var teksUtama = [label, keterangan].join(" ").toLowerCase();
  for (var i = 0; i < ATURAN_POLYGON_GS_.length; i++) {
    var a = ATURAN_POLYGON_GS_[i];
    for (var j = 0; j < a.k.length; j++) {
      if (teksUtama.indexOf(a.k[j]) !== -1) {
        return { tepi: tepi || a.tepi, warna: warna || a.warna };
      }
    }
  }
  var teksKat = String(kategori || "").toLowerCase();
  for (var m = 0; m < ATURAN_POLYGON_GS_.length; m++) {
    var ak = ATURAN_POLYGON_GS_[m];
    for (var n = 0; n < ak.k.length; n++) {
      if (teksKat.indexOf(ak.k[n]) !== -1) {
        return { tepi: tepi || ak.tepi, warna: warna || ak.warna };
      }
    }
  }
  var fb = FALLBACK_POLYGON_GS_[String(kategori || "")] || FALLBACK_POLYGON_GS_["Wilayah Adat / Lahan"];
  return { tepi: tepi || fb.tepi, warna: warna || fb.warna };
}

function warnaLinePrmAidGs_(label, kategori, keterangan, warnaAwal) {
  var warna = String(warnaAwal || "").trim();
  if (warna) return warna;
  var gabungan = [label, keterangan, kategori].join(" ").toLowerCase();
  var sungai = ["sungai", "pa ", "pa'", "aliran", "kali", "parit", "irigasi", "saluran", "air"];
  for (var i = 0; i < sungai.length; i++) if (gabungan.indexOf(sungai[i]) !== -1) return "#00BFFF";
  var jalan = ["jalan", "jalur", "jembatan", "gang", "akses", "setapak", "poros", "trans"];
  for (var j = 0; j < jalan.length; j++) if (gabungan.indexOf(jalan[j]) !== -1) return "#FF0000";
  var batas = ["batas rt", "batas rw", "batas dusun", "batas lingkungan", "batas desa", "batas kecamatan", "batas kabupaten", "batas provinsi", "batas wilayah", "batas adat"];
  for (var b = 0; b < batas.length; b++) if (gabungan.indexOf(batas[b]) !== -1) return "#FFCC99";
  var fbLine = {
    "Mata Air": "#00BFFF",
    "Sarana Desa": "#FF0000",
    "Tanda Batas": "#FFCC99",
    "Flora": "#02AD00",
    "Fauna": "#AD3FFF",
    "Ancaman / Temuan": "#FF0000",
    "Wilayah Adat / Lahan": "#8d4513",
    "Situs Budaya": "#6600CC"
  };
  return fbLine[String(kategori || "")] || "#FF0000";
}

function simbolPointPrmAidGs_(label, kategori, keterangan, simbolAwal) {
  var katAsli = String(kategori || "").trim();
  var simbol = String(simbolAwal || "").trim();
  var gabungan = [label, keterangan, katAsli].join(" ").toLowerCase();
  if (katAsli && FALLBACK_POINT_GS_[katAsli] && katAsli !== "Sarana Desa") {
    for (var i = 0; i < ATURAN_POINT_GS_.length; i++) {
      var a = ATURAN_POINT_GS_[i];
      if (a.kat === katAsli) {
        for (var j = 0; j < a.k.length; j++) {
          if (gabungan.indexOf(a.k[j]) !== -1) return { kategori: katAsli, simbol: simbol || a.s };
        }
      }
    }
    return { kategori: katAsli, simbol: simbol || FALLBACK_POINT_GS_[katAsli] };
  }
  for (var m = 0; m < ATURAN_POINT_GS_.length; m++) {
    var at = ATURAN_POINT_GS_[m];
    for (var n = 0; n < at.k.length; n++) {
      if (gabungan.indexOf(at.k[n]) !== -1) {
        var katHasil = !katAsli || katAsli === "Sarana Desa" ? at.kat : katAsli;
        return { kategori: katHasil, simbol: simbol || at.s };
      }
    }
  }
  if (katAsli && FALLBACK_POINT_GS_[katAsli]) {
    return { kategori: katAsli, simbol: simbol || FALLBACK_POINT_GS_[katAsli] };
  }
  return { kategori: katAsli || "Fasilitas Umum", simbol: simbol || "default-icon.png" };
}

function sanitasiUrlGs_(urlMentah) {
  var s = String(urlMentah || "").trim();
  if (!s) return "";
  if (/^(?:https?:\/\/|\/|\.\/)/i.test(s)) {
    return s.replace(/[\r\n\t]/g, "").trim();
  }
  return "";
}

function susunAtributPrmAidGs_(r, fitur, fotoUrl) {
  var pLama = (fitur && fitur.properties) || {};
  var label = String(r.judul || r.label || pLama.label || pLama.judul || "").trim();
  var ket = String(r.deskripsi || r.keterangan || pLama.keterangan || pLama.deskripsi || "").trim();
  if (!ket) {
    var bagian = [];
    if (r.namaLokal && String(r.namaLokal).trim()) bagian.push(String(r.namaLokal).trim());
    if (r.namaIlmiah && String(r.namaIlmiah).trim()) bagian.push("(" + String(r.namaIlmiah).trim() + ")");
    ket = bagian.length > 0 ? bagian.join(" ") : String(r.kategori || pLama.kategori || "").trim();
  }
  var url = sanitasiUrlGs_(fotoUrl || r.url || r.driveFileUrl || pLama.url);
  var jenis = String(r.jenisGeometri || "").toLowerCase();
  var hasil;
  if (jenis === "polygon") {
    var luas = Number(r.luasHa !== undefined ? r.luasHa : pLama.luas_ha !== undefined ? pLama.luas_ha : 0);
    var luas_ha = isFinite(luas) ? Number(luas.toFixed(7)) : 0;
    var gaya = gayaPolygonPrmAidGs_(label, r.kategori, ket, r.tepi || pLama.tepi, r.warna || pLama.warna);
    hasil = { label: label, luas_ha: luas_ha, keterangan: ket, url: url, tepi: gaya.tepi, warna: gaya.warna };
  } else if (jenis === "line") {
    var pjgMeter = r.panjang_m !== undefined ? Number(r.panjang_m) : pLama.panjang_m !== undefined ? Number(pLama.panjang_m) : Number(r.panjangKm || 0) * 1000;
    var panjang_m = isFinite(pjgMeter) ? Number(pjgMeter.toFixed(2)) : 0;
    var warnaLine = warnaLinePrmAidGs_(label, r.kategori, ket, r.warna || pLama.warna);
    hasil = { label: label, panjang_m: panjang_m, keterangan: ket, url: url, warna: warnaLine };
  } else {
    var pt = simbolPointPrmAidGs_(label, r.kategori || pLama.kategori, ket, r.simbol || pLama.simbol);
    hasil = { label: label, kategori: pt.kategori, keterangan: ket, url: url, simbol: pt.simbol };
  }
  return hasil;
}

function siapkanFiturRekaman_(r, fitur, fotoUrl) {
  var dasar = fitur || fiturCadangan_(r);
  var salinan = {
    type: "Feature",
    id: dasar.id || r.id,
    geometry: dasar.geometry !== undefined ? dasar.geometry : geometriDariWktGs_(r.wkt, r.jenisGeometri),
    properties: susunAtributPrmAidGs_(r, dasar, fotoUrl)
  };
  if (dasar.snapshotSurvei) salinan.snapshotSurvei = dasar.snapshotSurvei;
  if (dasar.properties && dasar.properties.snapshotSurvei) salinan.snapshotSurvei = dasar.properties.snapshotSurvei;
  return salinan;
}

function wilayahLengkapGs_(w) {
  return Boolean(
    w &&
      w.provinsi && w.provinsi !== BELUM_DIISI &&
      w.kabupaten && w.kabupaten !== BELUM_DIISI &&
      w.kecamatan && w.kecamatan !== BELUM_DIISI &&
      w.desa && w.desa !== BELUM_DIISI
  );
}

/**
 * Automasi pemindahan/perubahan nama folder wilayah pada server base Google Drive:
 * Memindahkan berkas GeoJSON beserta foto/memo suara dari folder wilayah lama (mis. Wilayah_Belum_Diisi)
 * ke folder wilayah baru (<Provinsi>/<Kabupaten>/<Kecamatan>/<Desa>), memperbarui baris di Master_Data_Titik_Tapak,
 * dan membersihkan folder lama yang menjadi kosong.
 */
function migrasiDataKaderKeWilayahBaru_(idKader, wBaru, folderBaru, konteks, hanyaBelumDiisi) {
  var jmlBaris = konteks.sheet.getLastRow();
  if (jmlBaris <= 1) return 0;
  var semuaBaris = konteks.sheet.getRange(2, 1, jmlBaris - 1, KOLOM.length).getValues();
  var dipindahkan = 0;
  var folderLamaDikunjungi = [];

  for (var i = 0; i < semuaBaris.length; i++) {
    var b = semuaBaris[i];
    var noBaris = i + 2;
    if (idKader && String(b[K.ID_Kader] || "") !== String(idKader)) continue;
    var provLama = String(b[K.Provinsi] || "");
    var kabLama = String(b[K.Kabupaten_Kota] || "");
    var kecLama = String(b[K.Kecamatan] || "");
    var desaLama = String(b[K.Kelurahan_Desa] || "");
    var samaWilayah =
      provLama.toLowerCase() === wBaru.provinsi.toLowerCase() &&
      kabLama.toLowerCase() === wBaru.kabupaten.toLowerCase() &&
      kecLama.toLowerCase() === wBaru.kecamatan.toLowerCase() &&
      desaLama.toLowerCase() === wBaru.desa.toLowerCase();
    if (samaWilayah) continue;
    if (hanyaBelumDiisi) {
      var adaBelumDiisi =
        provLama === BELUM_DIISI || kabLama === BELUM_DIISI || kecLama === BELUM_DIISI || desaLama === BELUM_DIISI;
      if (!adaBelumDiisi) continue;
    }

    var idData = String(b[K.ID_Data] || "");
    var idBerkasLama = String(b[K.ID_Berkas] || "");
    var namaBerkas = String(b[K.Nama_Berkas] || "");
    var berkasBaru = null;

    if (idBerkasLama) {
      try {
        var fileLama = DriveApp.getFileById(idBerkasLama);
        var koleksiLama = JSON.parse(fileLama.getBlob().getDataAsString());
        if (koleksiLama && Array.isArray(koleksiLama.features)) {
          var fiturTarget = null;
          for (var f = 0; f < koleksiLama.features.length; f++) {
            if (String(koleksiLama.features[f].id) === idData) {
              fiturTarget = koleksiLama.features[f];
              break;
            }
          }
          if (fiturTarget) {
            berkasBaru = simpanFitur_(folderBaru, (namaBerkas || "data") + ".geojson", idData, fiturTarget);
            if (berkasBaru.getId() !== idBerkasLama) {
              hapusFiturLama_(idBerkasLama, idData);
            }
          }
        }
      } catch (e) {}
    }

    var folderDesaLama = cariFolderJalur_(konteks.induk, [provLama, kabLama, kecLama, desaLama]);
    if (folderDesaLama && folderDesaLama.getId() !== folderBaru.getId()) {
      pindahkanLampiranBerkas_(folderDesaLama, folderBaru, namaBerkas);
      folderLamaDikunjungi.push([provLama, kabLama, kecLama, desaLama]);
    }

    b[K.Provinsi] = sanitasiSel_(wBaru.provinsi);
    b[K.Kabupaten_Kota] = sanitasiSel_(wBaru.kabupaten);
    b[K.Kecamatan] = sanitasiSel_(wBaru.kecamatan);
    b[K.Kelurahan_Desa] = sanitasiSel_(wBaru.desa);
    if (berkasBaru) {
      b[K.Tautan_Berkas] = berkasBaru.getUrl();
      b[K.ID_Berkas] = berkasBaru.getId();
    }
    b[K.Waktu_Sinkron] = konteks.waktu;
    konteks.sheet.getRange(noBaris, 1, 1, KOLOM.length).setValues([b]);
    dipindahkan++;
  }

  for (var k = 0; k < folderLamaDikunjungi.length; k++) {
    bersihkanJalurFolderKosong_(konteks.induk, folderLamaDikunjungi[k]);
  }
  return dipindahkan;
}

function cariFolderAnak_(induk, nama) {
  if (!induk || !nama) return null;
  var persis = berkasAktif_(induk.getFoldersByName(nama));
  if (persis) return persis;
  var kecil = String(nama).toLowerCase();
  var semua = induk.getFolders();
  while (semua.hasNext()) {
    var f = semua.next();
    if (!f.isTrashed() && f.getName().toLowerCase() === kecil) return f;
  }
  return null;
}

function cariFolderJalur_(induk, tingkat) {
  var saatIni = induk;
  for (var i = 0; i < tingkat.length; i++) {
    saatIni = cariFolderAnak_(saatIni, tingkat[i]);
    if (!saatIni) return null;
  }
  return saatIni;
}

function pindahkanLampiranBerkas_(folderAsal, folderTujuan, namaDasar) {
  if (!folderAsal || !folderTujuan || !namaDasar) return;
  var awalanFoto = namaDasar + "_foto_";
  var awalanSuara = namaDasar + "_suara_";
  var files = folderAsal.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;
    var n = f.getName();
    if (n.indexOf(awalanFoto) === 0 || n.indexOf(awalanSuara) === 0) {
      try {
        f.moveTo(folderTujuan);
      } catch (e) {}
    }
  }
}

function folderKosongGs_(folder) {
  if (!folder) return false;
  var files = folder.getFiles();
  while (files.hasNext()) {
    if (!files.next().isTrashed()) return false;
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    if (!subs.next().isTrashed()) return false;
  }
  return true;
}

function bersihkanJalurFolderKosong_(induk, tingkat) {
  var rantai = [];
  var saatIni = induk;
  for (var i = 0; i < tingkat.length; i++) {
    saatIni = cariFolderAnak_(saatIni, tingkat[i]);
    if (!saatIni) break;
    rantai.push(saatIni);
  }
  for (var j = rantai.length - 1; j >= 0; j--) {
    var f = rantai[j];
    if (folderKosongGs_(f)) {
      try {
        if (typeof f.setTrashed === "function") f.setTrashed(true);
      } catch (e) {}
    } else {
      break;
    }
  }
}

function migrasiFolderWilayah_(body, konteks) {
  var wilayahMasukan = body.wilayahBaru || body.wilayah || {};
  var wBaru = wilayahRekaman_({
    wilayah: wilayahMasukan,
    desaWilayah: body.desaWilayah || wilayahMasukan.desa || wilayahMasukan.desaWilayah
  });
  if (!wilayahLengkapGs_(wBaru)) {
    return { sukses: false, pesan: "Wilayah tujuan harus lengkap (provinsi, kabupaten, kecamatan, desa)." };
  }
  var folderBaru = folderWilayah_(konteks, wBaru);
  var idKader = body.idKader ? String(body.idKader).trim() : "";
  var barisDiperbarui = 0;

  if (idKader) {
    barisDiperbarui += migrasiDataKaderKeWilayahBaru_(idKader, wBaru, folderBaru, konteks, false);
  }

  var tambahanBerkas = 0;
  if (body.wilayahLama) {
    var wLama = wilayahRekaman_({
      wilayah: body.wilayahLama,
      desaWilayah: body.wilayahLama.desa || body.wilayahLama.desaWilayah
    });
    var jalurLama = [wLama.provinsi, wLama.kabupaten, wLama.kecamatan, wLama.desa];
    var folderLama = cariFolderJalur_(konteks.induk, jalurLama);
    if (folderLama && folderLama.getId() !== folderBaru.getId()) {
      var files = folderLama.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        if (!f.isTrashed()) {
          try {
            f.moveTo(folderBaru);
            tambahanBerkas++;
          } catch (e) {}
        }
      }
      bersihkanJalurFolderKosong_(konteks.induk, jalurLama);
    }
  }

  var totalDipindahkan = folderBaru.getFiles ? (function() {
    var c = 0;
    var it = folderBaru.getFiles();
    while (it.hasNext()) {
      if (!it.next().isTrashed()) c++;
    }
    return c;
  })() : barisDiperbarui + tambahanBerkas;

  return {
    sukses: true,
    dipindahkan: totalDipindahkan,
    berkasDipindahkan: totalDipindahkan,
    barisDiperbarui: barisDiperbarui,
    folderUrl: folderBaru.getUrl(),
    wilayah: wBaru
  };
}

function nomorFotoBerikut_(folder, nama) {
  var awalan = nama + "_foto_";
  var maks = 0;
  var semua = folder.getFiles();
  while (semua.hasNext()) {
    var b = semua.next();
    var n = b.getName();
    if (n.indexOf(awalan) === 0 && !b.isTrashed()) {
      var nomor = parseInt(n.slice(awalan.length), 10);
      if (nomor > maks) maks = nomor;
    }
  }
  return maks + 1;
}

function folderInduk_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("TITIK_TAPAK_FOLDER_ID");
  if (id) {
    try {
      var tersimpan = DriveApp.getFolderById(id);
      if (!tersimpan.isTrashed()) return tersimpan;
    } catch (e) {}
  }
  var folder = dapatkanAtauBuatFolder_(DriveApp.getRootFolder(), NAMA_FOLDER_INDUK);
  props.setProperty("TITIK_TAPAK_FOLDER_ID", folder.getId());
  return folder;
}

function spreadsheetInduk_(induk) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("TITIK_TAPAK_SPREADSHEET_ID");
  if (id) {
    try {
      if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id);
    } catch (e) {}
  }
  var ada = berkasAktif_(induk.getFilesByName(NAMA_SPREADSHEET));
  var ss;
  if (ada) {
    ss = SpreadsheetApp.openById(ada.getId());
  } else {
    ss = SpreadsheetApp.create(NAMA_SPREADSHEET);
    DriveApp.getFileById(ss.getId()).moveTo(induk);
    var tabAwal = ss.getSheets()[0];
    tabAwal.setName(NAMA_TAB);
    tabAwal.appendRow(KOLOM);
  }
  props.setProperty("TITIK_TAPAK_SPREADSHEET_ID", ss.getId());
  inisialisasiTabGeometriPrmAid_(ss);
  return ss;
}

function tabData_(ss) {
  var tab = ss.getSheetByName(NAMA_TAB);
  if (!tab) {
    tab = ss.insertSheet(NAMA_TAB);
    tab.appendRow(KOLOM);
  }
  // Migrasi menambah kolom di kanan tanpa menggeser data lama.
  tab.getRange(1, 1, 1, KOLOM.length).setValues([KOLOM]);
  return tab;
}

/** Menyiapkan tab khusus per jenis geometri sesuai standar atribut PRM-AID (Polygon, Line, Point) */
function inisialisasiTabGeometriPrmAid_(ss) {
  var konfigurasi = [
    { nama: TAB_POLYGON, kolom: KOLOM_POLYGON },
    { nama: TAB_LINE, kolom: KOLOM_LINE },
    { nama: TAB_POINT, kolom: KOLOM_POINT }
  ];
  for (var i = 0; i < konfigurasi.length; i++) {
    var k = konfigurasi[i];
    var tab = ss.getSheetByName(k.nama);
    if (!tab) {
      tab = ss.insertSheet(k.nama);
      tab.appendRow(k.kolom);
    } else {
      tab.getRange(1, 1, 1, k.kolom.length).setValues([k.kolom]);
    }
  }
}

/** Menyimpan atau memperbarui baris rekaman pada tab geometri PRM-AID yang bersangkutan */
function simpanKeTabGeometriPrmAid_(ss, r, atribut) {
  if (!ss || !r || !atribut) return;
  var jenis = String(r.jenisGeometri || "").toLowerCase();
  var id = String(r.id || "");
  var namaTab = jenis === "polygon" ? TAB_POLYGON : jenis === "line" ? TAB_LINE : TAB_POINT;
  var kolom = jenis === "polygon" ? KOLOM_POLYGON : jenis === "line" ? KOLOM_LINE : KOLOM_POINT;

  var tab = ss.getSheetByName(namaTab);
  if (!tab) {
    tab = ss.insertSheet(namaTab);
    tab.appendRow(kolom);
  }

  var barisData;
  if (jenis === "polygon") {
    barisData = [
      sanitasiSel_(atribut.label),
      Number(atribut.luas_ha) || 0,
      sanitasiSel_(atribut.keterangan),
      sanitasiSel_(atribut.url),
      sanitasiSel_(atribut.tepi),
      sanitasiSel_(atribut.warna)
    ];
  } else if (jenis === "line") {
    barisData = [
      sanitasiSel_(atribut.label),
      Number(atribut.panjang_m) || 0,
      sanitasiSel_(atribut.keterangan),
      sanitasiSel_(atribut.url),
      sanitasiSel_(atribut.warna)
    ];
  } else {
    barisData = [
      sanitasiSel_(atribut.label),
      sanitasiSel_(atribut.kategori),
      sanitasiSel_(atribut.keterangan),
      sanitasiSel_(atribut.url),
      sanitasiSel_(atribut.simbol)
    ];
  }

  var barisTarget = 0;
  var jml = tab.getLastRow();
  var tagId = "id:" + id;

  if (jml > 1) {
    var rentangPertama = tab.getRange(2, 1, jml - 1, 1);
    if (typeof rentangPertama.getNotes === "function") {
      var notes = rentangPertama.getNotes();
      for (var n = 0; n < notes.length; n++) {
        if (notes[n] && notes[n][0] === tagId) {
          barisTarget = n + 2;
          break;
        }
      }
    }
  }

  if (barisTarget > 0) {
    tab.getRange(barisTarget, 1, 1, barisData.length).setValues([barisData]);
    var sel = tab.getRange(barisTarget, 1);
    if (typeof sel.setNote === "function") sel.setNote(tagId);
  } else {
    tab.appendRow(barisData);
    var baru = tab.getLastRow();
    var selBaru = tab.getRange(baru, 1);
    if (typeof selBaru.setNote === "function") selBaru.setNote(tagId);
  }
}

function berkasAktif_(iter) {
  while (iter.hasNext()) {
    var b = iter.next();
    if (!b.isTrashed()) return b;
  }
  return null;
}

/** Folder anak bernama sama dipakai lagi tanpa membedakan huruf besar-kecil ("jambi" = "Jambi") */
function dapatkanAtauBuatFolder_(induk, nama) {
  var persis = berkasAktif_(induk.getFoldersByName(nama));
  if (persis) return persis;
  var kecil = nama.toLowerCase();
  var semua = induk.getFolders();
  while (semua.hasNext()) {
    var f = semua.next();
    if (!f.isTrashed() && f.getName().toLowerCase() === kecil) return f;
  }
  return induk.createFolder(nama);
}

function balas_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Protokol 3: metadata durable dahulu; chunk idempoten dan checksum; CAS sebelum publikasi. */
function sha256V3_(bytes) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}
function hashTeksV3_(s) { return sha256V3_(Utilities.newBlob(String(s)).getBytes()); }
function konteksV3_() {
  var induk = folderInduk_(), sheet = tabData_(spreadsheetInduk_(induk)), barisAda = {};
  if (sheet.getLastRow() > 1) {
    var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) barisAda[String(ids[i][0])] = i + 2;
  }
  return { induk: induk, sheet: sheet, barisAda: barisAda, folder: {}, waktu: new Date().toISOString() };
}
function barisV3_(ctx, id) { return ctx.barisAda[id] ? ctx.sheet.getRange(ctx.barisAda[id], 1, 1, KOLOM.length).getValues()[0] : null; }
function revisiV3_(baris) { return baris ? hashTeksV3_(JSON.stringify(baris)) : ""; }
function snapshotV3_(baris) {
  var koleksi = JSON.parse(DriveApp.getFileById(String(baris[K.ID_Berkas])).getBlob().getDataAsString());
  var f = koleksi.features.filter(function(x) { return String(x.id) === String(baris[K.ID_Data]); })[0];
  if (!f) throw new Error("Snapshot server tidak ditemukan; data tidak ditimpa.");
  var p = f.properties || {}, d = f.snapshotSurvei || p.snapshotSurvei;
  if (!d) {
    var coords = f.geometry ? f.geometry.coordinates : [], jenis = String(baris[K.Jenis_Geometri]);
    if (jenis === "point") coords = [coords];
    if (jenis === "polygon") coords = coords[0] || [];
    d = { id: String(baris[K.ID_Data]), idKader: String(baris[K.ID_Kader]), namaKader: String(baris[K.Nama_Kader]),
      desaWilayah: String(baris[K.Kelurahan_Desa]), jenisGeometri: jenis, kategori: String(baris[K.Kategori]),
      judul: String(baris[K.Judul]), namaLokal: String(baris[K.Nama_Lokal]), namaIlmiah: String(baris[K.Nama_Ilmiah]),
      deskripsi: p.deskripsi || p.keterangan || "", koordinat: coords.map(function(c) { return { lat: c[1], lng: c[0], elevasi: c[2] }; }),
      panjangKm: Number(baris[K.Panjang_Km]) || 0, luasHa: Number(baris[K.Luas_Ha]) || 0,
      createdAt: String(baris[K.Waktu_Rekam]), updatedAt: String(baris[K.Waktu_Sinkron]), riwayatPembaruan: [] };
  }
  d.judul = String(baris[K.Judul]); d.namaLokal = String(baris[K.Nama_Lokal]); d.namaIlmiah = String(baris[K.Nama_Ilmiah]);
  d.catatanAdmin = String(baris[K.Catatan_Admin] || "");
  var status = String(baris[K.Status_Verifikasi]).toLowerCase();
  d.statusSinkron = /tolak|revisi/.test(status) ? "ditolak" : /setuju|terverifikasi/.test(status) ? "terverifikasi" : "tersinkron";
  d.revisiServer = revisiV3_(baris); delete d.konflikSinkron;
  return d;
}
function cekKonflikV3_(ctx, meta, base) {
  var baris = barisV3_(ctx, String(meta.id));
  if (baris && String(baris[K.ID_Kader]) !== String(meta.idKader)) throw new Error("ID data milik kader lain tidak boleh ditimpa.");
  var revisi = revisiV3_(baris);
  if (revisi !== base) {
    if (!baris) throw new Error("Objek server sudah dihapus; tinjau sebelum membuat ulang.");
    return { sukses: false, protokol: 3, konflik: { revisiServer: revisi, server: snapshotV3_(baris) } };
  }
  return null;
}
function tulisJsonV3_(folder, nama, obj) {
  var b = berkasAktif_(folder.getFilesByName(nama)), isi = JSON.stringify(obj);
  if (b) { b.setContent(isi); return b; }
  return folder.createFile(nama, isi, MimeType.PLAIN_TEXT);
}
function sinkronV3_(body) {
  if (body.action === "sync_capabilities") return { sukses: true, protokol: 3, ukuranChunk: 24000 };
  if (Utilities.newBlob(JSON.stringify(body)).getBytes().length > 50000) throw new Error("Paket melebihi 50 KB.");
  var ctx = konteksV3_();
  var staging = dapatkanAtauBuatFolder_(ctx.induk, "_Unggahan_Bertahap");
  var manifest, berkas, folder, konflik;
  if (body.action === "sync_metadata_v3") {
    var m = body.metadata;
    if (!m || !m.id || !m.idKader || !/^[a-f0-9]{64}$/.test(body.checksum) || !/^[a-f0-9]{64}$/.test(body.fingerprint)) throw new Error("Metadata tidak sah.");
    if (!Number.isInteger(body.ukuranByte) || body.ukuranByte < 1 || body.ukuranByte > 8000000 || body.jumlahChunk !== Math.ceil(body.ukuranByte / 24000)) throw new Error("Ukuran unggahan tidak sah.");
    var uploadId = hashTeksV3_(JSON.stringify([m.id, m.idKader, body.checksum, body.baseRevision || ""]));
    folder = dapatkanAtauBuatFolder_(staging, uploadId);
    berkas = berkasAktif_(folder.getFilesByName("metadata.json"));
    if (berkas) manifest = JSON.parse(berkas.getBlob().getDataAsString());
    // Kirim ulang setelah konfirmasi akhir hilang aman dan tidak mengulang tulis data.
    if (manifest && manifest.intendedRevision && revisiV3_(barisV3_(ctx, String(m.id))) === manifest.intendedRevision) {
      manifest.finalRevision = manifest.intendedRevision; tulisJsonV3_(folder, "metadata.json", manifest);
    }
    var base = manifest && manifest.finalRevision ? manifest.finalRevision : String(body.baseRevision || "");
    konflik = cekKonflikV3_(ctx, m, base); if (konflik) return konflik;
    if (!manifest) {
      manifest = { metadata: m, baseRevision: base, fingerprint: body.fingerprint, checksum: body.checksum,
        jumlahChunk: body.jumlahChunk, ukuranByte: body.ukuranByte, chunkDiterima: [], dibuatPada: ctx.waktu };
      tulisJsonV3_(folder, "metadata.json", manifest);
    }
    return { sukses: true, protokol: 3, uploadId: uploadId, chunkDiterima: manifest.chunkDiterima };
  }
  if (!/^[a-f0-9]{64}$/.test(String(body.uploadId))) throw new Error("ID unggahan tidak sah.");
  folder = berkasAktif_(staging.getFoldersByName(body.uploadId));
  if (!folder) throw new Error("Sesi unggahan tidak ditemukan; kirim metadata lagi.");
  berkas = berkasAktif_(folder.getFilesByName("metadata.json"));
  if (!berkas) throw new Error("Metadata unggahan tidak ditemukan.");
  manifest = JSON.parse(berkas.getBlob().getDataAsString());
  if (body.action === "sync_chunk_v3") {
    if (!Number.isInteger(body.indeks) || body.indeks < 0 || body.indeks >= manifest.jumlahChunk || !/^[a-f0-9]{64}$/.test(String(body.checksum))) throw new Error("Indeks chunk tidak sah.");
    var bytes = Utilities.base64Decode(String(body.data));
    var ukuranHarus = Math.min(24000, manifest.ukuranByte - body.indeks * 24000);
    if (bytes.length !== ukuranHarus || sha256V3_(bytes) !== body.checksum) throw new Error("Checksum atau ukuran chunk tidak cocok.");
    tulisJsonV3_(folder, "chunk_" + body.indeks + ".json", { data: body.data, checksum: body.checksum });
    if (manifest.chunkDiterima.indexOf(body.indeks) < 0) manifest.chunkDiterima.push(body.indeks);
    tulisJsonV3_(folder, "metadata.json", manifest);
    return { sukses: true, protokol: 3, chunkDiterima: manifest.chunkDiterima };
  }
  if (body.action !== "sync_finalize_v3") throw new Error("Aksi sinkronisasi tidak dikenal.");
  if (manifest.intendedRevision && revisiV3_(barisV3_(ctx, String(manifest.metadata.id))) === manifest.intendedRevision) {
    manifest.finalRevision = manifest.intendedRevision; tulisJsonV3_(folder, "metadata.json", manifest);
  }
  konflik = cekKonflikV3_(ctx, manifest.metadata, manifest.finalRevision || manifest.baseRevision); if (konflik) return konflik;
  if (manifest.finalRevision) return { sukses: true, protokol: 3, revisiServer: manifest.finalRevision };
  var lengkap = [];
  for (var i = 0; i < manifest.jumlahChunk; i++) {
    var chunk = berkasAktif_(folder.getFilesByName("chunk_" + i + ".json"));
    if (!chunk) throw new Error("Chunk " + i + " belum lengkap.");
    var part = JSON.parse(chunk.getBlob().getDataAsString()), decoded = Utilities.base64Decode(part.data);
    if (sha256V3_(decoded) !== part.checksum) throw new Error("Chunk rusak di penyimpanan.");
    for (var j = 0; j < decoded.length; j++) lengkap.push(decoded[j]);
  }
  if (lengkap.length !== manifest.ukuranByte || sha256V3_(lengkap) !== manifest.checksum) throw new Error("Checksum akhir tidak cocok.");
  var data = JSON.parse(Utilities.newBlob(lengkap).getDataAsString("UTF-8")), r = data.record;
  if (!r || String(r.id) !== String(manifest.metadata.id) || String(r.idKader) !== String(manifest.metadata.idKader) || !data.feature || String(data.feature.id) !== String(r.id)) throw new Error("Identitas payload tidak cocok.");
  data.feature.properties = data.feature.properties || {};
  // Snapshot disimpan di tingkat Feature (bukan di dalam properties) agar tabel atribut GeoJSON tetap bersih sesuai standar PRM-AID.
  data.feature.snapshotSurvei = r;
  validasiPayloadV3_(r, data.feature);
  // Audio dibatasi dan formatnya diperiksa; nama deterministik mencegah duplikasi saat retry.
  var memo = r.memoSuara || [], desa = folderWilayah_(ctx, wilayahRekaman_(r));
  for (var n = 0; n < memo.length; n++) {
    var suara = memo[n];
    if (["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].indexOf(suara.mimeType) < 0 || !(suara.durasiDetik > 0 && suara.durasiDetik <= 30)) throw new Error("Memo suara tidak sah.");
    var audio = Utilities.base64Decode(String(suara.dataUrl).split("base64,")[1] || "");
    if (audio.length > 300000 || audio.length !== suara.ukuranByte || sha256V3_(audio) !== suara.sha256) throw new Error("Checksum/ukuran audio tidak cocok.");
    var nama = namaBerkasRekaman_(r) + "_suara_" + hashTeksV3_(String(r.id) + suara.id + suara.sha256) + (suara.mimeType === "audio/mp4" ? ".m4a" : suara.mimeType.indexOf("ogg") >= 0 ? ".ogg" : ".webm");
    if (!berkasAktif_(desa.getFilesByName(nama))) desa.createFile(Utilities.newBlob(audio, suara.mimeType, nama));
  }
  ctx.protokolV3 = true;
  ctx.sebelumTulis = function(nilai) { manifest.intendedRevision = hashTeksV3_(JSON.stringify(nilai)); tulisJsonV3_(folder, "metadata.json", manifest); };
  simpanRekaman_(r, data.feature, ctx);
  manifest.finalRevision = revisiV3_(barisV3_(ctx, String(r.id)));
  tulisJsonV3_(folder, "metadata.json", manifest);
  return { sukses: true, protokol: 3, revisiServer: manifest.finalRevision };
}

function validasiPayloadV3_(r, fitur) {
  var k = r.koordinat;
  if (["point", "line", "polygon"].indexOf(r.jenisGeometri) < 0 || !Array.isArray(k) || k.length < (r.jenisGeometri === "point" ? 1 : r.jenisGeometri === "line" ? 2 : 3)) throw new Error("Geometri tidak sah.");
  if (r.jenisGeometri === "point" && k.length !== 1) throw new Error("Titik harus satu koordinat.");
  for (var i = 0; i < k.length; i++) if (!Number.isFinite(k[i].lat) || !Number.isFinite(k[i].lng) || Math.abs(k[i].lat) > 90 || Math.abs(k[i].lng) > 180) throw new Error("Rentang koordinat tidak sah.");
  var posisi = k.map(function(p) { return p.elevasi === undefined ? [p.lng, p.lat] : [p.lng, p.lat, p.elevasi]; });
  var tipe = r.jenisGeometri === "point" ? "Point" : r.jenisGeometri === "line" ? "LineString" : "Polygon";
  if (r.jenisGeometri === "polygon") posisi.push(posisi[0].slice());
  var harus = r.jenisGeometri === "point" ? posisi[0] : r.jenisGeometri === "polygon" ? [posisi] : posisi;
  if (!fitur.geometry || fitur.geometry.type !== tipe || JSON.stringify(fitur.geometry.coordinates) !== JSON.stringify(harus)) throw new Error("Geometri GeoJSON tidak cocok dengan rekaman.");
  if (r.fotoBase64) {
    if (!/^data:image\/jpeg;base64,/.test(r.fotoBase64)) throw new Error("Foto harus JPEG.");
    if (Utilities.base64Decode(r.fotoBase64.split("base64,")[1]).length > BATAS_FOTO_BYTE) throw new Error("Ukuran foto melebihi batas 2 MB.");
  }
  var audio = r.memoSuara || [];
  if (!Array.isArray(audio) || audio.length > 10) throw new Error("Maksimal 10 memo suara per objek.");
  for (var n = 0; n < audio.length; n++) {
    var a = audio[n];
    if (["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].indexOf(a.mimeType) < 0 || !(a.durasiDetik > 0 && a.durasiDetik <= 30)) throw new Error("Memo suara tidak sah.");
    var b = Utilities.base64Decode(String(a.dataUrl).split("base64,")[1] || "");
    if (b.length > 300000 || b.length !== a.ukuranByte || sha256V3_(b) !== a.sha256) throw new Error("Checksum/ukuran audio tidak cocok.");
  }
}
