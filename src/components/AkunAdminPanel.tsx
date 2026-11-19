import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  KeyRound,
  Lock,
  MailCheck,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCheck,
  XCircle
} from "lucide-react";
import {
  AkunSesi,
  aturUlangAuthenticatorOlehAdmin,
  aturUlangSandiOlehAdmin,
  daftarKunciSesiAktif,
  hapusAkunOlehAdmin,
  lepasKunciSesiOlehAdmin,
  muatSemuaAkun,
  resetSemuaAkunOlehAdmin,
  setujuiAkunOlehAdmin,
  sinkronkanDaftarAkunGDrive,
  tolakAkunOlehAdmin,
  ubahWilayahAkunOlehAdmin
} from "../lib/auth";
import { DataSpasialItem, SertifikatKader, WilayahAdministrasi } from "../types";
import { WILAYAH_KOSONG, teksWilayah, wilayahLengkap } from "../lib/wilayah";
import { migrasiFolderWilayahKeGDrive } from "../lib/gdriveSync";
import { useTombolEsc } from "../lib/useTombolEsc";
import { IsianWilayah } from "./IsianWilayah";

interface KonfirmasiAkunState {
  judul: string;
  pesan: string;
  labelSetuju: string;
  berbahaya?: boolean;
  onKonfirmasi: () => void | Promise<void>;
}

interface AkunAdminPanelProps {
  sesiAdmin: AkunSesi | null;
  /** Untuk ringkasan per akun: admin dapat melihat isi akun user (user tidak dapat melihat akun admin) */
  dataSpasial?: DataSpasialItem[];
  sertifikatList?: SertifikatKader[];
}

type FilterStatus = "semua" | "menunggu" | "disetujui" | "ditolak";

/**
 * Panel Persetujuan Pendaftaran dan Manajemen Akun oleh Administrator.
 * Pembuatan akun baru hanya dilakukan pengguna secara mandiri dengan OTP email dari halaman utama,
 * lalu disetujui atau ditolak oleh Administrator di panel ini.
 */
