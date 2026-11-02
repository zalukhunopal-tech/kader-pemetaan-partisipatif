# Titik Tapak: Tahap 1 dan 2

Implementasi mengikuti tipe dan alur repo aktual. Seluruh field baru opsional pada `DataSpasialItem`, sehingga objek IndexedDB lama tidak harus ditulis ulang. Antarmuka Tahap 3 kini menghubungkan mesin ini ke peta, form, admin dan pusat sinkronisasi. Lihat [panduan Tahap 3](upgrade-tampilan-tahap-3.md).

## Blueprint dan kontrak data

- `HasilRataRataGps`: hasil inverse variance, jumlah/durasi fix, sebaran dan posisi. Sebaran serta akurasi perangkat bukan jaminan ketelitian batas legal.
- `MemoSuara`: data URL offline, MIME, byte, durasi, waktu dan checksum; maksimal 30 detik dan 300.000 byte. Format WebM/Opus, Ogg/Opus, atau MP4.
- `BuktiFotoLapangan`: lokasi, waktu, kader, desa dan penanda stamp visual. Stamp visual bukan EXIF atau pembuktian keaslian foto. Perekam audio dan stamp visual tersedia pada Tahap 3; penanaman EXIF asli kamera belum diimplementasikan.
- `KesepakatanBatas`: daftar saksi, catatan, waktu dan referensi berita acara.
- `SkorKualitasData`: empat indikator, rincian masalah, skor, grade dan versi rumus; tidak menggantikan persetujuan admin.
- `StatusAntreanSinkron`: fingerprint, sesi server, fase, indeks chunk terkonfirmasi, percobaan dan waktu retry. Token dan data media tidak disalin ke antrean.
- `KonflikSinkron`: snapshot lokal dan server serta token revisi server. Klien tidak mengandalkan jam perangkat untuk menentukan siapa yang menang.
- `KonfigurasiHok`, `SesiPatroliHok`, `RincianHokHarian`: versi kebijakan program, interval kerja terverifikasi dan buku rinci per kader/per hari.

## API mesin

```ts
import {
  hitungRataRataGps, sederhanakanJalurDouglasPeucker,
  validasiGeometri, hitungLuasPoligonMeter2,
  buatEditorVertex, snapKeVertex, wktUntukSpreadsheet,
} from "../src/lib/geoUtils";
import { ambilRataRataGps } from "../src/lib/posisiPerangkat";
import { hitungSkorKualitasData } from "../src/lib/kualitasData";
import { hitungBukuHok, eksporHokCSV, eksporHokPDF } from "../src/lib/hok";
import {
  sinkronkanBertahapKeGDrive, terapkanHasilSinkron, selesaikanKonflik,
} from "../src/lib/gdriveBertahap";
```

Averaging mengabaikan fix simulasi, koordinat tidak valid dan akurasi yang tidak diketahui. Bobot `1/accuracy²` dinormalisasi untuk stabilitas numerik; pusat dihitung pada bola agar tidak lompat ke Greenwich ketika melewati antimeridian. Elevasi tidak diisi dengan nol. `ambilRataRataGps({durasiDetik:10,minimalSampel:3,signal})` membersihkan watch/timer saat selesai, gagal atau dibatalkan; fix dengan timestamp sama tidak dihitung ulang.

Perekam aktif memakai gate kecepatan maksimum 12 m/detik ditambah ketidakpastian kedua fix untuk menolak lonjakan multipath. Ini parameter pejalan kaki, bukan mode kendaraan. Titik manual dan data asli tidak digeser oleh filter. RDP iteratif memakai toleransi meter dan mempertahankan ujung, belokan signifikan serta metadata titik. Penyederhanaan dipakai untuk WKT ringkas; GeoJSON lengkap tetap menyimpan track asli. Tidak ada Kalman filter yang mengklaim posisi palsu sebagai pengukuran.

Validasi memeriksa jumlah/rentang koordinat, vertex berulang, luas nol, persilangan diri, sentuhan non-tetangga dan ruas yang berbalik. Mesin editor menyediakan undo/redo dan snapping dalam radius meter. Validasi ini untuk poligon lapangan sederhana dengan busur bujur pendek; bukan validator seluruh topologi global, relasi overlap antarwilayah, antarlapisan atau pengganti validasi surveyor. Kontrol undo/redo dan snapping terhubung pada panel rekaman Tahap 3.

