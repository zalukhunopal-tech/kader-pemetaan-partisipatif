# Laporan Simulasi Lapangan Nyata & Bug Hunting (55 Skenario) — Titik Tapak

**Dokumen Laporan Resmi Pengujian Ketahanan Lapangan & Perbaikan Bug**  
*Aplikasi Pemetaan Partisipatif: Titik Tapak (`kader-pemetaan-partisipatif`)*  
*Tanggal: 2 November 2026*  
*Lingkungan Pengujian: Vitest 5.0.5, Node 22, fake-indexeddb, jsdom, MapLibre GL*

---

## 1. Ringkasan Eksekutif

Pengujian ketahanan lapangan komprehensif ini dirancang untuk mensimulasikan secara realistis kondisi ekstrem yang dihadapi kader pemetaan di pedalaman hutan dan desa terpencil (seperti di Kalimantan Utara / Bulungan). Pengujian mencakup **55 skenario lapangan nyata** yang dikelompokkan ke dalam **7 kategori risiko (A–G)**.

### Hasil Akhir:
- **Total Test Files**: 41 files (34 suite inti + 7 suite simulasi lapangan)
- **Total Tests Passing**: **466 passed (100%)**, 0 failed
- **Status Kompilasi TypeScript (`tsc`)**: **0 Errors (100% lulus)**
- **Status Build Produksi (`vite build`)**: **Berhasil (PWA precache 27 entries, bundle siap luring)**

---

## 2. Matriks Hasil 55 Skenario Lapangan

