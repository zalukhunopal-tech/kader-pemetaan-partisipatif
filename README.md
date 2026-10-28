# Titik Tapak — Aplikasi Survei & Pemetaan Partisipatif Kader Masyarakat

Aplikasi survei keanekaragaman hayati/keruangan dan pemetaan partisipatif berbasis masyarakat (*community-based participatory mapping*) dengan arsitektur **Offline-First**, sinkronisasi otomatis ke **Google Drive & Google Sheets**, serta sertifikat kader yang diterbitkan dari data yang sudah diverifikasi admin.

## Fitur Utama (Sesuai PRD v1.0)

1. **Modul Pemetaan & Navigasi Lapangan (Setara Avenza Maps / AlpineQuest)**
   - **Multi-Basemap & Offline Tile Downloader**: Citra satelit Google (Map Tiles API) dan Esri World Imagery bila kuncinya dipasang, citra satelit Sentinel-2 (EOX, CC BY 4.0), OpenTopoMap, OpenStreetMap, dan Peta Kontur Taktis Offline, masing-masing dengan atribusi wajib di peta (lihat *Peta Dasar Gratis dan Legal*), dilengkapi pengunduh kotak wilayah (*bounding box*) serta impor GeoJSON, KML, dan GPX. Setiap fitur divalidasi (tipe geometri, rentang koordinat, jumlah titik); yang tidak valid dilewati dan dilaporkan. Unduhan peta offline menyimpan tile sungguhan di perangkat (Cache API), menampilkannya tanpa internet, dan menghitung jumlah serta ukuran dari tile yang benar-benar tersimpan. Unduhan hanya aktif untuk penyedia tile yang Anda pasang dan nyatakan berlisensi lewat `VITE_TILE_URL_*` dan `VITE_TILE_UNDUH_*=true` (lihat `.env.example`); tiga layanan publik bawaan hanya untuk dilihat online. Peta dibuka di posisi, zoom, dan basemap terakhir; GPS hanya dipakai untuk memusatkan peta pada pemakaian pertama. **Cubit dua jari** untuk memperbesar/memperkecil (titik di antara jari tetap di tempat; dua jari bergeser = menggeser peta), dan di PC roda tetikus atau cubit trackpad. Data hasil impor ditandai dan baru dihitung ke capaian setelah diverifikasi admin.
   - **Perekaman Data Spasial Presisi**:
     - **Titik Koordinat (Waypoint / Point)**: Koordinat $(X, Y, Z/\text{elevasi})$, akurasi GPS, kategori (Flora, Fauna, Mata Air, Tanda Batas, Ancaman), Nama Lokal/Ilmiah, Manfaat, dan lampiran Foto Geotagging.
     - **Jalur Perjalanan (GPS Tracking / Line)**: Perekaman jejak langkah dari GPS perangkat dengan perhitungan panjang otomatis dalam **Kilometer (km)**. Tersedia tombol *Simulasi* (mati secara bawaan) untuk demo dan pelatihan tanpa GPS; data simulasi ditandai dan tidak dihitung ke capaian maupun skor level.
     - **Pemetaan Wilayah (Polygon / Area)**: Pemetaan batas lahan/hutan adat dengan perhitungan luas otomatis dalam **Hektare (Ha)**.
   - **Pembaruan Data Existing**: Klik objek yang sudah pernah dipetakan di layar peta untuk menambahkan pembaruan kondisi terbaru.
   - **Alat Bantu Navigasi Lapangan**: Format koordinat **DD / DMS / UTM**, kompas digital, dan **Go-To Waypoint Navigation** (garis lurus penunjuk arah & jarak menuju titik target).

