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

  var berkas = simpanFitur_(folderDesa, nama + ".geojson", id, fitur || fiturCadangan_(r));
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
  return { type: "Feature", id: r.id, geometry: null, properties: { id: r.id, judul: r.judul, wkt: r.wkt } };
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
  var p = f.properties || {}, d = p.snapshotSurvei;
  if (!d) {
    var coords = f.geometry ? f.geometry.coordinates : [], jenis = String(baris[K.Jenis_Geometri]);
    if (jenis === "point") coords = [coords];
    if (jenis === "polygon") coords = coords[0] || [];
    d = { id: String(baris[K.ID_Data]), idKader: String(baris[K.ID_Kader]), namaKader: String(baris[K.Nama_Kader]),
      desaWilayah: String(baris[K.Kelurahan_Desa]), jenisGeometri: jenis, kategori: String(baris[K.Kategori]),
      judul: String(baris[K.Judul]), namaLokal: String(baris[K.Nama_Lokal]), namaIlmiah: String(baris[K.Nama_Ilmiah]),
      deskripsi: p.deskripsi || "", koordinat: coords.map(function(c) { return { lat: c[1], lng: c[0], elevasi: c[2] }; }),
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
  // Snapshot mempertahankan atribut partisipatif untuk unduhan/resolusi konflik.
  data.feature.properties.snapshotSurvei = r;
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
