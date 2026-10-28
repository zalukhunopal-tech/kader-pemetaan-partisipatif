import React, { useState } from "react";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import {
  AkunSesi,
  aturUlangAuthenticatorOlehAdmin,
  aturUlangSandiOlehAdmin,
  buatAkunOlehAdmin,
  muatSemuaAkun
} from "../lib/auth";
import { DataSpasialItem, PeranPengguna, SertifikatKader } from "../types";

interface AkunAdminPanelProps {
  sesiAdmin: AkunSesi | null;
  /** Untuk ringkasan per akun: admin dapat melihat isi akun user (user tidak dapat melihat akun admin) */
  dataSpasial?: DataSpasialItem[];
  sertifikatList?: SertifikatKader[];
}

const FORM_KOSONG = { nama: "", email: "", desaWilayah: "", noHp: "", kelompokMasyarakat: "", peran: "kader" as PeranPengguna };

/**
 * Akun di perangkat ini. Tidak ada pendaftaran mandiri: admin membuat akun (sandi sementara tampil sekali),
 * mengatur ulang sandi, dan menghapus Authenticator yang ponselnya hilang.
 */
export const AkunAdminPanel: React.FC<AkunAdminPanelProps> = ({ sesiAdmin, dataSpasial = [], sertifikatList = [] }) => {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState<{ judul: string; email: string; nama: string; sandi: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const [form, setForm] = useState(FORM_KOSONG);
  const [sibuk, setSibuk] = useState(false);
  const [detailEmail, setDetailEmail] = useState<string | null>(null);
  const akun = muatSemuaAkun(); // dibaca ulang setiap render agar status terbaru tampil
  void versi;

  const bersihkan = () => {
    setGalat(null);
    setInfo(null);
    setHasil(null);
    setTersalin(false);
  };

  const buatAkun = async (e: React.FormEvent) => {
    e.preventDefault();
    bersihkan();
    setSibuk(true);
    try {
      const r = await buatAkunOlehAdmin(sesiAdmin, form);
      if (!r.sukses || !r.sandiSementara || !r.akun) {
        setGalat(r.pesan);
        return;
      }
      setHasil({ judul: "Akun dibuat", email: r.akun.email, nama: r.akun.nama, sandi: r.sandiSementara });
      setForm(FORM_KOSONG);
      setVersi((v) => v + 1);
    } finally {
      setSibuk(false);
    }
  };

  const aturUlangSandi = async (email: string, nama: string) => {
    bersihkan();
    const r = await aturUlangSandiOlehAdmin(sesiAdmin, email);
    if (!r.sukses || !r.sandiSementara) {
      setGalat(r.pesan);
      return;
    }
    setHasil({ judul: "Sandi sementara", email, nama, sandi: r.sandiSementara });
    setVersi((v) => v + 1);
  };

  const aturUlangAuthenticator = (email: string, nama: string) => {
    if (!window.confirm(`Hapus Google Authenticator milik ${nama}? Ia harus mendaftarkan yang baru saat masuk berikutnya.`)) return;
    bersihkan();
    const r = aturUlangAuthenticatorOlehAdmin(sesiAdmin, email);
    if (!r.sukses) setGalat(r.pesan);
    else setInfo(r.pesan);
    setVersi((v) => v + 1);
  };

  const salin = async () => {
    if (!hasil) return;
    try {
      await navigator.clipboard.writeText(hasil.sandi);
      setTersalin(true);
    } catch {
      // clipboard tidak tersedia: sandi tetap terlihat dan bisa disalin manual
    }
  };

  const statusAkun = (a: (typeof akun)[number]) =>
    a.wajibGantiSandi ? "Wajib ganti sandi" : a.totpRahasia ? "Aktif, Authenticator terpasang" : "Belum memasang Authenticator";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <form className="section-card" id="form-buat-akun" onSubmit={(e) => void buatAkun(e)}>
        <h3 style={{ margin: "0 0 4px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={18} color="#0d7344" /> Buat akun baru
        </h3>
        <p className="text-muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
          Tidak ada pendaftaran mandiri. Anda membuat akun, lalu menyampaikan sandi sementara secara langsung. Pemilik akun
          membuat sandi baru dan memasang Google Authenticator saat pertama masuk.
        </p>
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-nama">Nama lengkap *</label>
            <input id="akun-nama" className="form-input" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div>
            <label htmlFor="akun-email">Email *</label>
            <input id="akun-email" type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-desa">Desa / wilayah</label>
            <input id="akun-desa" className="form-input" value={form.desaWilayah} onChange={(e) => setForm({ ...form, desaWilayah: e.target.value })} />
          </div>
          <div>
            <label htmlFor="akun-hp">No. HP</label>
            <input id="akun-hp" className="form-input" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-kelompok">Kelompok / organisasi</label>
            <input id="akun-kelompok" className="form-input" value={form.kelompokMasyarakat} onChange={(e) => setForm({ ...form, kelompokMasyarakat: e.target.value })} />
          </div>
          <div>
            <label htmlFor="akun-peran">Peran</label>
            <select id="akun-peran" className="form-input" value={form.peran} onChange={(e) => setForm({ ...form, peran: e.target.value as PeranPengguna })}>
              <option value="kader">Kader (user lapangan)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={sibuk} style={{ marginTop: 10 }}>
          {sibuk ? "Membuat…" : "Buat akun"}
        </button>
      </form>

      <div className="section-card" id="panel-akun-admin">
        <h3 style={{ margin: "0 0 4px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={18} color="#0d7344" /> Akun di perangkat ini ({akun.length})
        </h3>
        <p className="text-muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
          Kata sandi tidak bisa diatur ulang sendiri tanpa verifikasi: admin membuat sandi sementara. Bila HP pemilik akun hilang,
          hapus Authenticator-nya agar ia bisa memasang yang baru.
        </p>

        {hasil && (
          <div role="status" className="alert-banner-success" style={{ margin: "0 0 10px" }}>
            {hasil.judul} untuk <strong>{hasil.nama}</strong> ({hasil.email}):{" "}
            <code id="sandi-sementara" style={{ fontSize: "1rem", fontWeight: 700, userSelect: "all" }}>{hasil.sandi}</code>
            <button type="button" className="btn-outline-sm" style={{ marginLeft: 8 }} onClick={() => void salin()}>
              <Copy size={13} /> {tersalin ? "Tersalin" : "Salin"}
            </button>
            <div style={{ marginTop: 4, fontSize: "0.78rem" }}>
              Sandi ini hanya ditampilkan sekali. Sampaikan langsung kepada pemilik akun.
            </div>
          </div>
        )}
        {info && (
          <div role="status" className="alert-banner-success" style={{ margin: "0 0 10px" }}>
            {info}
          </div>
        )}
        {galat && (
          <div role="alert" className="alert-banner-success" style={{ margin: "0 0 10px", background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}>
            {galat}
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Akun</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {akun.map((a) => {
                const diriSendiri = a.email.toLowerCase() === sesiAdmin?.email.toLowerCase();
                const dataAkun = dataSpasial.filter((d) => d.idKader === a.idKader);
                const terverifikasi = dataAkun.filter((d) => d.statusSinkron === "terverifikasi").length;
                const sert = sertifikatList.find((x) => x.idKader === a.idKader);
                const terbuka = detailEmail === a.email;
                return (
                  <React.Fragment key={a.email}>
                  <tr>
                    <td>
                      <strong>{a.nama}</strong>
                      <div className="text-xs text-muted">{a.email}</div>
                    </td>
                    <td>{a.peran === "admin" ? "Admin" : "Kader"}</td>
                    <td className="text-xs">{statusAkun(a)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          aria-expanded={terbuka}
                          onClick={() => setDetailEmail(terbuka ? null : a.email)}
                        >
                          {terbuka ? "Tutup" : "Detail"}
                        </button>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          disabled={diriSendiri}
                          title={diriSendiri ? "Ganti sandi Anda sendiri lewat menu Kata sandi" : "Buat sandi sementara"}
                          onClick={() => void aturUlangSandi(a.email, a.nama)}
                        >
                          Atur ulang sandi
                        </button>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          disabled={diriSendiri || !a.totpRahasia}
                          title={
                            diriSendiri
                              ? "Authenticator Anda hanya bisa diatur ulang oleh admin lain"
                              : !a.totpRahasia
                                ? "Belum ada Authenticator"
                                : "Hapus Authenticator agar bisa dipasang ulang"
                          }
                          onClick={() => aturUlangAuthenticator(a.email, a.nama)}
                        >
                          Reset Authenticator
                        </button>
                      </div>
                    </td>
                  </tr>
                  {terbuka && (
                    <tr className="baris-detail-akun">
                      <td colSpan={4}>
                        <dl className="detail-akun">
                          <div><dt>ID</dt><dd>{a.idKader}</dd></div>
                          <div><dt>Desa / wilayah</dt><dd>{a.desaWilayah}</dd></div>
                          <div><dt>No. HP</dt><dd>{a.noHp}</dd></div>
                          <div><dt>Kelompok</dt><dd>{a.kelompokMasyarakat}</dd></div>
                          <div><dt>Dibuat</dt><dd>{a.createdAt ? new Date(a.createdAt).toLocaleDateString("id-ID") : "-"}</dd></div>
                          <div><dt>Authenticator</dt><dd>{a.totpRahasia ? `Terpasang · ${a.kodePemulihanHash?.length ?? 0} kode pemulihan tersisa` : "Belum terpasang"}</dd></div>
                          <div><dt>Data lapangan</dt><dd>{dataAkun.length} objek · {terverifikasi} terverifikasi</dd></div>
                          <div><dt>Sertifikat</dt><dd>{sert ? sert.nomorSertifikat : "Belum diterbitkan"}</dd></div>
                        </dl>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