2. **Integrasi & Sinkronisasi Database Google Drive & Sheets**
   - Antrean *Offline-First* di memori perangkat (`Tersimpan di HP`, `Tersinkron ke GDrive`, `Terverifikasi Admin`).
   - Ekspor langsung ke format standar GIS: **GeoJSON (`.geojson`)**, **KML (`.kml`)**, **GPX (`.gpx`)**, dan **CSV Master Tabel (`.csv`)**.
   - Semua data masuk ke **satu Google Drive milik pemilik aplikasi**, dengan folder per wilayah administrasi yang dibuat otomatis: `Titik_Tapak_Database / Provinsi / Kabupaten atau Kota / Kecamatan / Kelurahan atau Desa`. Nama berkas mengikuti **akun pembuat, nama data, bulan, dan tahun perekaman**, mis. `budi_sebaran_anggrek_november_2026.geojson` (semua objek "Sebaran Anggrek" milik Budi pada November 2026 dalam satu berkas) dan fotonya `budi_sebaran_anggrek_november_2026_foto_1.jpg`. Satu spreadsheet `Master_Data_Titik_Tapak` mencatat setiap objek beserta wilayah dan tautan berkasnya. Lihat *Google Drive (pasang sekali)*.
   - Wilayah diambil dari **akun pembuat data**: admin mengisi provinsi, kabupaten/kota, kecamatan, dan kelurahan/desa saat membuat akun kader (wajib) di **Admin > Akun**, dan bisa melengkapi atau mengubahnya untuk akun lama. Data yang direkam dicap dengan wilayah akunnya saat itu; data lama tanpa cap memakai wilayah akunnya saat diunggah, dan yang wilayahnya belum lengkap masuk folder `Wilayah_Belum_Diisi`.
   - **Tidak ada pengaturan Drive di aplikasi.** Unggahan berjalan otomatis saat ada internet dan ada antrean, ke alamat yang ditanam saat build. Halaman GDrive menampilkan folder dan nama berkas tujuan setiap data. Status **Tersinkron** hanya diberikan pada data yang dikonfirmasi tersimpan oleh Apps Script; penyimpanan idempoten (kirim ulang tidak menggandakan) dan dilindungi token. Bila nama atau wilayah data berubah, data dipindah ke berkas barunya.

3. **Capaian & Sertifikat Kader**
   - **1 Paket Capaian**: **50 Titik Koordinat** ATAU **5,0 km Tracking Perjalanan** ATAU **5,0 Ha Pemetaan Poligon**.
   - Hanya data **terverifikasi admin** yang dihitung untuk sertifikat. Data simulasi tidak pernah dihitung, dan data impor baru dihitung setelah diverifikasi. Pembaruan objek dibatasi satu per objek per 24 jam dan harus berisi kondisi yang berbeda.
   - Admin menerbitkan sertifikat atas nama kader yang dipilih (bukan profil admin), dengan nomor unik dan satu sertifikat per kader. Sertifikat digital PNG memuat **kode QR yang benar-benar terbaca**; isi QR berupa tautan ke `VITE_URL_VERIFIKASI` bila diisi, atau teks bertanda `GEOKADER|nomor|ID kader|tanggal`.

4. **Modul Tugas, Pengumuman, Diskusi Komunitas & Panel Admin**
   - Siaran pengumuman & penugasan spasial dengan tombol **Buka Lokasi Acuan di Peta**.
   - **Ruang Diskusi Sesama Kader** (dengan berbagi pin koordinat & *voice note*) dan **Saluran Tanya Admin (Helpdesk)**.
   - **Panel Admin GIS**: verifikasi data spasial kader, penerbitan sertifikat, pembuatan tugas dan pengumuman, serta pengelolaan akun (membuat akun, atur ulang sandi, dan hapus Authenticator).
   - **Semua fitur di bagian ini hanya bekerja di satu perangkat** (lihat *Batasan* di bawah).

## Memasang Aplikasi (PWA)

Titik Tapak bisa dipasang seperti aplikasi biasa (ikon di layar utama, layar penuh, jalan tanpa internet):

- **Android (Chrome, Edge, Samsung Internet):** ketuk **Instal** pada ajakan di Pustaka, menu **Instal aplikasi**, atau tombol di layar masuk. Bila tombol tidak memunculkan dialog, buka menu browser ⋮ → *Instal aplikasi*.
- **iPhone/iPad (Safari):** ketuk **Bagikan** → **Tambahkan ke Layar Utama**. Aplikasi menampilkan panduan ini.
- **PC (Chrome/Edge):** klik ikon Instal di bilah alamat atau tombol di aplikasi.

