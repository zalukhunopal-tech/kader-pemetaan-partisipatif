# Laporan Validasi Sistem: Upgrade Engine Peta Avenza, Perombakan UI Interaktif, Auto-Sync & Manajemen Level Kader

**Aplikasi**: Titik Tapak (Kader Pemetaan Partisipatif)  
**Versi**: PWA 2.0.0 (Vite + React 18 + MapLibre GL + Protomaps PMTiles + SQLite WASM)  
**Tanggal Rilis**: 3 November 2026  
**Status Pengujian**: **100% LULUS (42 Test Files, 474 Tests Passed)**  
**Status Build**: **Production Build Sukses (`dist/` siap deploy)**  

---

## 1. Ringkasan Eksekutif

Pembaruan arsitektur ini mentransformasi aplikasi pemetaan lapangan **Titik Tapak** menjadi sekelas instrumen GIS profesional **Avenza Maps** dan **Google Earth Pro**. Seluruh kendala impor peta georeferensi lokal, pemotongan visual akibat rotasi kanvas, tumpang-tindih antarmuka, serta ketergantungan pada tombol sinkronisasi manual telah terselesaikan secara tuntas.

---

## 2. Analisis & Solusi Akar Masalah (Root Causes)

### A. Upgrade Engine Impor Peta Berstandar Avenza Maps (`src/lib/geoPdf.ts`)
1. **Dukungan Penuh Multi-CRS & Proyeksi Proj4**:
   - Menghapus pembatasan legacy yang menolak GeoPDF non-EPSG:4326 atau berotasi.
   - Mengintegrasikan library `proj4` dengan dukungan menyeluruh zona UTM Indonesia:
     - UTM Zona 46N hingga 54N (`EPSG:32646` – `EPSG:32654`)
     - UTM Zona 46S hingga 54S (`EPSG:32746` – `EPSG:32754`)
     - DGN95 / Indonesia TM-3 (`EPSG:23830` – `EPSG:23845`)
     - SRGI2013 (`EPSG:9489`) dan Web Mercator (`EPSG:3857`).
2. **Kalkulasi 2D Least-Squares Affine Transformation (`selesaikanAffine2D`)**:
   - Menghitung matriks transformasi affine $u, v \rightarrow \text{lng}, \text{lat}$ dari pasangan titik lembar peta (`LPTS` $\leftrightarrow$ `GPTS`).
   - Menghasilkan poligon quad 4-sudut presisi (`empatSudut: [[lng, lat], ...]`) untuk MapLibre `image` source, sehingga peta berotasi, terdistorsi, atau miring terpasang tepat pada permukaan bumi.
3. **Standar Kamus GeoPDF Ganda**:
   - Parsing otomatis ISO 32000-2 Dictionary (`/VP` $\rightarrow$ `/Measure` $\rightarrow$ `/GCS` & `/PROJCS`).
   - Parsing otomatis TerraGo GeoPDF Dictionary (`/LGIDict` $\rightarrow$ `/Projection` & `/CTM`).
4. **Rendering Blob Terisolasi**:
   - Halaman PDF raster dirender langsung menjadi Blob PNG transparan tanpa mengorbankan memori perangkat HP RAM rendah.

### B. SQLite MBTiles WebAssembly Engine (`src/lib/mbtilesParser.ts` & `src/lib/mbtilesProtocol.ts`)
- Membaca basis data biner MBTiles melalui WebAssembly SQL.js (`sql.js`).
- Menjalankan kueri SQL langsung terhadap tabel `metadata` (ekstraksi batas spasial `bounds`, zoom range, format raster/vektor) dan tabel `tiles`.
- Mengimplementasikan konversi TMS $y \rightarrow \text{XYZ } y$ standar MapLibre: $tmsY = (1 \ll z) - 1 - y$.

### C. Solusi Anti Hilang Peta Saat Refresh F5 (Auto-Rehydration IndexedDB)
- **Akar Masalah**: Peta luring yang dimuat ke memori RAM hilang saat browser di-refresh karena cache MapLibre InMemory terhapus.
- **Solusi**: Diimplementasikan *Lazy Rehydration* di dalam custom handler `mbtiles://` dan `pmtiles://`. Jika koneksi database terputus saat request tile masuk, sistem secara otomatis mengambil arsip biner Blob dari IndexedDB (`ambilArsipPeta(id)`), membuka kembali database, dan melayani tile tanpa hambatan.