| No | Kategori | Nama Skenario | Status Awal | Status Akhir | File Implementasi Uji |
|:---|:---|:---|:---:|:---:|:---|
| 1 | A. Jaringan | Dead-Zone Entry Mid-Survey (3G putus saat isi form) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 2 | A. Jaringan | Flaky Signal (Putus-nyambung tiap 1.5 detik) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 3 | A. Jaringan | Captive Portal Wi-Fi Desa (Balasan HTML login) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 4 | A. Jaringan | Mid-Upload Drop pada Batch Besar (25 survei) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 5 | A. Jaringan | Server 429 / 500 / Apps Script Quota Exceeded | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 6 | A. Jaringan | Concurrent Sync Trigger (Double-Tap 5x dalam 1s) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 7 | A. Jaringan | Offline PWA Cold Boot di Area Blank Spot | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 8 | A. Jaringan | Clock Skew (Jam HP mundur ke 2020 / baterai habis) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-a-jaringan.test.ts` |
| 9 | B. GPS & Geometri | Canopy Multipath Jump (>2.5km jump di bawah kanopi) | **Gagal** (Tidak ada filter kecepatan lonjakan) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 10 | B. GPS & Geometri | Zero Movement / Stationary Drift (Istirahat 45 menit) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 11 | B. GPS & Geometri | GPS Permission Revoked Mid-Recording | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 12 | B. GPS & Geometri | High-Frequency GPS Burst (20 koordinat/detik) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 13 | B. GPS & Geometri | Null & NaN Altitude pada HP Android Murah | **Gagal** (Propagasi NaN) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 14 | B. GPS & Geometri | Self-Intersecting Polygon (Poligon Angka-8) | **Gagal** (Belum ada validator sisi) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 15 | B. GPS & Geometri | Duplicate Consecutive Vertices (Zero segment) | **Gagal** (Potensi edge-case `atan2(0,0)`) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 16 | B. GPS & Geometri | Extreme Coordinate (Khatulistiwa lat=0 Kalimantan) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 17 | B. GPS & Geometri | Screen Lock / Background Persistence | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 18 | B. GPS & Geometri | Long Marathon Track (10.000 titik patroli) | Lulus (<10ms) | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-b-gps-geometri.test.ts` |
| 19 | C. Peta Offline | Corrupted / Truncated MBTiles Header | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 20 | C. Peta Offline | Unsupported CRS / Projection in GeoTIFF | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 21 | C. Peta Offline | Oversized Raster Import (Low RAM Device) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 22 | C. Peta Offline | Missing Zoom Levels (Overzooming level 19) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 23 | C. Peta Offline | Out-of-Bounds Offline Map Load Detection | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 24 | C. Peta Offline | Deleting Active Offline Basemap | **Gagal** (IDB connection lock hanging) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 25 | C. Peta Offline | Rapid Layer Toggling (15x bergantian cepat) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 26 | C. Peta Offline | Offline Tile Quota Exhaustion (`QuotaExceededError`) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 27 | C. Peta Offline | Corrupted IndexedDB Tile Cache (0-byte blob) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-c-peta-offline.test.ts` |
| 28 | D. Form & Foto | Corrupt or Zero-Byte Photo Upload | **Gagal** (Tidak ada validasi ukuran 0) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 29 | D. Form & Foto | Ultra-High-Resolution Photo (>25MB) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 30 | D. Form & Foto | Special Characters, Emojis (`🌲⚠️`) & XSS Script | **Gagal** (Tidak ada sanitasi tag `<script>`) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 31 | D. Form & Foto | Accidental Back-Button / Modal Dismiss | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 32 | D. Form & Foto | Editing Already-Queued Offline Object | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 33 | D. Form & Foto | Deleting Object Concurrently During Upload | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 34 | D. Form & Foto | Empty / Whitespace-Only Required Fields (`"   "`) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 35 | D. Form & Foto | Sequential Multi-Photo Attachment | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-d-survei-foto.test.ts` |
| 36 | E. HOK & Gamifikasi | HOK Split Sessions (3x patroli 2 jam per hari) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 37 | E. HOK & Gamifikasi | Midnight Crossing Patrol (23:00 -> 01:30) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 38 | E. HOK & Gamifikasi | Tampered LocalStorage HOK Points Protection | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 39 | E. HOK & Gamifikasi | Long Name QR Certificate (>60 karakter) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 40 | E. HOK & Gamifikasi | Certificate Generation 100% Offline (Local Canvas) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 41 | E. HOK & Gamifikasi | Zero-Activity New Kader State (0 titik, 0 km) | Lulus (0%, bukan NaN) | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 42 | E. HOK & Gamifikasi | Leaderboard Tie-Breaking (200 kader skor sama) | **Gagal** (Tie-breaker ID belum ada) | **LULUS** (Fixed) | `src/__tests__/simulasi-lapangan/kategori-e-hok-sertifikat.test.ts` |
| 43 | F. Keamanan & Admin | PIN Lockout (5x salah memicu blokir & TOTP) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 44 | F. Keamanan & Admin | PIN Lock Bypass via Browser Refresh Defense | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 45 | F. Keamanan & Admin | Atomic PIN Change & Validation | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 46 | F. Keamanan & Admin | Shared Village Device Isolation (Kader A vs B) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 47 | F. Keamanan & Admin | Unauthorized Admin Gate Access Blocking | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 48 | F. Keamanan & Admin | Admin Mass Verification (50 survei sekaligus) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 49 | F. Keamanan & Admin | Offline Message Queue Chronological Ordering | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-f-keamanan-admin.test.ts` |
| 50 | G. Perangkat PWA | External BLE Disconnect Resilience | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |
| 51 | G. Perangkat PWA | Low Battery Flush to Storage | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |
| 52 | G. Perangkat PWA | Android Cleaner Storage Eviction Recovery | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |
| 53 | G. Perangkat PWA | Legacy Schema Migration & Fallback Parsing | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |
| 54 | G. Perangkat PWA | Screen Orientation & Split-Screen Storm (10x) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |
| 55 | G. Perangkat PWA | Full Field Day Chaos Marathon (E2E Pipeline) | Lulus | **LULUS** | `src/__tests__/simulasi-lapangan/kategori-g-perangkat-pwa.test.ts` |

---

## 3. Rincian Bug yang Ditemukan & Perbaikan Root Cause

### 1. Lonjakan Multipath GPS di Bawah Tajuk Hutan (Skenario 9)
- **Gejala**: Ketika kader berada di bawah tajuk kanopi lebat, pantulan sinyal satelit dapat menghasilkan pembacaan melompat sejauh 2–3 km dalam hitungan detik. Tanpa filter kecepatan, lonjakan ini terhitung sebagai kilometer perjalanan palsu dan merusak perhitungan HOK.
- **Root Cause**: `perekamLatar.ts` hanya memeriksa `AKURASI_MAKS_METER` (50m) dan `JARAK_MIN_METER` (3m), tetapi belum memeriksa kecepatan delta antar-titik (`jarak / selisihDetik`).
- **Perbaikan**: Di `src/lib/perekamLatar.ts`, ditambahkan filter lonjakan multipath: jika perpindahan jarak > 100 meter terjadi dengan kecepatan fisik tidak realistis (> 35 m/s atau > 126 km/jam), koordinat otomatis diabaikan dan pesan peringatan `galat` dicatat ke state.

### 2. Nilai `NaN` pada Ketinggian & Akurasi Chipset Murah (Skenario 13)
- **Gejala**: Beberapa perangkat Android murah mengembalikan `altitude: NaN` atau `accuracy: NaN` saat sinyal lemah. Hal ini menyebabkan field `elevasi` menjadi `NaN`, merusak serialisasi JSON dan perhitungan WKT/KML/GeoJSON.
- **Root Cause**: `pos.coords.altitude != null ? Math.round(pos.coords.altitude) : undefined` mengevaluasi `Math.round(NaN)` menjadi `NaN`.
- **Perbaikan**: Di `src/lib/perekamLatar.ts`, dilakukan validasi ketat menggunakan `Number.isFinite(pos.coords.altitude)` dan `Number.isFinite(pos.coords.accuracy)`.

### 3. Validasi Geometri Poligon Saling Memotong / Angka-8 (Skenario 14)
- **Gejala**: Kader dapat menggambar batas poligon yang sisi-sisinya saling menyilang (self-intersecting / angka 8) tanpa peringatan integritas spasial.
- **Root Cause**: Belum ada algoritma perpotongan garis non-adjacent pada modul utilitas geometri.
- **Perbaikan**: Di `src/lib/geoUtils.ts`, diimplementasikan dan diekspor fungsi `validasiPoligon(titik: KoordinatTitik[]): { valid: boolean; pesan?: string }` berbasis algoritma CCW (Counter-Clockwise) cross-product line-segment intersection.

### 4. Pembagian dengan Nol pada Bearing Titik Identik (Skenario 15)
- **Gejala**: Mengetuk titik koordinat yang sama 2–3 kali berturut-turut pada tracking/sketsa menghasilkan titik kembar yang dapat memicu `NaN` pada kalkulasi sudut.
- **Root Cause**: `Math.atan2(0, 0)` pada koordinat identik.
- **Perbaikan**: Di `src/lib/geoUtils.ts:hitungBearingDerajat`, ditambahkan perlindungan langsung `if (a.lat === b.lat && a.lng === b.lng) return 0;`.

### 5. Kebuntuan Koneksi IndexedDB Arsip Peta Luring (Skenario 24)
- **Gejala**: Ketika arsip peta dihapus atau versi basis data ditingkatkan, proses `indexedDB.deleteDatabase` menggantung (`blocked`) tanpa batas waktu karena koneksi database terbuka tidak pernah ditutup.
- **Root Cause**: `dbPromise` pada `penyimpananPetaLuring.ts` di-cache secara permanen tanpa penangan `db.onversionchange` dan tanpa fungsi penutup koneksi.
- **Perbaikan**: Di `src/lib/penyimpananPetaLuring.ts`, dipasang penangan `db.onversionchange` yang otomatis menutup koneksi, serta diekspor fungsi `tutupDbArsip(): Promise<void>` untuk penutupan bersih dan pemulihan penggusuran cache.

### 6. Kegagalan Pengolahan Foto Kosong 0-Byte (Skenario 28)
- **Gejala**: Driver kamera yang crash pada ponsel murah dapat menghasilkan berkas foto berukuran 0 byte. Hal ini memicu `DOMException` tak tertangani saat dikirim ke `createImageBitmap`.
- **Root Cause**: `kompresFoto` memeriksa `file.type` dan `file.size > 25MB`, tetapi belum memeriksa `file.size === 0`.
- **Perbaikan**: Di `src/lib/foto.ts`, ditambahkan pengecekan eksplisit: `if (file.size === 0) throw new Error("Berkas foto kosong (0 byte).");`.

### 7. Sanitasi Input Survei dari Tag Skrip Berbahaya (Skenario 30)
- **Gejala**: Kader atau pihak luar yang memasukkan input nama objek berisi `<script>` dapat memicu potensi XSS pada panel inspektor atau viewer GeoJSON.
- **Root Cause**: Tidak ada filter regex sanitasi HTML pada input teks form survei.
- **Perbaikan**: Di `src/lib/geoUtils.ts`, dibuat dan diekspor `sanitasiTeksInput(teks)` yang secara aman melucuti tag `<script>` dan kurung sudut `< >`, namun tetap mempertahankan karakter emoji lapangan (`🌲⚠️`), tanda kutip nama lokal, dan huruf non-ASCII.

### 8. Pengurutan Deterministik Leaderboard & Sertifikat (Skenario 42)
- **Gejala**: Pada desa dengan 200 kader aktif yang memiliki capaian dan nama identik, daftar peringkat tidak deterministik di antara sesi render.
- **Root Cause**: Pembanding array hanya membandingkan `berhakSertifikat` dan `namaKader`.
- **Perbaikan**: Di `src/lib/sertifikat.ts:ringkasanKader`, ditambahkan fallback pembanding tingkat ketiga `|| a.idKader.localeCompare(b.idKader)`.

---

## 4. Verifikasi dan Pengesahan

1. **Unit & Integration Tests**: Seluruh 41 test files dan 466 skenario pengujian lulus 100% tanpa kegagalan:
   ```bash
   npm run test
   # Result: 41 passed (41), 466 passed (466), 0 failed
   ```
2. **Kompilasi TypeScript & Bundling PWA**:
   ```bash
   npm run build
   # Result: tsc passed (0 errors), vite build passed (dist/ ready with PWA service worker)
   ```