WKT dibatasi 40.000 karakter, tanpa memotong teks menjadi sintaks rusak. Jalur dicoba dengan RDP 2 m; bila tetap panjang, atau poligon panjang, sel menjadi referensi `GEOMETRI_DI_GEOJSON`. Server menambahkan tautan berkas aktual. Geometri lengkap tetap di `.geojson`.

## DQA dan HOK

DQA memiliki empat indikator 25 poin: seluruh fix GPS asli berakurasi positif <10 m; foto beserta metadata lokasi/waktu/kader; nama lokal (12) dan deskripsi (13); geometri valid. Grade A ≥90, B ≥75, C ≥50. Geometri invalid membatasi total maksimal 49. URL Drive sendiri bukan bukti foto geotag. Akurasi data impor tidak dianggap pengukuran GPS asli.

Rumus HOK per hari:

`menitEfektif / 60 / jamPerHok × bobotJam + kmMedanBerat × hokPerKmMedanBerat + titikGradeA × bonusTitikGradeA`

Hasil menampilkan ketiga komponen, jumlah sebelum batas dan sesudah `batasHokPerHari`. Contoh konfigurasi bukan ketentuan pembayaran. Hanya sesi terverifikasi dan titik Grade A terverifikasi dihitung, bukan simulasi. Durasi diambil dari sesi eksplisit, tidak menebak dari tanggal pembuatan objek. Sesi ganda/tumpang tindih ditolak. Sesi lintas tengah malam dibagi pada zona waktu program; jarak berat dibagi proporsional waktu karena titik posisi bertimestamp sepanjang segmen belum disediakan. PDF/CSV memuat program, versi rumus dan ID sumber. CSV menetralkan formula. Ekspor PDF standar memakai font WinAnsi, mengganti karakter di luar cakupan dengan `?`.

Paket capaian/sertifikat lama tidak diubah menjadi pembayaran HOK secara otomatis.

## Protokol sinkronisasi 3

1. `sync_capabilities`: memastikan server mendukung protokol 3. Server lama ditolak sebelum data v3 dikirim.
2. `sync_metadata_v3`: seluruh metadata antrean disimpan dahulu di Drive `Titik_Tapak_Database/_Unggahan_Bertahap/<uploadId>/metadata.json`. Metadata tidak berisi foto/audio/geometri panjang. Metadata ini merupakan data tertunda; belum berarti objek lengkap tersedia di spreadsheet.
3. `sync_chunk_v3`: payload lengkap (record, geometri, foto dan audio) dipecah pada batas byte UTF-8 24.000 byte, lalu base64. Setiap permintaan ≤50.000 byte; setiap chunk dan payload utuh memakai SHA-256. Server mengembalikan indeks chunk yang benar-benar tersimpan sehingga aplikasi yang dimuat ulang tidak harus mengirim ulang semuanya.
4. `sync_finalize_v3`: server memeriksa kelengkapan, identitas, checksum, media dan geometri; membandingkan revisi terbaru; lalu memublikasikan GeoJSON/media dan baris spreadsheet. Token revisi akhir wajib ada sebelum status menjadi tersinkron.

Batas metadata 48.000 byte, payload lengkap 8.000.000 byte per objek, foto 2 MiB, maksimal 10 memo suara per objek. Satu permintaan memiliki batas waktu 25 detik. Kegagalan transport/408/429/5xx dicoba sampai tiga kali dengan jeda 1 dan 2 detik; penolakan permanen tidak diputar ulang. Kegagalan disimpan bersama jadwal exponential backoff hingga 5 menit. Pemanggil perlu memicu ulang setelah waktu tersebut, misalnya tombol sinkron atau saat koneksi pulih; mesin tidak memasang timer jaringan tanpa batas.

Antrean dipersistenkan lewat mekanisme penyimpanan aplikasi (IndexedDB, fallback yang sudah ada). Kondisi kegagalan penyimpanan tetap ditampilkan oleh banner penyimpanan yang sudah ada. Data asli tidak dihapus oleh upload.