### D. Solusi Garis/Sudut Putih Saat Peta Diputar (Masalah Rotasi Kanvas)
- **Akar Masalah**: Elemen pembungkus kanvas `.map-canvas-viewport` sebelumnya tidak memiliki dimensi eksplisit (`height: 0px`), menyebabkan rotasi kanvas CSS dihitung dari titik atas kontainer. Saat peta diputar dengan kompas (misalnya 107° Timur), sudut segitiga latar belakang putih bocor keluar viewport.
- **Solusi**:
  1. Kontainer `.map-canvas-viewport` diberi style mutlak: `position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; background: #0b1724;`.
  2. Dimensi kanvas diperbesar secara dinamis dengan pengali diagonal 2.2x: $\max(1600, \text{diagonal} \times 2.2)$.
  3. Latar belakang kanvas dan kontainer `interactive-map` diatur menjadi gelap pekat (`#0b1724`), menghilangkan kebocoran warna putih secara permanen.

---

## 3. Perombakan Visual & Interaksi UI (Modern UX)

| Fitur | Sebelum Perombakan | Sesudah Perombakan |
|---|---|---|
| **Alat Gambar Peta** | Tercecer di berbagai tombol menu atas dan bawah | **1 Tombol Pod Terpadu (`✏️`) di bawah stack Zoom `+` dan `−`** dengan menu flyout geser: 📍 Ambil Titik, 〰️ Rekam Jalur, ⬠ Buat Poligon. |
| **Clean Map Mode** | Kontrol selalu menutupi kanvas saat navigasi lapangan | **1-Click Immersion**: Ketuk sekali kanvas peta untuk menyembunyikan semua HUD/kontrol; ketuk sekali lagi untuk memunculkannya kembali. |
| **Tab Pustaka Peta** | Teks panjang terpotong dan tombol bertumpuk sempit | **Horizontal Single-Line Cards**: Nama peta tidak terpotong (ellipsis bersih), pill indikator `🟢 Di Dalam Peta`, tombol aksi horizontal (Fokus, Sesuaikan, Hapus). |
| **Logo & Ikon Sertifikat** | Menggunakan ikon umum `<Award />` | **`<LogoSertifikatResmiSvg />`**: Segel vektor resmi bintang 8 berputar, daun laurel simetris, pita lencana emas dan zamrud bergradien. |
| **Navigasi Diskusi** | Tombol saklar radio teks kaku | **Modern Segmented Control**: 👥 Ruang Diskusi Kader vs 🛡️ Jalur Koordinasi Admin dengan touch target nyaman. |
| **Sinkronisasi Data** | Tombol tab manual "GDrive / Sinkronisasi" di navigasi bawah | **100% Background Auto-Sync**: Tab manual dihapus; hook `useAutoSyncGDrive` berjalan di latar belakang saat online setiap 60 detik dengan mutex lock & pill status live di header. |
| **Buku HOK $\rightarrow$ Level Kader** | Input HOK teks manual | **Panel Data User & Level Kader**: Direktori kader, klasifikasi otomatis Level 1–20 (Kader Pemula $\rightarrow$ Kader Ahli), metrik survei live, dan kontrol penetapan insentif HOK berotoritas Admin tersimpan di `localStorage`. |

---

## 4. Hasil Verifikasi Pengujian Otomatis

Seluruh pengujian unit, integrasi, dan skenario simulasi lapangan dijalankan menggunakan Vitest:

```powershell
✓ src/lib/codeGs.test.ts (18 tests)
✓ src/lib/totp.test.ts (24 tests)
✓ src/lib/mbtilesProtocol.test.ts (3 tests)
✓ src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts (9 tests)
✓ src/lib/webauthn.test.ts (8 tests)
✓ src/lib/petaOffline.test.ts (31 tests)
✓ src/lib/auth.hash.test.ts (4 tests)
✓ src/lib/metaPeta.test.ts (10 tests)
✓ src/lib/id.test.ts (9 tests)
✓ src/lib/qr.test.ts (6 tests)
✓ src/lib/perekamLatar.test.ts (17 tests)
✓ src/lib/gdriveSync.test.ts (18 tests)
✓ src/lib/geoPdf.test.ts (5 tests)
✓ src/lib/sertifikat.test.ts (9 tests)
✓ src/lib/impor.test.ts (34 tests)
✓ src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts (7 tests)
✓ src/lib/penyimpanan.test.ts (13 tests)
✓ src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts (8 tests)
✓ src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts (6 tests)
✓ src/lib/rewardEngine.test.ts (25 tests)
✓ src/lib/geoUtils.test.ts (37 tests)
✓ src/lib/petaKanvas.test.ts (8 tests)
✓ src/lib/posisiPerangkat.test.ts (13 tests)
✓ src/__tests__/validasi-perombakan-ui-dan-peta.test.tsx (7 tests)
✓ src/lib/wilayah.test.ts (8 tests)
✓ src/lib/pmtilesProtocol.test.ts (2 tests)
✓ src/lib/zoomPeta.test.ts (7 tests)
✓ src/lib/googleTiles.test.ts (5 tests)
✓ src/lib/wallpaperLogin.test.ts (3 tests)
✓ src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts (8 tests)
✓ src/lib/mbtilesParser.test.ts (3 tests)
✓ src/lib/geserTab.test.ts (5 tests)
✓ src/lib/geoTiffParser.test.ts (3 tests)
✓ src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts (10 tests)
✓ src/lib/foto.test.ts (5 tests)
✓ src/lib/rasterGeografis.test.ts (1 test)
✓ src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts (7 tests)
✓ src/lib/posisiPeta.test.ts (7 tests)
✓ src/lib/instal.test.ts (2 tests)
✓ src/lib/storage.test.ts (2 tests)
✓ src/lib/kunciCepat.test.ts (19 tests)
✓ src/lib/auth.test.ts (48 tests)

Test Files:  42 passed (42)
Tests:       474 passed (474)
Duration:    10.14s
```

---

## 5. Panduan Verifikasi Lapangan untuk Pengguna

1. **Jalankan Aplikasi Lokal**:
   ```powershell
   npm run dev
   ```
2. **Uji Impor Peta Avenza (GeoPDF / MBTiles)**:
   - Buka Tab **Pustaka** $\rightarrow$ Pilih berkas `.pdf` georeferensi atau `.mbtiles`.
   - Perhatikan bahwa Sistem Koordinat (CRS) terdeteksi otomatis (contoh: UTM Zona 50N).
   - Ketuk **Buka Peta** $\rightarrow$ Peta akan ter-overlay sempurna pada citra satelit dan posisi GPS Anda akan berada tepat di dalam batas peta tanpa distorsi.
3. **Uji Rotasi Bebas & 3D (Anti Garis Putih)**:
   - Geser kompas atau putar peta dengan dua jari (misal orientasi 107°).
   - Amati tepi peta: tidak ada lagi segitiga atau garis putih yang bocor; tampilan peta menyatu bersih.
4. **Uji 1-Click Clean Map Mode**:
   - Ketuk sekali di area kosong kanvas peta: semua tombol HUD tersembunyi untuk visibilitas survei maksimal.
   - Ketuk sekali lagi: semua tombol kembali muncul.
5. **Uji Alat Gambar Baru di Bawah Zoom**:
   - Perhatikan tombol pensil `✏️` tepat di bawah tombol zoom `+` dan `−`.
   - Ketuk tombol untuk membuka flyout: pilih *📍 Titik*, *〰️ Rekam Jalur*, atau *⬠ Buat Poligon*.
6. **Uji Refresh F5 (Auto-Rehydration)**:
   - Tekan F5 pada browser saat peta offline terbuka. Peta langsung termuat kembali dari IndexedDB tanpa mengharuskan impor ulang.
7. **Uji Data User & Level Kader**:
   - Masuk ke dashboard Admin $\rightarrow$ Tab **Data User & Level Kader**.
   - Periksa klasifikasi Level 1 hingga 20 kader berdasarkan volume titik, jalur, dan poligon.
   - Tetapkan insentif HOK (Hari Orang Kerja) untuk kader dan klik **Setujui HOK**. Nilai akan tersimpan secara persisten.