export const AkunAdminPanel: React.FC<AkunAdminPanelProps> = ({ sesiAdmin, dataSpasial = [], sertifikatList = [] }) => {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState<{ judul: string; email: string; nama: string; sandi: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const [sedangSinkron, setSedangSinkron] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("semua");
  const [detailEmail, setDetailEmail] = useState<string | null>(null);
  const [ubahWilayah, setUbahWilayah] = useState<{ email: string; nilai: WilayahAdministrasi } | null>(null);
  const akun = muatSemuaAkun();
  const kunciSesi = daftarKunciSesiAktif();
  const [menuAksiAkun, setMenuAksiAkun] = useState<(typeof akun)[number] | null>(null);
  const [konfirmasiAksi, setKonfirmasiAksi] = useState<KonfirmasiAkunState | null>(null);
  const [sedangMemprosesKonfirmasi, setSedangMemprosesKonfirmasi] = useState(false);
  void versi;

  useTombolEsc(Boolean(konfirmasiAksi), () => {
    if (!sedangMemprosesKonfirmasi) setKonfirmasiAksi(null);
  });
  useTombolEsc(Boolean(menuAksiAkun) && !konfirmasiAksi, () => setMenuAksiAkun(null));

  const segarkanDariCloud = useCallback(async (tampilkanPesan = false) => {
    setSedangSinkron(true);
    try {
      const res = await sinkronkanDaftarAkunGDrive();
      setVersi((v) => v + 1);
      if (tampilkanPesan) {
        if (res.sukses) {
          setInfo(`Daftar akun berhasil disegarkan (${res.jumlah} akun di server).`);
        } else {
          setGalat(res.pesan || "Belum dapat terhubung ke server akun Google Drive.");
        }
      }
    } finally {
      setSedangSinkron(false);
    }
  }, []);

  useEffect(() => {
    void segarkanDariCloud(false);
  }, [segarkanDariCloud]);

  const bersihkan = () => {
    setGalat(null);
    setInfo(null);
    setHasil(null);
    setTersalin(false);
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
    setKonfirmasiAksi({
      judul: "Reset Google Authenticator",
      pesan: `Yakin ingin menghapus Google Authenticator milik ${nama}? Pengguna harus mendaftarkan kode baru saat masuk berikutnya.`,
      labelSetuju: "Ya, Reset",
      berbahaya: true,
      onKonfirmasi: () => {
        bersihkan();
        const r = aturUlangAuthenticatorOlehAdmin(sesiAdmin, email);
        if (!r.sukses) setGalat(r.pesan);
        else setInfo(r.pesan);
        setVersi((v) => v + 1);
      }
    });
  };

  const lepasKunciSesi = (email: string, nama: string) => {
    setKonfirmasiAksi({
      judul: "Lepas Kunci Perangkat",
      pesan: `Yakin ingin melepas kunci perangkat aktif untuk ${nama} (${email})? Sesi sebelumnya akan dihentikan.`,
      labelSetuju: "Ya, Lepas Sesi",
      berbahaya: false,
      onKonfirmasi: () => {
        bersihkan();
        const r = lepasKunciSesiOlehAdmin(sesiAdmin, email);
        if (!r.sukses) setGalat(r.pesan);
        else setInfo(r.pesan);
        setVersi((v) => v + 1);
      }
    });
  };

  const hapusAkun = (email: string, nama: string) => {
    setKonfirmasiAksi({
      judul: "Konfirmasi Hapus Akun",
      pesan: `Apakah Anda yakin ingin menghapus akun ${nama} (${email})? Akun ini akan dihapus permanen dan tidak dapat masuk lagi. Data lapangan yang sudah tersimpan tetap aman.`,
      labelSetuju: "Ya, Hapus Akun",
      berbahaya: true,
      onKonfirmasi: () => {
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
      }
    });
  };

  const setujuiAkun = (email: string) => {
    bersihkan();
    const r = setujuiAkunOlehAdmin(sesiAdmin, email);
    if (!r.sukses) setGalat(r.pesan);
    else setInfo(r.pesan);
    setVersi((v) => v + 1);
  };

  const tolakAkun = (email: string, nama: string) => {
    setKonfirmasiAksi({
      judul: "Tolak Pendaftaran Akun",
      pesan: `Yakin ingin menolak pendaftaran akun ${nama} (${email})? Akun ini tidak akan aktif sampai disetujui.`,
      labelSetuju: "Ya, Tolak",
      berbahaya: true,
      onKonfirmasi: () => {
        bersihkan();
        const r = tolakAkunOlehAdmin(sesiAdmin, email);
        if (!r.sukses) setGalat(r.pesan);
        else setInfo(r.pesan);
        setVersi((v) => v + 1);
      }
    });
  };

  const resetSemuaAkun = () => {
    setKonfirmasiAksi({
      judul: "Konfirmasi Reset Semua Akun",
      pesan:
        "Apakah Anda yakin ingin menghapus semua akun kader terdaftar saat ini (lokal dan server)? Hanya akun Administrator yang dipertahankan. Pengguna lain harus mendaftar ulang dengan verifikasi OTP email.",
      labelSetuju: "Ya, Hapus Semua",
      berbahaya: true,
      onKonfirmasi: async () => {
        bersihkan();
        const r = await resetSemuaAkunOlehAdmin(sesiAdmin);
        if (!r.sukses) setGalat(r.pesan);
        else setInfo(r.pesan);
        setDetailEmail(null);
        setUbahWilayah(null);
        setVersi((v) => v + 1);
      }
    });
  };

  const jalankanKonfirmasiAksi = async () => {
    if (!konfirmasiAksi || sedangMemprosesKonfirmasi) return;
    setSedangMemprosesKonfirmasi(true);
    try {
      await konfirmasiAksi.onKonfirmasi();
      setKonfirmasiAksi(null);
    } finally {
      setSedangMemprosesKonfirmasi(false);
    }
  };

  const salin = async () => {
    if (!hasil) return;
    try {
      await navigator.clipboard.writeText(hasil.sandi);
      setTersalin(true);
    } catch {
      // clipboard tidak tersedia
    }
  };

  const statusAkun = (a: (typeof akun)[number]) => {
    if (a.statusPersetujuan === "menunggu") return "Menunggu persetujuan";
    if (a.statusPersetujuan === "ditolak") return "Ditolak";
    return a.totpRahasia ? "Aktif (Authenticator terpasang)" : "Disetujui (Belum Authenticator)";
  };

  const akunMenunggu = akun.filter((a) => a.statusPersetujuan === "menunggu");
  const akunTersaring = akun.filter((a) => {
    if (filterStatus === "semua") return true;
    if (filterStatus === "menunggu") return a.statusPersetujuan === "menunggu";
    if (filterStatus === "ditolak") return a.statusPersetujuan === "ditolak";
    return !a.statusPersetujuan || a.statusPersetujuan === "disetujui";
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. ANTREAN PERSETUJUAN AKUN BARU */}
      <div className="section-card" id="panel-persetujuan-akun">
        <div className="section-header-flex" style={{ marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <UserCheck size={18} color="#0B6E4F" aria-hidden="true" />
              Persetujuan Akun Baru ({akunMenunggu.length})
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Akun baru dibuat langsung oleh pendaftar lewat OTP email di halaman awal. Setujui agar akun dapat masuk. Tarik layar ke bawah untuk menyegarkan daftar.
            </p>
          </div>
        </div>

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

        {akunMenunggu.length === 0 ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
              color: "#475569",
              fontSize: "0.84rem"
            }}
          >
            Belum ada pendaftaran akun baru yang menunggu persetujuan Administrator.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {akunMenunggu.map((pendaftar) => (
              <div
                key={pendaftar.email}
                style={{
                  border: "1.5px solid #a7f3d0",
                  background: "#ecfdf5",
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{pendaftar.nama}</strong>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: "#ffffff",
                        color: "#0B6E4F",
                        border: "1px solid #a7f3d0"
                      }}
                    >
                      <MailCheck size={12} aria-hidden="true" /> Email OTP terverifikasi
                    </span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#334155", marginTop: 3 }}>{pendaftar.email}</div>
                  <div style={{ fontSize: "0.76rem", color: "#475569", marginTop: 4 }}>
                    Wilayah: {pendaftar.wilayah ? teksWilayah(pendaftar.wilayah) : pendaftar.desaWilayah || "-"} · Kelompok:{" "}
                    {pendaftar.kelompokMasyarakat || "-"} · HP: {pendaftar.noHp || "-"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    style={{ minHeight: 40, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => setujuiAkun(pendaftar.email)}
                  >
                    <CheckCircle2 size={15} aria-hidden="true" /> Setujui
                  </button>
                  <button
                    type="button"
                    className="btn-danger-sm"
                    style={{ minHeight: 40, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => tolakAkun(pendaftar.email, pendaftar.nama)}
                  >
                    <XCircle size={15} aria-hidden="true" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. DAFTAR AKUN TERDAFTAR DAN KONTROL SESI TUNGGAL */}
      <div className="section-card" id="panel-akun-admin">
        <div className="akun-admin-card-header">
          <div className="akun-admin-title-row">
            <h3 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <KeyRound size={18} color="#0B6E4F" aria-hidden="true" /> Akun Terdaftar ({akun.length})
            </h3>
            <button
              type="button"
              className="btn-danger-sm"
              onClick={() => void resetSemuaAkun()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset Akun
            </button>
          </div>
          <p className="text-muted" style={{ margin: "6px 0 10px", fontSize: "0.82rem" }}>
            Satu email untuk satu akun dan satu perangkat aktif. Gunakan Reset bila ingin menghapus semua akun kader lama.
          </p>
        </div>

        <div className="akun-filter-pills">
          {(
            [
              { id: "semua", label: `Semua (${akun.length})` },
              { id: "menunggu", label: `Menunggu (${akunMenunggu.length})` },
              { id: "disetujui", label: "Aktif" },
              { id: "ditolak", label: "Ditolak" }
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className={filterStatus === f.id ? "btn-primary-sm" : "btn-outline-sm"}
              onClick={() => setFilterStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

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
              {akunTersaring.map((a) => {
                const emailKecil = a.email.toLowerCase();
                const kunci = kunciSesi[emailKecil];
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
                        {kunci && (
                          <div
                            className="text-xs"
                            style={{
                              marginTop: 3,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#0B6E4F",
                              fontWeight: 600
                            }}
                          >
                            <Lock size={11} aria-hidden="true" /> Sesi aktif ({kunci.infoPerangkat || "Perangkat"})
                          </div>
                        )}
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
                                {a.emailTerverifikasi ? "Email asli terverifikasi OTP" : "Akun bawaan"} ·{" "}
                                {a.statusPersetujuan === "menunggu"
                                  ? "Menunggu persetujuan Admin"
                                  : a.statusPersetujuan === "ditolak"
                                    ? "Ditolak Admin"
                                    : "Aktif"}
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
                              <dt>Kunci sesi perangkat</dt>
                              <dd>{kunci ? `Terkunci pada ${kunci.infoPerangkat || kunci.idPerangkat}` : "Bebas (belum masuk)"}</dd>
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

      {/* MENU AKSI AKUN */}
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
                <CheckCircle2 size={17} color="#0B6E4F" /> Setujui dan aktifkan akun
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
              onClick={() => {
                const target = menuAksiAkun;
                setMenuAksiAkun(null);
                lepasKunciSesi(target.email, target.nama);
              }}
            >
              <Unlock size={17} /> Lepas kunci sesi perangkat
            </button>

            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              disabled={menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase()}
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
                menuAksiAkun.email.toLowerCase() === sesiAdmin?.email.toLowerCase() || !menuAksiAkun.totpRahasia
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

      {konfirmasiAksi && (
        <div
          className="konfirmasi-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="konfirmasi-akun-judul"
          onClick={() => {
            if (!sedangMemprosesKonfirmasi) setKonfirmasiAksi(null);
          }}
        >
          <div className="konfirmasi-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="konfirmasi-modal-head">
              <span className={`konfirmasi-modal-icon ${konfirmasiAksi.berbahaya ? "danger" : ""}`} aria-hidden="true">
                {konfirmasiAksi.berbahaya ? <Trash2 size={20} /> : <ShieldAlert size={20} />}
              </span>
              <h4 id="konfirmasi-akun-judul" className="konfirmasi-modal-title">
                {konfirmasiAksi.judul}
              </h4>
            </div>
            <p className="konfirmasi-modal-desc">{konfirmasiAksi.pesan}</p>
            <div className="konfirmasi-modal-actions">
              <button
                type="button"
                className="btn-outline"
                disabled={sedangMemprosesKonfirmasi}
                onClick={() => setKonfirmasiAksi(null)}
              >
                Batalkan
              </button>
              <button
                type="button"
                className={konfirmasiAksi.berbahaya ? "btn-danger-solid" : "btn-primary"}
                disabled={sedangMemprosesKonfirmasi}
                onClick={() => void jalankanKonfirmasiAksi()}
              >
                {sedangMemprosesKonfirmasi ? "Memproses..." : konfirmasiAksi.labelSetuju}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