Konflik memakai token SHA-256 seluruh baris spreadsheet, termasuk status verifikasi/catatan admin. Server memeriksa token sebelum staging serta sebelum finalisasi, di bawah ScriptLock. Catatan admin dapat ditulis di kolom baru `Catatan_Admin`; migrasi menambah kolom di kanan. Tanpa token dasar yang cocok, objek lama juga perlu ditinjau sebelum ditimpa. `selesaikanKonflik(k,"lokal")`, `"admin"`, atau `"gabungkan", atributTerpilih` menghasilkan resolusi eksplisit. Gabungan tidak menebak geometri mana yang benar; identitas dan catatan admin dilindungi. Dialognya tersedia di pusat sinkronisasi Tahap 3.

Konfirmasi upload membandingkan fingerprint data yang dikirim dengan data saat balasan datang. Edit baru yang dibuat saat upload berlangsung tetap lokal. CAS baris mencakup perubahan admin di spreadsheet; edit langsung pada berkas GeoJSON tanpa mengubah baris spreadsheet berada di luar protokol ini.

Apps Script tidak menyediakan transaksi lintas Drive dan Sheets. Manifest menyimpan revisi baris yang akan ditulis sebelum commit agar retry dapat mengenali commit yang sudah berhasil walaupun balasan akhir hilang. Media memakai nama deterministik agar retry tidak menduplikasi. Session staging dipertahankan untuk resume; pembersihan/retensi staging harus dijadwalkan sesuai kebijakan program dan belum diotomatisasi.

Token bersama yang tertanam di frontend bukan autentikasi identitas tiap kader. Pemeriksaan pemilik ID mencegah perubahan ID_Kader pada objek lama, tetapi backend akun dan otorisasi per pengguna tetap diperlukan untuk perlindungan server penuh. Tidak ada kredensial baru atau akses publik baru yang ditambahkan oleh implementasi ini.

## Aktivasi dan kompatibilitas

Data biasa tetap kompatibel dengan protokol lama. Data dengan memo suara, bukti foto, saksi atau hasil averaging otomatis memakai protokol 3 agar atribut tidak hilang. Handshake mencegah penerima lama mengonfirmasi data yang belum lengkap. `VITE_GDRIVE_SYNC_V3=true` memindahkan seluruh antrean ke protokol 3.

1. Salin `apps-script/Code.gs` terbaru ke proyek Apps Script yang sudah ada; token dan folder tetap digunakan. Terapkan **Kelola deployment → Edit → Versi baru**.
2. Uji dengan data kecil di deployment pengujian; untuk mengaktifkan alur baru pada build, isi `.env`: `VITE_GDRIVE_SYNC_V3=true`, lalu build dan terbitkan aplikasi.
3. Dialog resolusi konflik tersedia pada pusat sinkronisasi Tahap 3. Tinjau kasus konflik pada deployment pengujian sebelum dipakai luas oleh kader.

API dapat diuji tanpa mengaktifkan semua pengguna:

```ts
const hasil = await sinkronkanBertahapKeGDrive(data, { koneksi: { url, token } });
const dataBaru = terapkanHasilSinkron(dataTerkini, hasil);
```

Setelah mengedit Apps Script, jalankan `node scripts/generate-apps-script.mjs` dan format `src/lib/skripAppsScript.ts`. Ini menjaga kode yang dapat disalin dari aplikasi sama dengan sumber server.

## Validasi

Tes mencakup bobot GPS/antimeridian, RDP, self-intersection, WKT panjang, undo/redo/snap, DQA, pembagian HOK antarhari, penolakan durasi ganda, CSV/PDF, protokol browser–Apps Script, prioritas metadata, resume, checksum, idempotensi dan konflik admin. Apps Script diuji dengan tiruan Drive/Spreadsheet, bukan deployment Google sungguhan; GPS/izin peramban dan lapangan tetap memerlukan pengujian di perangkat tujuan. Tidak ada perubahan yang diterbitkan ke aplikasi produksi atau proyek Apps Script oleh task ini.