Pemasangan hanya bisa dari alamat **https://** (atau `localhost`). Manifest memuat ikon PNG 192/512, ikon *maskable*, tangkapan layar untuk dialog pemasangan, dan pintasan **Peta**, **Pustaka**, **Sinkronisasi** (tekan lama ikon aplikasi).

## Peta Dasar Gratis dan Legal

Semua sumber gratis, boleh dipakai di aplikasi dengan atribusi yang tampil di pojok peta, dan **hanya untuk dilihat online**. Pilih di tombol **Lapisan** pada peta; sumber berkunci hanya muncul bila kuncinya dipasang, dan peta pertama kali dibuka dengan citra paling tajam yang tersedia (Google, lalu Esri, lalu Sentinel-2):

| Basemap | Sumber | Lisensi / ketentuan | Offline |
|---|---|---|---|
| Satelit Google (opsional, paling tajam) | **Map Tiles API resmi** Google Maps Platform, `VITE_GOOGLE_MAPS_API_KEY` | Gratis **100.000 tile/bulan** (2D Map Tiles), di atasnya berbayar; perlu akun penagihan Google Cloud. Wajib logo Google dan teks hak cipta dari Google (diambil otomatis per area). **Dilarang menjiplak/mendigitasi objek dari citra Google** | Tidak: ketentuan Google melarang penyimpanan untuk offline |
| Satelit Esri (opsional) | Esri World Imagery lewat akun ArcGIS Location Platform, `VITE_ESRI_API_KEY` | Gratis **2 juta tile basemap/bulan** untuk akun; wajib "Powered by Esri" | Tidak: Esri melarang pengambilan tile massal di luar perangkat lunaknya |
| Satelit Sentinel-2 (bawaan) | Sentinel-2 cloudless 2016, EOX (s2maps.eu) | CC BY 4.0, resolusi 10 m (zoom maks 13, di atasnya diperbesar, sehingga buram bila diperbesar jauh) | Tidak: layanan tile EOX untuk dipakai online |
| OpenStreetMap | tile.openstreetmap.org | Data ODbL; kebijakan tile OSMF | Tidak: kebijakan tile OSM melarang unduhan massal/offline |
| Topografi | OpenTopoMap | CC-BY-SA | Tidak dijamin: pemakaian besar perlu menghubungi OpenTopoMap |

**Google dan Bing.** Alamat tile Google tak resmi (`mt*.google.com`, `khms*`) melanggar ketentuan Google dan tidak dipakai; aplikasi hanya memakai Map Tiles API (token sesi lewat `createSession`, hak cipta dari endpoint `viewport`). Kunci API Google dipakai di peramban, jadi **batasi kuncinya** di Google Cloud Console ke domain aplikasi dan ke Map Tiles API saja, dan pasang batas kuota harian agar tidak ada tagihan tak terduga. Untuk menghemat kuota, peta hanya meminta tile yang tampil. Bing Maps tidak dipasang: Microsoft menutup kunci Bing Maps gratis/Basic sejak 30 Juni 2025 (layanan Enterprise berakhir 30 Juni 2028); penggantinya Azure Maps hanya memberi ±15.000 tile citra gratis per bulan dan memakai kunci berbagi yang tidak aman ditaruh di aplikasi tanpa server. Untuk citra setajam Bing, pakai Satelit Esri (sebagian besar bersumber dari Maxar/Vantor yang sama) atau Satelit Google.

Server Esri tanpa kunci (`server.arcgisonline.com`) tidak lagi dipakai karena ketentuan Esri mensyaratkan akun. Citra Sentinel-2 tahun 2018 ke atas dari EOX berlisensi CC BY-NC-SA 4.0 (non-komersial) dan tidak dipasang bawaan.

