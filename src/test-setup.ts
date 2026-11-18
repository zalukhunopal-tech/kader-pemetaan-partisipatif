import { afterEach, afterAll } from "vitest";

/**
 * Pengaturan Global Pengujian:
 * Memastikan aturan pembersihan akun setelah tes berjalan otomatis di setiap suite pengujian.
 * Menghapus residu akun uji coba dari localStorage dan status sesi setelah setiap tes.
 */
afterEach(() => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("geokader_accounts_v5");
      localStorage.removeItem("geokader_current_session_v5");
      localStorage.removeItem("geokader_active_session_v5");
      localStorage.removeItem("geokader_pendaftaran_email_v1");
      localStorage.removeItem("geokader_verifikasi_totp_v1");
    } catch {
      // abaikan bila localStorage tidak tersedia
    }
  }
});

afterAll(() => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("geokader_accounts_v5");
      localStorage.removeItem("geokader_current_session_v5");
      localStorage.removeItem("geokader_active_session_v5");
      localStorage.removeItem("geokader_pendaftaran_email_v1");
      localStorage.removeItem("geokader_verifikasi_totp_v1");
    } catch {
      // abaikan bila localStorage tidak tersedia
    }
  }
});
