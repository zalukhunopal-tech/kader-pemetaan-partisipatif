# Titik Tapak — panduan kerja

Aplikasi React + Vite (PWA) untuk survei dan pemetaan partisipatif. Bahasa antarmuka, komentar, dan pesan commit: Bahasa Indonesia.

## Perintah

- `npm test` — Vitest (termasuk `src/__tests__/aturan-ui.test.ts`)
- `npm run lint` — `tsc --noEmit` + ESLint
- `npm run build` — build produksi
- `npx playwright test e2e/peta-tata-letak.spec.ts` — uji tumpang tindih kontrol peta (butuh `npm run build` dan `npx vite preview --port 4173`)

## Aturan UI (wajib)

1. **Tidak ada elemen yang saling menutupi.**
   - Semua kontrol yang mengapung di atas peta tinggal di grid `.avz-hud` di `InteractiveMap.tsx`:
     `avz-hud-atas` (kotak lokasi, kompas, zoom) → `avz-hud-tengah` (ruang kosong, pesan singkat) →
     `avz-hud-bawah` (daftar objek, draf titik, panel rekam, skala, atribusi) → bilah alat.
   - Kontrol baru di atas peta masuk ke salah satu sel itu. Jangan memberinya `position: absolute/fixed`
     dengan `top/bottom/left/right` sendiri. Pengecualian yang disengaja hanya panel Lapisan (lembar yang
     memang menutupi peta) dan bidikan tengah (penanda yang tidak bisa disentuh).
   - Uji dengan kondisi terberat: GPS belum diizinkan (panel rekam memuat peringatan), layar HP pendek
     (360×640), dan PC pendek (1366×640). `e2e/peta-tata-letak.spec.ts` memeriksa ini.
   - Di luar peta: kartu dan baris tombol memakai flex/grid dengan `gap` dan `min-width: 0`; teks panjang
     dipotong (`text-overflow: ellipsis`) atau turun baris, tidak menimpa elemen lain.
2. **Tidak ada label dengan tanda `&`.** Bila satu tombol atau judul mewakili dua fitur, cari satu kata yang
   mewakili keduanya (mis. "Lapisan peta", bukan "Peta Dasar & Lapisan"; "Kunci aplikasi", bukan
   "PIN & sidik jari"). Di dalam kalimat pakai "dan". Dijaga oleh `src/__tests__/aturan-ui.test.ts`;
   pengecualian hanya nama baku standar (`lib/atributPrmAid.ts`) dan salinan Code.gs.
3. **Label singkat dan santai.** Satu sampai dua kata untuk tombol, kata kerja untuk aksi ("Simpan",
   "Batalkan"), tanpa huruf kapital semua kecuali singkatan.
4. **Ukuran sentuh minimal 44 px** untuk tombol di HP.
5. **Toast** boleh menutupi isi halaman sesaat, tetapi tidak boleh menutupi bilah navigasi atau bilah alat
   peta (di tab peta toast memakai kelas `di-peta`). Hapus data memakai toast dengan tombol **Urungkan**,
   bukan menghapus permanen seketika.
6. **Esc menutup** modal, menu aksi, dan halaman tambahan (pakai `useTombolEsc` dari `lib/useTombolEsc.ts`).

## Peta

- Gaya peta ada di `src/styles/petaAvenza.css` (dimuat setelah `app.css`, dibatasi `.avz-peta`).
  `app.css` berisi banyak aturan lama ber-`!important`; jangan menambah aturan peta baru di sana.
- `RailAlatPeta` dirender dua kali: `bagian="zoom"` di kolom kanan atas dan `bagian="alat"` sebagai bilah bawah.