**Cara legal untuk peta offline:** buat tile sendiri dari data terbuka lalu sajikan dari server/penyimpanan milik organisasi, kemudian isi `VITE_TILE_URL_<SUMBER>` dan `VITE_TILE_UNDUH_<SUMBER>=true`.
- Citra: unduh Sentinel-2 dari Copernicus Data Space Ecosystem (data terbuka Copernicus, gratis dengan atribusi), olah di QGIS (*Generate XYZ tiles*) untuk wilayah dampingan.
- Peta jalan/topografi: potong data OpenStreetMap (ODbL) untuk wilayah Anda, mis. ekstrak PMTiles Protomaps, lalu render menjadi tile raster; cantumkan "© Kontributor OpenStreetMap".
- Peta Rupabumi Indonesia (BIG): ketentuan layanannya untuk aplikasi pihak ketiga belum jelas; tanyakan izin tertulis ke Badan Informasi Geospasial sebelum memasang.

## Menjalankan Aplikasi

Butuh **Node.js 22.12 atau lebih baru** (Vite 8 dan Vitest 5). Versi pustaka dikunci di `package-lock.json`; pakai `npm ci` agar setiap mesin membangun dari versi yang sama.

```bash
npm ci           # pasang dependensi persis sesuai package-lock.json
npm run dev      # server pengembangan (terbuka ke jaringan lokal di port 3000)
npm run build    # bangun versi produksi (PWA)
npm test         # tes Vitest (lib/*: koordinat, skor, impor, sertifikat, QR, auth, PIN dan sidik jari, penyimpanan, sinkronisasi, Code.gs, peta)
npm run lint     # pemeriksaan tipe (tsc --noEmit) dan ESLint
npm run format   # merapikan format kode dengan Prettier (format:check hanya memeriksa)
npm run test:e2e # uji browser Playwright pada bundel produksi (lihat di bawah)
```

**Uji browser** (`e2e/`, Playwright + Chromium) menjalankan alur nyata pada bundel produksi: penyiapan admin dan Google Authenticator, masa 8 jam, PIN, sidik jari dengan autentikator virtual, gerbang admin, cubit dan roda zoom, tata letak dengan huruf besar, rekam titik, Satelit Google/Esri (jaringan Google ditiru), dan penerbitan sertifikat dengan QR yang dipindai. `npm run test:e2e` membangun dua bundel (`dist/` dan `dist-e2e/` dengan kunci API palsu dari `.env.e2e`), menyalakan `vite preview`, lalu menjalankan tes. Pertama kali di komputer baru, pasang browsernya dengan `npx playwright install chromium`.

Saat menambah atau menaikkan pustaka, jalankan `npm install <paket>` lalu commit `package.json` **dan** `package-lock.json` bersama-sama.

Variabel lingkungan (`.env`, lihat `.env.example`) dibaca saat build: alamat dan token Google Drive (`VITE_GDRIVE_URL`, `VITE_GDRIVE_TOKEN`), kunci peta satelit (`VITE_GOOGLE_MAPS_API_KEY`, `VITE_ESRI_API_KEY`), sumber tile (`VITE_TILE_*`), tautan verifikasi sertifikat (`VITE_URL_VERIFIKASI`), dan kode aktivasi admin (`VITE_KODE_ADMIN`). Berkas `.env` diabaikan git; jangan commit token asli karena repositori ini publik.

## Google Drive (pasang sekali)

Penerima data adalah Google Apps Script di akun Google tujuan (`apps-script/Code.gs`). Pemasangan dilakukan **sekali** oleh pemilik Drive; setelah itu folder, spreadsheet, dan berkas dibuat otomatis.

