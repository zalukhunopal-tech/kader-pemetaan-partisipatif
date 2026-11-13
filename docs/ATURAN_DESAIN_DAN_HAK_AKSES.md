# Aturan Baku Desain Antarmuka & Hak Akses Aplikasi

Dokumen ini merupakan pedoman baku yang wajib dipatuhi dan dipertahankan pada seluruh iterasi pengembangan, refactor, serta redesign antarmuka di repositori Titik Tapak (Kader Pemetaan Partisipatif).

---

## 1. Hak Akses Pengaturan Penandatangan Sertifikat (Khusus Administrator)

> **Ketentuan Mutlak**: Fitur pengaturan penandatangan sertifikat (nama pejabat, jabatan, instansi, logo, tanda tangan digital, urutan penandatangan resmi KKI Warsi) **HANYA DAPAT DIAKSES OLEH ADMINISTRATOR**.

- **Sisi Pengguna Biasa (Kader)**:
  - User biasa (kader) bertindak murni sebagai penerima sertifikat penghargaan pemetaan partisipatif.
  - User biasa **TIDAK DAPAT** mengakses fitur pengaturan penandatangan sertifikat.
  - Tombol "Atur Penandatangan" / editor penandatangan serta formulir input nama penandatangan **dihapus sepenuhnya** dari tampilan sisi kader.
  - Kader hanya memiliki akses terhadap:
    1. Mengunggah / mengganti / menghapus passfoto diri sendiri untuk sertifikat.
    2. Melihat pratinjau sertifikat resmi miliknya.
    3. Mencetak sertifikat fisik (`handleCetakSertifikat`).
    4. Mengunduh sertifikat digital beresolusi tinggi format PNG (`handleUnduhSertifikatPng`).
- **Sisi Administrator (`peran === "admin"`)**:
  - Administrator memiliki wewenang penuh mengatur konfigurasi penandatangan sertifikat resmi, baik melalui Tab Sertifikat di Menu Admin maupun melalui tombol editor sertifikat pada halaman Sertifikat.
  - Seluruh fungsi mutasi penandatangan di-guard secara ketat dengan `if (peran !== "admin") return;`.

---

## 2. Pengetengahan Presisi Input PIN

> **Ketentuan**: Tampilan kotak masukan PIN harus selalu berada presisi di tengah layar (*vertically and horizontally centered*), baik pada kontainer layar maupun pada penempatan titik bullet (`•`) di dalam kotak input.

- **Posisi Kontainer Layar**:
  - Kontainer gerbang admin menggunakan `.gerbang-admin-container` dengan `display: flex; align-items: center; justify-content: center; min-height: calc(100dvh - 120px);`.
  - Kartu `.gerbang-admin` diposisikan `margin: auto;` di tengah viewport.
- **Posisi Karakter Titik Masking (`•`)**:
  - Elemen `.pin-input` wajib memiliki `padding: 0 0 0 0.5em;` (padding vertikal bernilai `0` untuk mencegah baseline teks bullet turun agak ke bawah pada peramban mobile/WebKit).
  - Menggunakan `line-height: normal;` dan `vertical-align: middle;` serta `display: block; margin: 10px auto;`.

---

## 3. Aturan Baku Label Pilihan (Menu, Sub-nav, Tab, Filter, dan Tombol Tindakan)

> **Ketentuan Baku**: Setiap label pada elemen pilihan antarmuka wajib berupa **SATU KATA SAJA**, tidak boleh dienter ke bawah (*white-space: nowrap*), adaptif, dan dilarang memakai simbol `&`.

1. **Wajib Satu Kata Saja**:
   - Setiap pilihan menu, tab bar navigasi, tombol aksi baris, dan filter pill harus berupa **SATU KATA**.
   - Contoh penerapan:
     - Sub-Nav Admin: `Monitor`, `Kader`, `Data`, `Tugas`, `Sertifikat`, `Akun`.
     - Tindakan Data Spasial: `Peta` (bukan *Tinjau peta*), `Edit`, `Sah`, `Revisi` (bukan *Minta revisi*), `Hapus`, `Batal`.
     - Tab Lapisan Peta: `Dasar` (bukan *Peta Dasar*), `Berkas` (bukan *Lapisan Berkas*), `Pustaka`.
     - Aksi Penugasan & Komunikasi: `Publikasikan` (bukan *Publikasikan Tugas*), `Umumkan` (bukan *Simpan Pengumuman*), `Simpan` (bukan *Simpan Penandatangan*).
     - Aksi Sertifikat: `Foto`, `Hapus`, `Cetak`, `Unduh`.
2. **Pencarian Padanan Kata**:
   - Jika suatu opsi antarmuka sebelumnya terdiri dari 2 atau 3 kata, wajib mencari padanan kata tunggal yang representatif dalam bahasa Indonesia baku.
3. **Larangan Simbol `&`**:
   - Dilarang keras menggunakan karakter ampersand (`&`) pada label antarmuka. Gunakan kata "dan" pada kalimat penjelasan atau gunakan satu kata yang mencakup konteksnya.
4. **Anti Ke-Enter & Tata Letak Adaptif**:
   - Label pilihan tidak boleh terpotong atau berpindah baris ke bawah (*ke enter*).
   - Seluruh elemen pilihan, header tabel (`th`), serta badge status wajib memiliki properti CSS `white-space: nowrap !important;` dengan ukuran teks dan padding yang fleksibel mengikuti lebar layar perangkat.
5. **Cakupan Aturan**:
   - Aturan satu kata ini **HANYA BERLAKU UNTUK LABEL PILIHAN** (tombol aksi, pilihan tab, filter, opsi navigasi).
   - Untuk kalimat keterangan, deskripsi fitur, teks bantuan, catatan kaki, serta instruksi survei lapangan, tetap disusun dalam kalimat wajar seperti biasanya.
