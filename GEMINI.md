# Titik Tapak — panduan kerja untuk Gemini

Panduan lengkap (perintah, aturan UI, peta) ada di `CLAUDE.md` dan berlaku sama untuk Gemini.
Bahasa antarmuka, komentar, dan pesan commit: Bahasa Indonesia.

## Aturan Pembersihan Akun Setelah Tes

1. Setiap pengujian (unit test, integrasi, e2e, atau simulasi pendaftaran) yang membuat, mendaftarkan, atau
   mengubah akun pengguna/kader/admin wajib menghapus akun tersebut setelah pengujian selesai, lewat
   `afterEach` atau `afterAll`.
2. Jangan tinggalkan akun uji di penyimpanan aplikasi (`localStorage`, `geokader_accounts_v5`,
   `geokader_active_session_v5`, atau status sesi).
3. Pakai `bersihkanAkunSetelahTes()` atau
   `resetSemuaAkunTerdaftar({ pertahankanMasterAdmin: false, sinkronCloud: false })` di blok teardown.
4. Di luar pengujian otomatis, `siapkanAutentikasi()` membersihkan akun uji ber-domain `@contoh.id`,
   `@test.id`, atau domain "dummy"/"testing" saat aplikasi dibuka. Penyimpanan yang disemai uji browser
   (penanda `__disemai`) dibiarkan agar uji e2e tetap bisa masuk.