1. Buka [script.google.com](https://script.google.com) dengan akun Google tujuan > **Proyek baru**. Ganti isi `Code.gs` dengan `apps-script/Code.gs`. Di **Setelan proyek**, centang *Tampilkan file manifes "appsscript.json"* lalu ganti isinya dengan `apps-script/appsscript.json` (zona waktu Asia/Jakarta).
2. Pilih fungsi **`pasangTitikTapak`** > **Jalankan**, lalu izinkan aksesnya ke Drive dan Spreadsheet. Fungsi ini membuat folder `Titik_Tapak_Database`, spreadsheet `Master_Data_Titik_Tapak`, dan token; ketiganya tampil di **Log eksekusi**.
3. **Terapkan > Deployment baru > Aplikasi web**: *Jalankan sebagai* **Saya**, *Yang memiliki akses* **Siapa saja**. Salin URL yang berakhiran `/exec` (membukanya di browser menampilkan "Penerima data Titik Tapak aktif").
4. Isi `.env` di komputer/hosting yang membangun aplikasi:
   ```
   VITE_GDRIVE_URL=https://script.google.com/macros/s/xxxxx/exec
   VITE_GDRIVE_TOKEN=token-dari-log
   ```
   lalu `npm run build` dan terbitkan ulang. Selesai; kader tidak perlu mengatur apa pun.

Bila `Code.gs` berubah, tempel versi baru lalu **Terapkan > Kelola deployment > Edit > Versi baru** (URL tetap sama). Token tetap tersimpan di *Properti skrip* (`TITIK_TAPAK_TOKEN`). Token ikut tertanam di aplikasi, jadi bukan rahasia mutlak; fungsinya menolak kiriman dari orang yang hanya tahu URL.

## Akun & Keamanan

- **Tidak ada pendaftaran mandiri.** Perangkat baru menampilkan penyiapan awal untuk membuat **Administrator pertama** (bila `VITE_KODE_ADMIN` diisi, kode itu diminta; ini pencegah salah pakai, bukan rahasia, karena nilainya ikut tertanam di aplikasi). Setelah itu semua akun, kader maupun admin lain, dibuat oleh admin di **Admin > Akun**. Admin menerima sandi sementara yang tampil sekali; pemilik akun membuat sandi baru dan memasang Google Authenticator saat pertama masuk.
- **Google Authenticator wajib untuk semua akun** (user dan admin). Setelah sandi benar, masuk meminta kode 6 digit (TOTP RFC 6238: HMAC-SHA1, 30 detik, toleransi ±30 detik; satu kode tidak bisa dipakai dua kali). Pemasangan memakai kode QR `otpauth://` (atau kunci manual) dan menampilkan **8 kode pemulihan sekali pakai**, hanya sekali. Ketik salah satu kode itu di kolom kode bila HP hilang.
- Admin dapat menghapus Authenticator akun lain (HP hilang) dari **Admin > Akun**; pemilik memasang yang baru saat masuk berikutnya. Authenticator admin sendiri hanya bisa diatur ulang oleh admin lain. Karena itu sebaiknya ada lebih dari satu admin.
- Sandi disimpan sebagai hash PBKDF2-SHA256 (200.000 iterasi, garam acak), minimal 8 karakter, menolak sandi umum serta sandi yang memuat nama/email. Percobaan masuk dibatasi bertahap, termasuk kode Authenticator yang salah. Sesi divalidasi terhadap data akun sehingga peran yang diubah di penyimpanan peramban dicabut.
- Tidak ada reset sandi mandiri: admin mengatur ulang sandi kader (sandi sementara tampil sekali, wajib diganti saat masuk). Kader dapat mengganti sandi dari menu.
- **Akun dan sesi dari versi sebelum Authenticator** tetap bisa dipakai sandinya, tetapi sesi lama dicabut dan akun wajib memasang Authenticator saat masuk berikutnya.
- **Kode Authenticator berlaku 8 jam, di antaranya PIN atau sidik jari/wajah.** Setelah kode Google Authenticator benar (saat masuk atau verifikasi ulang), masa berlaku 8 jam dimulai di perangkat itu. Aplikasi terkunci saat dibuka ulang dan setelah 15 menit tanpa aktivitas; selama masa 8 jam, aplikasi (dan mode admin bila sedang di mode admin) dibuka dengan **PIN 6 angka** atau **sidik jari / pengenalan wajah** perangkat. Setelah 8 jam, kode Authenticator wajib lagi. Masuk pertama kali meminta membuat PIN (dan menawarkan sidik jari/wajah bila perangkat mendukung). PIN disimpan sebagai hash PBKDF2, menolak PIN berurutan/berulang, dan **5 PIN salah menonaktifkan PIN** sampai kode Authenticator dimasukkan. Sidik jari/wajah memakai WebAuthn dengan autentikator bawaan perangkat (sensor sidik jari Android, Face ID/Touch ID, Windows Hello): data biometrik tidak pernah keluar dari perangkat, aplikasi hanya menyimpan kunci publik dan memeriksa tanda tangan atas tantangan acak setiap kali dibuka (wajib verifikasi pengguna, perlu https). Atur di menu **PIN & sidik jari**. Keluar mengakhiri masa 8 jam; admin yang mengatur ulang sandi atau Authenticator sebuah akun ikut menghapus PIN dan sidik jarinya. Isi aplikasi di balik layar kunci tidak dibongkar, jadi formulir yang belum disimpan tidak hilang, tetapi tidak bisa disentuh.
- **Pemisahan admin dan user (dua lapis).** Lapis 1: tampilan admin (dasbor, pengaturan sertifikat, kirim sebagai admin) hanya dirender untuk akun admin dengan **gerbang admin** terbuka; akun user tidak punya menu, tombol, atau rute ke sana. Lapis 2: setiap aksi admin (verifikasi, ubah/hapus data, terbitkan sertifikat, penandatangan, tugas, pengumuman, buat/atur ulang akun) diperiksa ulang terhadap data akun terkini **dan** gerbang admin; bila gagal, aksi dibatalkan dan mode admin dikunci. Gerbang admin hanya ada di memori: dibuka oleh kode Google Authenticator, atau oleh PIN/sidik jari/wajah selama masa 8 jam Authenticator, dan terkunci saat aplikasi dimuat ulang, 15 menit tanpa aktivitas, beralih ke Mode User, atau keluar. Aksi admin juga ditolak bila aplikasi sedang terkunci atau masa 8 jam habis. Akun user tidak bisa membuka mode admin dengan PIN atau sidik jarinya. Admin dapat melihat detail akun user (profil, Authenticator, jumlah data, sertifikat) di Admin > Akun.
- **Batas:** rahasia Authenticator dan hash PIN tersimpan di perangkat yang sama dengan akunnya (belum ada server). Lapisan ini menahan orang yang hanya tahu sandi, bukan orang yang dapat membaca atau mengubah penyimpanan perangkat itu.

## Penyimpanan Data

Data aplikasi disimpan di **IndexedDB** (bukan localStorage yang hanya ±5 MB) dan dipindahkan otomatis dari versi lama. Foto lapangan dikecilkan (sisi maksimum 1280 px, ≤ ±350 KB). Bila penyimpanan penuh atau gagal menulis, aplikasi menampilkan peringatan (bukan gagal diam-diam), dan peringatan juga muncul saat ruang terpakai ≥ 80%. Aplikasi meminta penyimpanan persisten ke peramban agar data tidak dihapus otomatis.

## Batasan yang Perlu Diketahui

- **Belum ada server.** Akun, peran, pesan, tugas, pengumuman, dan status verifikasi hanya ada di perangkat tempat data dibuat. Pesan diskusi berstatus "tersimpan di perangkat ini", bukan "terkirim"; pengumuman dan tugas tidak sampai ke HP kader lain; monitor kader aktif belum tersedia. Hanya data spasial yang bisa dikirim ke luar perangkat, lewat Google Drive/Sheets. Penyelesaian tuntas (verifikasi lintas perangkat, akun dan peran di server) membutuhkan backend.
- **Keamanan sisi klien ada batasnya.** Sandi dan Authenticator menahan orang yang tidak memegang perangkat, tetapi siapa pun yang dapat membaca atau mengubah penyimpanan peramban di perangkat yang sama masih dapat melewatinya.
- Peta offline hanya aktif untuk penyedia tile berlisensi yang Anda pasang sendiri; sumber bawaan hanya untuk dilihat online. Alamat tile Sentinel-2 EOX diambil dari katalog layanan publik dan belum bisa diuji dari lingkungan pengembangan; aplikasi otomatis mencoba jalur cadangan bila jalur utama gagal.
- Geser kiri/kanan di area konten berpindah tab sesuai urutan bilah bawah; di atas peta, geseran tetap menggeser peta.
- Skrip Google Apps Script (`apps-script/Code.gs`) diuji terhadap tiruan layanan Google (Drive, Spreadsheet, Properties), belum di Apps Script sungguhan. Sensor GPS dan kompas diuji dengan lokasi/event buatan, belum di HP.
