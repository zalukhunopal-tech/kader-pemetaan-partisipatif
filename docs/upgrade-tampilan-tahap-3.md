# Titik Tapak — antarmuka lapangan Tahap 3

Perubahan tersedia dalam kode workspace; belum di-push ke GitHub, diterbitkan ke hosting, atau diterapkan pada proyek Apps Script Google.

## Peta dan survei

- Telemetri atas menampilkan **posisi GPS perangkat**, akurasi, format DD/DMS/UTM dan waktu rekam. Tombol koordinat menyalin lokasi GPS; titik bidikan tetap dipakai untuk menggambar. GPS yang tidak tersedia tidak diberi koordinat buatan.
- Tombol tambah titik dan rekam jalur berada di pod bawah. Tombol + membuka alat tambahan termasuk poligon. GPS berada di sisi bawah yang bisa dijangkau ibu jari; kompas dan lapisan tetap tersedia. Di HP, zoom memakai cubit dua jari; desktop juga menyediakan tombol zoom dan roda tetikus.
- Lapisan, inspektor dan form memakai panel berukuran 25%, 55% atau 92% tinggi viewport, dibatasi tinggi peta pada desktop. Seret handle, gunakan panah keyboard, atau tombol ukuran. Escape menutup panel. Panel bersifat nonmodal agar peta tetap dapat dipakai.
- Kategori visual mencakup batas, wilayah/lahan, flora, fauna, air, ancaman, sarana desa dan situs budaya. Pilih satu kartu untuk membuka atribut.
- Draf atribut, foto, suara dan lokasi dipisahkan per ID kader di penyimpanan aplikasi. Menutup form mempertahankan draf. Titik memiliki tombol **Lanjutkan draf titik** dan **Buang draf**. Sesi jalur/poligon tetap menggunakan perekam latar yang sudah ada.
- Pengukuran rata-rata GPS mengambil fix selama 10 detik dan mengganti lokasi titik setelah berhasil. Form dapat membatalkan pengukuran; menutup form membersihkan watch GPS-nya.
- Rekaman suara menggunakan format ringan yang didukung browser (Opus/WebM, Opus/Ogg atau MP4), 32 kbit/detik bila didukung, maksimal 30 detik dan 300 KB. Mikrofon hanya diminta saat tombol rekam ditekan. Rekaman dapat diputar dan dihapus; stream dilepas saat selesai atau form ditutup. Finalisasi memo dipersistenkan walaupun pengguna berpindah tab. Penutupan paksa browser/OS tetap dapat menghentikan proses yang belum selesai.
- Foto dapat diberi stamp visual berisi lokasi survei, UTM, elevasi/akurasi yang diketahui, waktu, desa dan ID kader. Stamp memakai lokasi survei dan waktu pemasukan foto, **bukan pembacaan/penanaman EXIF asli kamera**. Metadata bukti tetap terpisah. Foto baru dikompresi dan dapat dipratinjau sebelum disimpan.
- Titik batas/wilayah menyediakan daftar saksi. Panel rekaman mempunyai undo/redo dan snap 5 meter ke vertex data yang sudah ada; jeda GPS membantu menyunting tanpa tambahan titik otomatis. Geometri invalid ditolak saat penyimpanan; panel poligon menampilkan hektare dan m². Pemeriksaan overlap antarwilayah dan penyuntingan vertex arbitrer pada objek lama belum ditambahkan.

## Sinkronisasi dan cadangan

Pusat sinkronisasi menampilkan tiga tahap: lokal di HP, antrean prioritas dan data lengkap yang dikonfirmasi Drive. Angka lokal menghitung salinan lokal seluruh objek; angka Drive hanya objek berstatus tersinkron/terverifikasi. Indeks chunk, fase, galat dan waktu retry ditampilkan ketika mesin protokol 3 digunakan.

Browser Storage Estimate dipakai untuk pemakaian dan sisa kuota asal situs; angka tersebut dibagi IndexedDB, cache dan OPFS. Angka tiap peta berasal dari metadata aplikasi, bukan pemeriksaan ulang setiap berkas. Foto dan audio antrean dihitung dari data yang benar-benar tersedia. Browser yang tidak memberikan kuota menampilkan status tidak tersedia.

