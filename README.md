# GeoKader — Aplikasi Survei & Pemetaan Partisipatif Kader Masyarakat

Aplikasi survei keanekaragaman hayati/keruangan dan pemetaan partisipatif berbasis masyarakat (*community-based participatory mapping*) dengan arsitektur **Offline-First**, sinkronisasi otomatis ke **Google Drive & Google Sheets**, serta sistem **gamifikasi/insentif berjenjang** (Sertifikat Kader Pemetaan & Upah Harian 1 HOK).

## Fitur Utama (Sesuai PRD v1.0)

1. **Modul Pemetaan & Navigasi Lapangan (Setara Avenza Maps / AlpineQuest)**
   - **Multi-Basemap & Offline Tile Downloader**: Citra Satelit Gratis (Esri World Imagery), OpenTopoMap, OpenStreetMap, dan Peta Kontur Taktis Offline, dilengkapi pengunduh kotak wilayah (*bounding box*) serta impor GeoJSON. Data hasil impor ditandai dan baru dihitung ke capaian setelah diverifikasi admin.
   - **Perekaman Data Spasial Presisi**:
     - **Titik Koordinat (Waypoint / Point)**: Koordinat $(X, Y, Z/\text{elevasi})$, akurasi GPS, kategori (Flora, Fauna, Mata Air, Tanda Batas, Ancaman), Nama Lokal/Ilmiah, Manfaat, dan lampiran Foto Geotagging.
     - **Jalur Perjalanan (GPS Tracking / Line)**: Perekaman jejak langkah dari GPS perangkat dengan perhitungan panjang otomatis dalam **Kilometer (km)**. Tersedia tombol *Simulasi* (mati secara bawaan) untuk demo dan pelatihan tanpa GPS; data simulasi ditandai dan tidak dihitung ke capaian maupun skor level.
     - **Pemetaan Wilayah (Polygon / Area)**: Pemetaan batas lahan/hutan adat dengan perhitungan luas otomatis dalam **Hektare (Ha)**.
   - **Pembaruan Data Existing**: Klik objek yang sudah pernah dipetakan di layar peta untuk menambahkan pembaruan kondisi terbaru.
   - **Alat Bantu Navigasi Lapangan**: Format koordinat **DD / DMS / UTM**, kompas digital, dan **Go-To Waypoint Navigation** (garis lurus penunjuk arah & jarak menuju titik target).

2. **Integrasi & Sinkronisasi Database Google Drive & Sheets**
   - Antrean *Offline-First* di memori perangkat (`Tersimpan di HP`, `Tersinkron ke GDrive`, `Terverifikasi Admin`).
   - Ekspor langsung ke format standar GIS: **GeoJSON (`.geojson`)**, **KML (`.kml`)**, **GPX (`.gpx`)**, dan **CSV Master Tabel (`.csv`)**.
   - Dilengkapi generator kode backend **Google Apps Script (`Code.gs`)** siap pakai untuk membuat folder `Database_Pemetaan > Data_Spasial & Foto_Lapangan` otomatis di Google Drive.
   - Status **Tersinkron** hanya diberikan pada data yang dikonfirmasi tersimpan oleh Apps Script. Tanpa URL Web App, tidak ada yang dikirim dan tidak ada yang dilaporkan berhasil. Penyimpanan bersifat idempoten (kirim ulang tidak menggandakan baris) dan dilindungi token: isi `GEOKADER_TOKEN` di *Script Properties* dengan nilai yang sama seperti di Sinkronisasi > Konfigurasi > Token. Status online mengikuti koneksi browser, dan sinkron otomatis berjalan saat ada internet dan ada antrean. Pasang ulang `Code.gs` terbaru setiap kali berubah; Code.gs versi lama tetap bisa dipakai tetapi tanpa token dan tanpa penyimpanan idempoten.

3. **Sistem Gamifikasi, Sertifikat Kader & Upah Harian (1 HOK)**
   - **1 Paket Capaian**: Menyelesaikan **50 Titik Koordinat** ATAU **5,0 km Tracking Perjalanan** ATAU **5,0 Ha Pemetaan Poligon**.
   - **Capaian Pertama (1x Target)**: Penerbitan **Sertifikat Kader Pemetaan** resmi (dilengkapi generator sertifikat digital PNG resolusi tinggi).
   - **Capaian Berikutnya (Setiap 2x Target)**: Pembukaan tiket otomatis **Klaim Upah 1 Hari Kerja (1 HOK)**.

4. **Modul Tugas, Pengumuman, Diskusi Komunitas & Panel Admin**
   - Siaran pengumuman & penugasan spasial dengan tombol **Buka Lokasi Acuan di Peta**.
   - **Ruang Diskusi Sesama Kader** (dengan berbagi pin koordinat & *voice note*) dan **Saluran Tanya Admin (Helpdesk)** berfitur antrean *offline*.
   - **Panel Admin GIS**: Verifikasi data spasial kader, penerbitan sertifikat, pencairan HOK, dan pembuatan tugas baru.

## Menjalankan Aplikasi

```bash
npm install
npm run dev
```
