/**
 * GEOKADER - PENERIMA DATA DI GOOGLE DRIVE (Code.gs)
 *
 * Dipasang SEKALI oleh pemilik Google Drive tujuan (langkah lengkap di README, bagian "Google Drive"):
 *   1. Buka script.google.com > Proyek baru, tempel berkas ini sebagai Code.gs dan appsscript.json.
 *   2. Pilih fungsi pasangGeoKader > Jalankan, lalu izinkan aksesnya. Log menampilkan token.
 *   3. Terapkan > Deployment baru > Aplikasi web: Jalankan sebagai "Saya", Akses "Siapa saja".
 *   4. Isi URL berakhiran /exec ke VITE_GDRIVE_URL dan token ke VITE_GDRIVE_TOKEN, lalu build ulang aplikasi.
 *
 * Setelah itu tidak ada lagi yang perlu diatur. Folder dibuat otomatis saat data masuk:
 *
 * GeoKader_Database/
 *   Master_Data_GeoKader                     Spreadsheet, satu baris per objek
 *   <Provinsi>/<Kabupaten atau Kota>/<Kecamatan>/<Kelurahan atau Desa>/
 *     budi_sebaran_anggrek_november_2026.geojson      semua objek "Sebaran Anggrek" milik Budi, November 2026
 *     budi_sebaran_anggrek_november_2026_foto_1.jpg
 *
 * Nama berkas = nama akun pembuat, nama data (judul objek), bulan dan tahun perekaman. Wilayah diambil dari
 * akun pembuat yang diisi admin; tingkat yang kosong masuk folder Wilayah_Belum_Diisi.
 *
 * Penyimpanan idempoten: data dengan ID yang sama diperbarui, bukan digandakan, sehingga pengiriman ulang
 * setelah gangguan jaringan aman. Bila nama atau wilayah data berubah, data dipindah ke berkas barunya.
 */

var NAMA_FOLDER_INDUK = "GeoKader_Database";
var NAMA_SPREADSHEET = "Master_Data_GeoKader";
var NAMA_TAB = "Data_Spasial";
var BELUM_DIISI = "Wilayah_Belum_Diisi";
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
  "ID_Berkas"
];
var K = {};
for (var k = 0; k < KOLOM.length; k++) K[KOLOM[k]] = k;

/** Jalankan sekali dari editor: membuat folder induk, spreadsheet, dan token, lalu menampilkannya di Log */
function pasangGeoKader() {
  var props = PropertiesService.getScriptProperties();
  var induk = folderInduk_();
  var ss = spreadsheetInduk_(induk);
  var token = props.getProperty("GEOKADER_TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "");
    props.setProperty("GEOKADER_TOKEN", token);
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

/** Membuka URL Web App di browser menampilkan status, untuk memeriksa pemasangan */
function doGet() {
  return balas_({ sukses: true, pesan: "Penerima data GeoKader aktif." });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = JSON.parse(e.postData.contents);

    var tokenTersimpan = PropertiesService.getScriptProperties().getProperty("GEOKADER_TOKEN");
    if (!tokenTersimpan) {
      return balas_({ sukses: false, pesan: "GEOKADER_TOKEN belum diatur. Jalankan fungsi pasangGeoKader sekali di editor Apps Script." });
    }
    if (body.token !== tokenTersimpan) {
      return balas_({ sukses: false, pesan: "Token tidak cocok. Samakan VITE_GDRIVE_TOKEN aplikasi dengan token dari pasangGeoKader." });
    }

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
    return balas_({ sukses: false, pesan: String(err) });
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

  // Foto lebih dulu: foto rusak menggagalkan data ini sebelum ada yang ditulis ke berkas GeoJSON
  var fotoUrl = lama ? String(lama[K.Tautan_Foto_Drive] || "") : "";
  if (!fotoUrl && r.fotoBase64 && String(r.fotoBase64).indexOf("base64,") !== -1) {
    var bytes = Utilities.base64Decode(String(r.fotoBase64).split("base64,")[1]);
    var namaFoto = nama + "_foto_" + nomorFotoBerikut_(folderDesa, nama) + ".jpg";
    fotoUrl = folderDesa.createFile(Utilities.newBlob(bytes, "image/jpeg", namaFoto)).getUrl();
  }

  var berkas = simpanFitur_(folderDesa, nama + ".geojson", id, fitur || fiturCadangan_(r));
  var idBerkasLama = lama ? String(lama[K.ID_Berkas] || "") : "";
  if (idBerkasLama && idBerkasLama !== berkas.getId()) hapusFiturLama_(idBerkasLama, id);

  // Status yang diubah admin langsung di spreadsheet tidak ditimpa saat data dikirim ulang
  var status = lama ? String(lama[K.Status_Verifikasi] || "Tersinkron_GDrive") : "Tersinkron_GDrive";
  var nilai = [
    id,
    r.idKader,
    r.namaKader,
    w.provinsi,
    w.kabupaten,
    w.kecamatan,
    w.desa,
    r.jenisGeometri,
    r.kategori,
    r.judul,
    r.namaLokal,
    r.namaIlmiah,
    r.jumlahIndividu,
    r.panjangKm,
    r.luasHa,
    r.wkt,
    nama,
    berkas.getUrl(),
    fotoUrl,
    status,
    r.createdAt,
    konteks.waktu,
    berkas.getId()
  ];
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
  if (t.normalize) t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "");
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
    var koleksi = JSON.parse(berkas.getBlob().getDataAsString());
    var sisa = [];
    for (var i = 0; i < (koleksi.features || []).length; i++) {
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
  var id = props.getProperty("GEOKADER_FOLDER_ID");
  if (id) {
    try {
      var tersimpan = DriveApp.getFolderById(id);
      if (!tersimpan.isTrashed()) return tersimpan;
    } catch (e) {}
  }
  var folder = dapatkanAtauBuatFolder_(DriveApp.getRootFolder(), NAMA_FOLDER_INDUK);
  props.setProperty("GEOKADER_FOLDER_ID", folder.getId());
  return folder;
}

function spreadsheetInduk_(induk) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("GEOKADER_SPREADSHEET_ID");
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
  props.setProperty("GEOKADER_SPREADSHEET_ID", ss.getId());
  return ss;
}

function tabData_(ss) {
  var tab = ss.getSheetByName(NAMA_TAB);
  if (!tab) {
    tab = ss.insertSheet(NAMA_TAB);
    tab.appendRow(KOLOM);
  }
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
