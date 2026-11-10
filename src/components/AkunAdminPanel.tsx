import React, { useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Info, KeyRound, ShieldAlert, Trash2, UserPlus, XCircle } from "lucide-react";
import {
  AkunSesi,
  aturUlangAuthenticatorOlehAdmin,
  aturUlangSandiOlehAdmin,
  buatAkunOlehAdmin,
  hapusAkunOlehAdmin,
  muatSemuaAkun,
  setujuiAkunOlehAdmin,
  tolakAkunOlehAdmin,
  ubahWilayahAkunOlehAdmin
} from "../lib/auth";
import { DataSpasialItem, PeranPengguna, SertifikatKader, WilayahAdministrasi } from "../types";
import { WILAYAH_KOSONG, teksWilayah, wilayahLengkap } from "../lib/wilayah";
import { migrasiFolderWilayahKeGDrive } from "../lib/gdriveSync";
import { IsianWilayah } from "./IsianWilayah";

interface AkunAdminPanelProps {
  sesiAdmin: AkunSesi | null;
  /** Untuk ringkasan per akun: admin dapat melihat isi akun user (user tidak dapat melihat akun admin) */
  dataSpasial?: DataSpasialItem[];
  sertifikatList?: SertifikatKader[];
}

const FORM_KOSONG = { nama: "", email: "", wilayah: WILAYAH_KOSONG, noHp: "", kelompokMasyarakat: "", peran: "kader" as PeranPengguna };

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
  const [ubahWilayah, setUbahWilayah] = useState<{ email: string; nilai: WilayahAdministrasi } | null>(null);
  const [menuAksiAkun, setMenuAksiAkun] = useState<(typeof akun)[number] | null>(null);
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

  const simpanWilayah = () => {
    if (!ubahWilayah) return;
    bersihkan();
    const targetAkun = akun.find((x) => x.email.toLowerCase() === ubahWilayah.email.toLowerCase());
    const wilayahSebelumnya = targetAkun?.wilayah ?? (targetAkun?.desaWilayah ? { desaWilayah: targetAkun.desaWilayah } : undefined);
    const nilaiBaru = ubahWilayah.nilai;
    const r = ubahWilayahAkunOlehAdmin(sesiAdmin, ubahWilayah.email, nilaiBaru);
    if (!r.sukses) {
      setGalat(r.pesan);
      return;
    }
    setInfo(r.pesan + " Data yang belum terunggah ikut masuk ke folder wilayah baru.");
    setUbahWilayah(null);
    setVersi((v) => v + 1);
    if (targetAkun) {
      void migrasiFolderWilayahKeGDrive({
        idKader: targetAkun.idKader,
        namaKader: targetAkun.nama,
        wilayahLama: wilayahSebelumnya,
        wilayahBaru: nilaiBaru
      });
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

  const hapusAkun = (email: string, nama: string) => {
    if (
      !window.confirm(
        `Hapus akun ${nama} (${email}) dari perangkat ini?\n\nAkun ini tidak akan dapat masuk lagi di perangkat ini. Data lapangan yang sudah tersimpan di perangkat tetap aman.`
      )
    ) {
      return;
    }
    bersihkan();
    const r = hapusAkunOlehAdmin(sesiAdmin, email);
    if (!r.sukses) {
      setGalat(r.pesan);
    } else {
      setInfo(r.pesan);
      if (detailEmail === email) setDetailEmail(null);
      if (ubahWilayah?.email === email) setUbahWilayah(null);
    }
    setVersi((v) => v + 1);
  };

  const setujuiAkun = (email: string) => {
    bersihkan();
    const r = setujuiAkunOlehAdmin(sesiAdmin, email);
    if (!r.sukses) setGalat(r.pesan);
    else setInfo(r.pesan);
    setVersi((v) => v + 1);
  };

  const tolakAkun = (email: string, nama: string) => {
    if (!window.confirm(`Tolak pendaftaran akun ${nama} (${email})? Akun ini tidak akan bisa aktif sampai disetujui.`)) return;
    bersihkan();
    const r = tolakAkunOlehAdmin(sesiAdmin, email);
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

  const statusAkun = (a: (typeof akun)[number]) => {
    if (a.statusPersetujuan === "menunggu") {
      return "Menunggu persetujuan Admin (Email terverifikasi)";
    }
    if (a.statusPersetujuan === "ditolak") {
      return "Ditolak Admin (Belum aktif)";
    }
    return a.wajibGantiSandi
      ? "Wajib ganti sandi"
      : a.totpRahasia
        ? "Aktif, Authenticator terpasang"
        : "Belum memasang Authenticator";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <form className="section-card" id="form-buat-akun" onSubmit={(e) => void buatAkun(e)}>
        <h3 style={{ margin: "0 0 4px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <UserPlus size={18} color="#0d7344" /> Buat akun baru
        </h3>
        <p className="text-muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
          Tidak ada pendaftaran mandiri. Anda membuat akun, lalu menyampaikan sandi sementara secara langsung. Pemilik akun membuat sandi
          baru dan memasang Google Authenticator saat pertama masuk.
        </p>
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-nama">Nama lengkap *</label>
            <input
              id="akun-nama"
              className="form-input"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="akun-email">Email *</label>
            <input
              id="akun-email"
              type="email"
              className="form-input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <p className="text-muted" style={{ margin: "10px 0 4px", fontSize: "0.8rem" }}>
          Wilayah tugas menentukan folder Google Drive tempat data akun ini disimpan (Provinsi › Kabupaten/Kota › Kecamatan ›
          Kelurahan/Desa).
        </p>
        <IsianWilayah
          idAwalan="akun"
          nilai={form.wilayah}
          onUbah={(wilayah) => setForm({ ...form, wilayah })}
          saran={akun.map((a) => a.wilayah)}
          wajib={form.peran === "kader"}
        />
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-hp">No. HP</label>
            <input id="akun-hp" className="form-input" value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} />
          </div>
          <div>
            <label htmlFor="akun-kelompok">Kelompok / organisasi</label>
            <input
              id="akun-kelompok"
              className="form-input"
              value={form.kelompokMasyarakat}
              onChange={(e) => setForm({ ...form, kelompokMasyarakat: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="akun-peran">Peran</label>
            <select
              id="akun-peran"
              className="form-input"
              value={form.peran}
              onChange={(e) => setForm({ ...form, peran: e.target.value as PeranPengguna })}
            >
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
          Kata sandi tidak bisa diatur ulang sendiri tanpa verifikasi: admin membuat sandi sementara. Bila HP pemilik akun hilang, hapus
          Authenticator-nya agar ia bisa memasang yang baru.
        </p>

        {hasil && (
          <div role="status" className="alert-banner-success" style={{ margin: "0 0 10px" }}>
            {hasil.judul} untuk <strong>{hasil.nama}</strong> ({hasil.email}):{" "}
            <code id="sandi-sementara" style={{ fontSize: "1rem", fontWeight: 700, userSelect: "all" }}>
              {hasil.sandi}
            </code>
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
          <div
            role="alert"
            className="alert-banner-success"
            style={{ margin: "0 0 10px", background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}
          >
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {a.statusPersetujuan === "menunggu" && (
                            <button
                              type="button"
                              className="btn-primary-sm"
                              onClick={() => setujuiAkun(a.email)}
                              title="Setujui pendaftaran email ini agar akun aktif"
                            >
                              Setujui
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-outline-sm aksi-data-trigger"
                            aria-haspopup="menu"
                            aria-expanded={menuAksiAkun?.email === a.email}
                            onClick={() => setMenuAksiAkun(a)}
                          >
                            Aksi <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {terbuka && (
                      <tr className="baris-detail-akun">
                        <td colSpan={4}>
                          <dl className="detail-akun">
                            <div>
                              <dt>ID</dt>
                              <dd>{a.idKader}</dd>
                            </div>
                            <div>
                              <dt>Verifikasi Email</dt>
                              <dd>
                                {a.emailTerverifikasi ? "Email asli terverifikasi" : "Dibuat oleh Admin"} ·{" "}
                                {a.statusPersetujuan === "menunggu"
                                  ? "Menunggu persetujuan Admin"
                                  : a.statusPersetujuan === "ditolak"
                                    ? "Ditolak Admin"
                                    : "Disetujui & Aktif"}
                              </dd>
                            </div>
                            <div>
                              <dt>Wilayah tugas</dt>
                              <dd>
                                {a.wilayah ? teksWilayah(a.wilayah) : `${a.desaWilayah} (belum lengkap)`}{" "}
                                <button
                                  type="button"
                                  className="btn-outline-sm"
                                  style={{ padding: "1px 8px", fontSize: "0.72rem" }}
                                  onClick={() => setUbahWilayah({ email: a.email, nilai: { ...WILAYAH_KOSONG, ...a.wilayah } })}
                                >
                                  Ubah
                                </button>
                              </dd>
                            </div>
                            <div>
                              <dt>No. HP</dt>
                              <dd>{a.noHp}</dd>
                            </div>
                            <div>
                              <dt>Kelompok</dt>
                              <dd>{a.kelompokMasyarakat}</dd>
                            </div>
                            <div>
                              <dt>Dibuat</dt>
                              <dd>{a.createdAt ? new Date(a.createdAt).toLocaleDateString("id-ID") : "-"}</dd>
                            </div>
                            <div>
                              <dt>Authenticator</dt>
                              <dd>
                                {a.totpRahasia
                                  ? `Terpasang · ${a.kodePemulihanHash?.length ?? 0} kode pemulihan tersisa`
                                  : "Belum terpasang"}
                              </dd>
                            </div>
                            <div>
                              <dt>Data lapangan</dt>
                              <dd>
                                {dataAkun.length} objek · {terverifikasi} terverifikasi
                              </dd>
                            </div>
                            <div>
                              <dt>Sertifikat</dt>
                              <dd>{sert ? sert.nomorSertifikat : "Belum diterbitkan"}</dd>
                            </div>
                          </dl>
                          {ubahWilayah?.email === a.email && (
                            <div className="ubah-wilayah" style={{ marginTop: 10 }}>
                              <IsianWilayah
                                idAwalan="ubah-wilayah"
                                nilai={ubahWilayah.nilai}
                                onUbah={(nilai) => setUbahWilayah({ email: a.email, nilai })}
                                saran={akun.map((x) => x.wilayah)}
                                wajib
                              />
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="btn-primary-sm"
                                  id="simpan-wilayah"
                                  disabled={!wilayahLengkap(ubahWilayah.nilai)}
                                  onClick={simpanWilayah}
                                >
                                  Simpan wilayah
                                </button>
                                <button type="button" className="btn-outline-sm" onClick={() => setUbahWilayah(null)}>
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}
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

      {/* MENU AKSI AKUN: MODAL / BOTTOM SHEET RAPI */}
      {menuAksiAkun && (
        <div className="aksi-sheet-backdrop" onClick={() => setMenuAksiAkun(null)} role="presentation">
          <div className="aksi-sheet" role="menu" aria-label="Pilihan tindakan akun" onClick={(e) => e.stopPropagation()}>
            <div className="aksi-sheet-judul">
              <strong>{menuAksiAkun.nama}</strong>
              <span>
                {menuAksiAkun.email} · {menuAksiAkun.peran === "admin" ? "Administrator" : "Kader"}
              </span>
            </div>

            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              onClick={() => {
                const email = menuAksiAkun.email;
                setDetailEmail((prev) => (prev === email ? null : email));
                setMenuAksiAkun(null);
              }}
            >
              <Info size={17} /> {detailEmail === menuAksiAkun.email ? "Tutup detail akun" : "Lihat detail akun"}
            </button>

            {(menuAksiAkun.statusPersetujuan === "menunggu" || menuAksiAkun.statusPersetujuan === "ditolak") && (
              <button
                type="button"
                role="menuitem"
                className="aksi-sheet-item"
                onClick={() => {
                  const target = menuAksiAkun;
                  setMenuAksiAkun(null);
                  setujuiAkun(target.email);
                }}
              >
                <CheckCircle2 size={17} color="#0d7344" /> Setujui & aktifkan akun
              </button>
            )}

            {menuAksiAkun.statusPersetujuan === "menunggu" && (
              <button
                type="button"
                role="menuitem"
                className="aksi-sheet-item"
                onClick={() => {
                  const target = menuAksiAkun;
                  setMenuAksiAkun(null);
                  tolakAkun(target.email, target.nama);
                }}
              >
                <XCircle size={17} color="#dc2626" /> Tolak pendaftaran
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              disabled={menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()}
              title={
                menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()
                  ? "Ganti sandi Anda sendiri lewat menu Kata sandi"
                  : "Buat sandi sementara"
              }
              onClick={() => {
                const target = menuAksiAkun;
                setMenuAksiAkun(null);
                void aturUlangSandi(target.email, target.nama);
              }}
            >
              <KeyRound size={17} /> Atur ulang sandi
            </button>

            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              disabled={
                menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase() ||
                !menuAksiAkun.totpRahasia
              }
              title={
                menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()
                  ? "Authenticator Anda hanya bisa diatur ulang oleh admin lain"
                  : !menuAksiAkun.totpRahasia
                    ? "Belum ada Authenticator"
                    : "Hapus Authenticator agar bisa dipasang ulang"
              }
              onClick={() => {
                const target = menuAksiAkun;
                setMenuAksiAkun(null);
                aturUlangAuthenticator(target.email, target.nama);
              }}
            >
              <ShieldAlert size={17} /> Reset Authenticator
            </button>

            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item aksi-sheet-hapus"
              disabled={menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()}
              title={
                menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()
                  ? "Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk"
                  : "Hapus akun dari perangkat ini"
              }
              onClick={() => {
                const target = menuAksiAkun;
                setMenuAksiAkun(null);
                hapusAkun(target.email, target.nama);
              }}
            >
              <Trash2 size={17} /> Hapus akun
            </button>

            <button type="button" className="aksi-sheet-batal" onClick={() => setMenuAksiAkun(null)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