- **Cadangan geometri (.geojson)**: geometri, atribut dan metadata partisipatif untuk GIS; tidak menyertakan isi biner foto/audio.
- **Survei + media (.zip)**: arsip ZIP standar yang berisi GeoJSON, JSON lengkap dengan foto dan audio data URL, metadata peta, serta petunjuk. Berkas peta offline dan akun/sandi tidak termasuk. Ekspor berjalan lokal, tanpa mengirim data ke layanan lain. Batas arsip 128 MB; pemulihan otomatis JSON/ZIP belum tersedia di aplikasi.

Konflik ditinjau melalui perbandingan kedua versi. Pilihan lokal, admin atau gabungan tersedia; gabungan meminta sumber atribut/media dan sumber geometri secara eksplisit. Catatan admin dan identitas dipertahankan. Pemilik objek atau admin dengan sesi sah dapat menyelesaikan konflik. Pilihan lokal/gabungan kembali masuk antrean.

Penerima Apps Script protokol 3 harus diperbarui menggunakan `apps-script/Code.gs` terbaru. Data yang mempunyai memo suara, saksi, bukti foto atau GPS averaging **otomatis memerlukan protokol 3**, termasuk ketika flag build belum diaktifkan. Penerima lama ditolak melalui handshake agar lampiran tidak dibuang diam-diam. `VITE_GDRIVE_SYNC_V3=true` mengaktifkan protokol baru untuk seluruh data biasa juga. Pengaturan token tidak berubah.

## Admin, HOK dan layar besar

Pada lebar ≥768 px navigasi pindah ke samping. Halaman data/sinkronisasi dan admin menampilkan panel data di kiri dan peta lebar di kanan; **Tinjau peta** mempertahankan tabel saat memusatkan lokasi pada desktop. Di HP, tombol tersebut membuka halaman peta seperti sebelumnya. Gerbang admin tetap membatasi halaman dan aksi verifikasi.

Tabel admin menampilkan grade/skor DQA dan alasan kekurangan. Data bergeometri invalid tidak dapat disahkan. **Minta revisi** menyimpan catatan admin pada perangkat ini; status dan catatan tetap tunduk pada batas backend perangkat yang sudah ada.

Buku HOK tersedia pada halaman sertifikat serta tab admin. Kader dapat mencatat interval patroli dan jarak medan berat; sesi menunggu verifikasi admin. Jam duplikat/tumpang tindih ditolak. Rumus desa/program menampilkan bobot, versi, zona waktu dan batas harian; hanya admin dengan gerbang/sesi sah dapat mengubah rumus atau mengesahkan sesi. Tabel dan ekspor PDF/CSV merinci jam, jarak, bonus titik Grade A serta total sesudah batas. Perubahan konfigurasi menghitung ulang buku berdasarkan rumus yang dipilih; arsip ekspor mempertahankan versi rumus saat diekspor. Tidak ada nominal uang atau persetujuan pembayaran otomatis. Sesi dan kebijakan HOK masih tersimpan pada perangkat ini dan belum disinkronkan lintas perangkat.

## Tema dan aksesibilitas

Pemilih **Standar**, **Sinar matahari**, dan **Hutan malam** menyimpan preferensi lokal. Tombol dan kontrol utama memiliki target sentuh minimal 48 px. Fokus keyboard terlihat, kontrol panel memiliki nama aksesibel, dan ukuran teks dapat mengikuti pengaturan perangkat.

Kontras token teks utama/sekunder serta tombol utama diuji numerik: tema matahari ≥9,44:1, tema malam ≥9,86:1. Ini memenuhi ambang AAA 7:1 untuk pasangan warna tersebut; bukan sertifikasi WCAG AAA seluruh aplikasi. Peta/citra, konten impor dan gaya lama lain tetap perlu audit visual pada perangkat tujuan.

## Pemeriksaan dan batas pengujian

Unit/regresi memeriksa kategori, pemulihan draf antar akun, panel keyboard/Escape, undo/redo, routing media ke protokol baru dan modul sebelumnya. ZIP diperiksa dengan pembaca Python `zipfile`, termasuk CRC dan Unicode. TypeScript, ESLint dan build produksi dijalankan.

Pemeriksaan visual dan E2E browser belum dijalankan dalam sesi ini: sandbox menolak membuka server lokal (`listen EPERM`), dan permintaan akses tambahannya tidak selesai. Skenario browser peta yang berubah diperbarui di `e2e/peta.spec.ts`, tetapi hasilnya belum diklaim lulus. GPS, mikrofon, stamp foto pada kamera nyata, perangkat kecil dan deployment Google tetap perlu pemeriksaan pada lingkungan yang mendukungnya.
