import { hitungSkorKualitasData } from "../lib/kualitasData";
import React, { useState } from "react";
import {
  DataSpasialItem,
  FieldSkemaAtribut,
  ItemPencadanganSpasial,
  JenisGeometri,
  KaderAktifPresence,
  KategoriSurvei,
  PenandatanganSertifikatItem,
  PengumumanBroadcast,
  ProfilKader,
  SertifikatKader,
  SkemaAtributGeometri,
  StatusSinkron,
  TipeFieldSkema,
  TugasPemetaan
} from "../types";
import {
  ambilDaftarTabelGeometri,
  buatFieldSkemaBaru,
  buatSkemaKosong,
  cloneSkemaGeometri,
  hapusTabelSkema,
  hitungRingkasSkema,
  kelompokkanFieldPerTabel,
  LABEL_TIPE_FIELD,
  tambahTabelSkema,
  ubahNamaTabelSkema
} from "../lib/skemaTugas";
import { adalahDataImpor, adalahDataSimulasi } from "../lib/geoUtils";
import { kompresFotoKeDataUrl } from "../lib/foto";
import { sisaHariPencadangan } from "../lib/pencadanganData";
import { AkunSesi } from "../lib/auth";
import { AkunAdminPanel } from "./AkunAdminPanel";
import { CatatanPerangkat } from "./CatatanPerangkat";
import { PanelDataUserLevel } from "./PanelDataUserLevel";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Layers,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  Table2,
  Users
} from "lucide-react";
import { buatId } from "../lib/id";
import { nomorSertifikatBerikut, ringkasanKader, siapkanSertifikat } from "../lib/sertifikat";
import { DEFAULT_PENANDATANGAN_SERTIFIKAT } from "../lib/sertifikatBawaan";
import { LogoSertifikatResmiSvg } from "./sertifikat/LogoSertifikatResmiSvg";
import { Check, ChevronDown, PlusCircle, X, MapPin, Edit3, Trash2, Battery, Radio, Compass, UserCog } from "lucide-react";
import { useTombolEsc } from "../lib/useTombolEsc";

interface AdminDashboardViewProps {
  dataSpasial: DataSpasialItem[];
  pencadanganList?: ItemPencadanganSpasial[];
  profilKader: ProfilKader;
  sertifikatList: SertifikatKader[];
  tugasList: TugasPemetaan[];
  kaderAktifList: KaderAktifPresence[];
  sesiAdmin: AkunSesi | null;
  onVerifikasiData: (id: string, status: StatusSinkron, catatan?: string) => void;
  onUbahDataSpasial: (data: DataSpasialItem) => void;
  onHapusDataSpasial: (id: string) => void;
  onPulihkanCadangan?: (id: string) => void;
  onHapusPermanenCadangan?: (id: string) => void;
  onRekonsiliasiGDrive?: () => Promise<void> | void;
  sedangRekonsiliasi?: boolean;
  onTerbitkanSertifikat: (sert: SertifikatKader) => void;
  onUbahPenandatanganSertifikat?: (
    nama: string,
    jabatan: string,
    daftarPenandatangan?: PenandatanganSertifikatItem[]
  ) => void;
  onTambahPengumuman: (p: PengumumanBroadcast) => void;
  onTambahTugas: (t: TugasPemetaan) => void;
  onUbahTugas?: (t: TugasPemetaan) => void;
  onVerifikasiTugas?: (id: string) => void;
  onHapusTugas: (id: string) => void;
  onBalasPesanAdmin: (teks: string) => void;
  onFokusKePeta: (lat: number, lng: number, label: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  dataSpasial,
  pencadanganList = [],
  profilKader,
  sertifikatList,
  tugasList,
  kaderAktifList,
  sesiAdmin,
  onVerifikasiData,
  onUbahDataSpasial,
  onHapusDataSpasial,
  onPulihkanCadangan,
  onHapusPermanenCadangan,
  onRekonsiliasiGDrive,
  sedangRekonsiliasi = false,
  onTerbitkanSertifikat,
  onUbahPenandatanganSertifikat,
  onTambahPengumuman,
  onTambahTugas,
  onUbahTugas,
  onVerifikasiTugas,
  onHapusTugas,
  onFokusKePeta
}) => {
const [subTabAdmin, setSubTabAdmin] = useState<"kader_aktif" | "kelola_data" | "tugas_survei" | "sertifikat" | "akun" | "user_level">("kader_aktif");
const [tampilanData, setTampilanData] = useState<"aktif" | "pencadangan">("aktif");

  const [itemDiedit, setItemDiedit] = useState<DataSpasialItem | null>(null);
  // Menu aksi data (mobile): satu daftar pilihan yang muncul saat tombol "Aksi" ditekan
  const [menuAksiData, setMenuAksiData] = useState<DataSpasialItem | null>(null);
  useTombolEsc(menuAksiData !== null, () => setMenuAksiData(null));

  const tinjauPetaData = (d: DataSpasialItem) => {
    const p = d.koordinat[0];
    if (p) onFokusKePeta(p.lat, p.lng, d.judul);
  };

  const mintaRevisiData = (d: DataSpasialItem) => {
    const catatan = window.prompt("Catatan revisi untuk kader", d.catatanAdmin ?? "");
    if (catatan?.trim()) onVerifikasiData(d.id, "ditolak", catatan.trim());
  };

  // Form Tugas Spasial & Konfigurasi Tabel Isian Peta Interaktif (Point, Line, Polygon)
  const [tugasDieditId, setTugasDieditId] = useState<string | null>(null);
  const [judulTugas, setJudulTugas] = useState("");
  const [descTugas, setDescTugas] = useState("");
  const [wilayahTugas, setWilayahTugas] = useState("");
  const [geomTugas, setGeomTugas] = useState<JenisGeometri>("polygon");
  const [kuantitasTugas, setKuantitasTugas] = useState("");
  const [latTugas, setLatTugas] = useState("2.8575");
  const [lngTugas, setLngTugas] = useState("117.3775");
  const [deadlineTugas, setDeadlineTugas] = useState(new Date().toISOString().slice(0, 10));
  const [skemaTugas, setSkemaTugas] = useState<SkemaAtributGeometri>(() => buatSkemaKosong());
  const [tabGeomSkema, setTabGeomSkema] = useState<JenisGeometri>("point");
  const [namaTabelBaru, setNamaTabelBaru] = useState("");
  const [tabelDipilih, setTabelDipilih] = useState("");
  const [namaFieldBaru, setNamaFieldBaru] = useState("");
  const [tipeFieldBaru, setTipeFieldBaru] = useState<TipeFieldSkema>("teks");
  const [wajibFieldBaru, setWajibFieldBaru] = useState<boolean>(true);
  const [opsiFieldBaru, setOpsiFieldBaru] = useState("");
  const [nilaiBawaanBaru, setNilaiBawaanBaru] = useState("");
  const [placeholderFieldBaru, setPlaceholderFieldBaru] = useState("");

  // Form Pengumuman Baru
  const [judulAnn, setJudulAnn] = useState("");
  const [isiAnn, setIsiAnn] = useState("");
  const [katAnn] = useState<PengumumanBroadcast["kategori"]>("Panduan Survei");

  // Form Penerbitan & Pengaturan Penandatangan Sertifikat
  // Nomor berikutnya mengikuti jumlah sertifikat yang sudah terbit; nomor yang diketik admin berlaku
  // sampai jumlah itu berubah (mis. setelah menerbitkan), lalu kembali ke nomor otomatis berikutnya
  const [nomorDiketik, setNomorDiketik] = useState<{ untukJumlah: number; nilai: string } | null>(null);
  const nomorSertBaru =
    nomorDiketik && nomorDiketik.untukJumlah === sertifikatList.length ? nomorDiketik.nilai : nomorSertifikatBerikut(sertifikatList);
  const setNomorSertBaru = (nilai: string) => setNomorDiketik({ untukJumlah: sertifikatList.length, nilai });
  const [pesanTerbit, setPesanTerbit] = useState<{ teks: string; ok: boolean } | null>(null);
  const susunEmpatPenandatangan = (): PenandatanganSertifikatItem[] => {
    const tersimpan = profilKader.penandatanganList ?? [];
    return DEFAULT_PENANDATANGAN_SERTIFIKAT.map((bawaan, idx) => {
      const ada = tersimpan[idx];
      if (ada) return { ...bawaan, ...ada };
      if (idx === 0) {
        return {
          ...bawaan,
          nama: profilKader.namaPenandatanganSertifikat || bawaan.nama,
          jabatan: profilKader.jabatanPenandatanganSertifikat || bawaan.jabatan
        };
      }
      return { ...bawaan };
    });
  };
  const [daftarPenandatangan, setDaftarPenandatangan] = useState<PenandatanganSertifikatItem[]>(susunEmpatPenandatangan);
  const penandatangan = daftarPenandatangan[0]?.nama || "Adi Junedi";
  const jabatanPenandatangan = daftarPenandatangan[0]?.jabatan || "Direktur";

  const ubahSatuPenandatangan = (idx: number, patch: Partial<PenandatanganSertifikatItem>) => {
    const baru = daftarPenandatangan.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    setDaftarPenandatangan(baru);
  };

  const unggahTtdAdmin = async (idx: number, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await kompresFotoKeDataUrl(file, 360);
      const baru = daftarPenandatangan.map((item, i) => (i === idx ? { ...item, tandaTanganBase64: dataUrl } : item));
      setDaftarPenandatangan(baru);
      onUbahPenandatanganSertifikat?.(baru[0]?.nama || "Adi Junedi", baru[0]?.jabatan || "Direktur", baru);
    } catch {
      // Abaikan bila berkas gambar gagal dimuat
    }
  };

  const resetFormTugas = () => {
    setTugasDieditId(null);
    setJudulTugas("");
    setDescTugas("");
    setWilayahTugas("");
    setGeomTugas("polygon");
    setKuantitasTugas("");
    setLatTugas("2.8575");
    setLngTugas("117.3775");
    setDeadlineTugas(new Date().toISOString().slice(0, 10));
    setSkemaTugas(buatSkemaKosong());
    setTabGeomSkema("point");
    setNamaTabelBaru("");
    setTabelDipilih("");
    setNamaFieldBaru("");
    setTipeFieldBaru("teks");
    setWajibFieldBaru(true);
    setOpsiFieldBaru("");
    setNilaiBawaanBaru("");
    setPlaceholderFieldBaru("");
  };

  const mulaiEditTugas = (t: TugasPemetaan) => {
    const skemaSalin = cloneSkemaGeometri(t.skemaGeometri);
    const tabelAwal = ambilDaftarTabelGeometri(skemaSalin, t.jenisTargetGeometri)[0] ?? "";
    setTugasDieditId(t.id);
    setJudulTugas(t.judul);
    setDescTugas(t.deskripsi);
    setWilayahTugas(t.targetWilayah);
    setGeomTugas(t.jenisTargetGeometri);
    setKuantitasTugas(t.targetKuantitas);
    setLatTugas(String(t.koordinatAcuan.lat));
    setLngTugas(String(t.koordinatAcuan.lng));
    setDeadlineTugas(t.batasWaktu);
    setSkemaTugas(skemaSalin);
    setTabGeomSkema(t.jenisTargetGeometri);
    setTabelDipilih(tabelAwal);
  };

  const tambahTabelKeSkema = () => {
    const nama = namaTabelBaru.trim();
    if (!nama) return;
    setSkemaTugas((prev) => tambahTabelSkema(prev, tabGeomSkema, nama));
    setTabelDipilih(nama);
    setNamaTabelBaru("");
  };

  const hapusTabelDariSkema = (namaTabel: string) => {
    setSkemaTugas((prev) => {
      const next = hapusTabelSkema(prev, tabGeomSkema, namaTabel);
      const sisa = ambilDaftarTabelGeometri(next, tabGeomSkema);
      if (tabelDipilih.toLowerCase() === namaTabel.trim().toLowerCase()) {
        setTabelDipilih(sisa[0] ?? "");
      }
      return next;
    });
  };

  const gantiNamaTabelDiSkema = (namaLama: string) => {
    const baru = window.prompt("Ubah nama tabel", namaLama);
    if (!baru || !baru.trim()) return;
    const bersih = baru.trim();
    setSkemaTugas((prev) => ubahNamaTabelSkema(prev, tabGeomSkema, namaLama, bersih));
    if (tabelDipilih.toLowerCase() === namaLama.trim().toLowerCase()) {
      setTabelDipilih(bersih);
    }
  };

  const tambahFieldKeSkema = () => {
    const nama = namaFieldBaru.trim();
    if (!nama) return;
    const daftarTabelSaatIni = ambilDaftarTabelGeometri(skemaTugas, tabGeomSkema);
    const tabelAktif = tabelDipilih.trim() || daftarTabelSaatIni[0] || "Tabel 1";
    const fieldBaru = buatFieldSkemaBaru({
      nama,
      tabel: tabelAktif,
      tipe: tipeFieldBaru,
      wajib: wajibFieldBaru,
      opsi: tipeFieldBaru === "pilihan" ? opsiFieldBaru.split(",").map((x) => x.trim()).filter(Boolean) : undefined,
      nilaiBawaan: nilaiBawaanBaru,
      placeholder: placeholderFieldBaru
    });
    setSkemaTugas((prev) => {
      const denganTabel = tambahTabelSkema(prev, tabGeomSkema, tabelAktif);
      return {
        ...denganTabel,
        [tabGeomSkema]: [...denganTabel[tabGeomSkema], fieldBaru]
      };
    });
    setTabelDipilih(tabelAktif);
    setNamaFieldBaru("");
    setOpsiFieldBaru("");
    setNilaiBawaanBaru("");
    setPlaceholderFieldBaru("");
  };

  const perbaruiFieldSkema = (jenis: JenisGeometri, idField: string, patch: Partial<FieldSkemaAtribut>) => {
    setSkemaTugas((prev) => ({
      ...prev,
      [jenis]: prev[jenis].map((f) => (f.id === idField ? { ...f, ...patch } : f))
    }));
  };

  const geserFieldSkema = (jenis: JenisGeometri, idx: number, arah: -1 | 1) => {
    setSkemaTugas((prev) => {
      const daftar = [...prev[jenis]];
      const target = idx + arah;
      if (target < 0 || target >= daftar.length) return prev;
      const [dipindah] = daftar.splice(idx, 1);
      daftar.splice(target, 0, dipindah);
      return { ...prev, [jenis]: daftar };
    });
  };

  const toggleWajibField = (jenis: JenisGeometri, idField: string) => {
    setSkemaTugas((prev) => ({
      ...prev,
      [jenis]: prev[jenis].map((f) => (f.id === idField ? { ...f, wajib: !f.wajib } : f))
    }));
  };

  const hapusFieldSkema = (jenis: JenisGeometri, idField: string) => {
    setSkemaTugas((prev) => ({
      ...prev,
      [jenis]: prev[jenis].filter((f) => f.id !== idField)
    }));
  };

  const handleBuatTugas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulTugas.trim()) return;
    const payload: TugasPemetaan = {
      id: tugasDieditId ?? buatId("TSK"),
      judul: judulTugas.trim(),
      deskripsi: descTugas.trim() || "Penugasan survei lapangan.",
      targetWilayah: wilayahTugas.trim() || "-",
      jenisTargetGeometri: geomTugas,
      targetKuantitas: kuantitasTugas.trim() || "1 Paket",
      batasWaktu: deadlineTugas,
      koordinatAcuan: {
        lat: Number(latTugas) || 2.8575,
        lng: Number(lngTugas) || 117.3775
      },
      skemaGeometri: cloneSkemaGeometri(skemaTugas),
      status: tugasDieditId ? tugasList.find((x) => x.id === tugasDieditId)?.status ?? "aktif" : "aktif",
      dibuatOleh: "Admin GIS"
    };
    if (tugasDieditId && onUbahTugas) {
      onUbahTugas(payload);
    } else {
      onTambahTugas(payload);
    }
    resetFormTugas();
  };

  const handleBuatPengumuman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judulAnn.trim() || !isiAnn.trim()) return;
    onTambahPengumuman({
      id: buatId("ANN"),
      judul: judulAnn.trim(),
      isi: isiAnn.trim(),
      kategori: katAnn,
      targetDesa: "Semua Wilayah",
      olehAdmin: "Admin GIS",
      tanggal: new Date().toISOString().slice(0, 10),
      penting: true
    });
    setJudulAnn("");
    setIsiAnn("");
  };

  const handleSimpanEditData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDiedit) return;
    onUbahDataSpasial(itemDiedit);
    setItemDiedit(null);
  };

  const jumlahKaderTercatat = new Set(dataSpasial.map((d) => d.idKader)).size;

  return (
    <div className="page-container" style={{ gap: "14px" }}>
      {/* 1. HEADER PANEL ADMIN & SUB-NAVIGASI */}
      <div
        className="section-card"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          border: "1px solid #334155"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 99
                }}
              >
                ADMINISTRATOR GIS
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#38bdf8", lineHeight: 1.4 }}>
              {jumlahKaderTercatat} kader • {dataSpasial.length} data di perangkat ini
            </div>
          </div>
        </div>

        {/* SUB-NAVIGASI ADMIN */}
        <nav className="admin-subnav" aria-label="Menu admin">
          {(
            [
              { id: "kader_aktif", label: "Monitor", Ikon: Radio },
              { id: "user_level", label: "Kader", Ikon: Users },
              { id: "kelola_data", label: "Data", Ikon: Edit3 },
              { id: "tugas_survei", label: "Tugas", Ikon: PlusCircle },
              { id: "sertifikat", label: "Sertifikat", Ikon: LogoSertifikatResmiSvg },
              { id: "akun", label: "Akun", Ikon: UserCog }
            ] as const
          ).map(({ id, label, Ikon }) => (
            <button
              key={id}
              type="button"
              className={`admin-subnav-btn ${subTabAdmin === id ? "aktif" : ""}`}
              aria-pressed={subTabAdmin === id}
              onClick={() => setSubTabAdmin(id)}
            >
              <Ikon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

            {subTabAdmin === "akun" && <AkunAdminPanel sesiAdmin={sesiAdmin} dataSpasial={dataSpasial} sertifikatList={sertifikatList} />}

      {subTabAdmin === "user_level" && (
        <PanelDataUserLevel
          dataSpasial={dataSpasial}
          pencadanganList={pencadanganList}
          profilSaya={profilKader}
          peranPengguna="admin"
          onFokusPetaKader={onFokusKePeta}
        />
      )}

      {/* 2. TAB A: MONITOR KADER AKTIF */}
      {subTabAdmin === "kader_aktif" && (
        <div className="section-card">
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} color="#0284c7" /> Monitor
          </h3>

          {kaderAktifList.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
              {kaderAktifList.map((k) => (
                <div
                  key={k.idKader}
                  style={{
                    background: "#f8faf9",
                    border: "1px solid #d5dcd8",
                    borderRadius: "14px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: "0.94rem" }}>{k.nama}</strong>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                        {k.idKader} • {k.desaWilayah}
                      </div>
                    </div>
                    <span className="badge-kategori">{k.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <Battery size={13} /> {k.baterai}% • {k.waktuUpdate}
                    </span>
                    <button type="button" className="btn-outline-sm" onClick={() => onFokusKePeta(k.lat, k.lng, k.nama)}>
                      <MapPin size={12} /> Peta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8faf9", borderRadius: 12 }}>
              Pemantauan posisi kader secara langsung belum tersedia. Setiap perangkat menyimpan datanya sendiri dan belum ada server yang
              menyatukannya, jadi posisi dan status kader di perangkat lain tidak terlihat di sini.
            </div>
          )}
        </div>
      )}

      {/* 3. TAB B: KELOLA DATA SPASIAL & PENCADANGAN 90 HARI */}
      {subTabAdmin === "kelola_data" && (
        <div className="section-card">
          <div className="admin-data-header-bar">
            <h3 style={{ margin: 0, fontSize: "1rem" }}>✏️ Data ({dataSpasial.length})</h3>
            {onRekonsiliasiGDrive && (
              <button
                type="button"
                className="btn-outline-sm"
                disabled={sedangRekonsiliasi}
                onClick={() => void onRekonsiliasiGDrive()}
                title="Periksa kesesuaian data aktif dan folder pencadangan dengan database Google Drive"
              >
                <RefreshCw size={14} /> {sedangRekonsiliasi ? "Memeriksa…" : "Cek Database GDrive"}
              </button>
            )}
          </div>

          <div className="admin-data-subtabs" role="tablist" aria-label="Pilih daftar data">
            <button
              type="button"
              role="tab"
              aria-selected={tampilanData === "aktif"}
              className={`admin-data-subtab-btn ${tampilanData === "aktif" ? "aktif" : ""}`}
              onClick={() => setTampilanData("aktif")}
            >
              Database Aktif ({dataSpasial.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tampilanData === "pencadangan"}
              className={`admin-data-subtab-btn ${tampilanData === "pencadangan" ? "aktif" : ""}`}
              onClick={() => setTampilanData("pencadangan")}
            >
              <Archive size={14} /> Pencadangan 90 Hari ({pencadanganList.length})
            </button>
          </div>

          {tampilanData === "aktif" && (
            <>
              <CatatanPerangkat style={{ marginBottom: 10 }}>
                Menghapus data di sini akan memindahkannya ke folder Pencadangan 90 Hari (baik di perangkat maupun di folder
                Pencadangan_90_Hari Google Drive) dan mengeluarkannya dari perhitungan level.
              </CatatanPerangkat>

              {dataSpasial.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table data-table-admin-spasial">
                    <thead>
                      <tr>
                        <th>Kader</th>
                        <th>Objek</th>
                        <th>Status</th>
                        <th>Kualitas</th>
                        <th>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataSpasial.map((d) => (
                        <tr key={d.id}>
                          <td className="col-admin-kader">
                            <strong>{d.namaKader}</strong>
                            <div className="text-xs text-muted">{d.id}</div>
                          </td>
                          <td className="col-admin-objek">
                            <span className="badge-kategori">{d.lapisanNama || d.jenisGeometri.toUpperCase()}</span>{" "}
                            {adalahDataImpor(d) && <span className="badge-kategori">IMPOR</span>}{" "}
                            {adalahDataSimulasi(d) && <span className="badge-kategori">SIMULASI</span>} <strong>{d.judul}</strong>
                          </td>
                          <td className="col-admin-status">
                            <span className={`badge-sync status-${d.statusSinkron}`} style={{ marginLeft: 0 }}>
                              {d.statusSinkron.toUpperCase()}
                            </span>
                          </td>
                          <td className="col-admin-kualitas">
                            <details className="dqa-details">
                              <summary className="dqa-badge">
                                {hitungSkorKualitasData(d).grade} · {hitungSkorKualitasData(d).skor}/100
                              </summary>
                              <ul>
                                {hitungSkorKualitasData(d).masalah.map((m) => (
                                  <li key={m}>{m}</li>
                                ))}
                              </ul>
                            </details>
                          </td>
                          <td className="col-admin-tindakan">
                            <div className="aksi-data-desktop" style={{ display: "flex", gap: "6px", flexWrap: "nowrap" }}>
                              <button
                                type="button"
                                className="btn-outline-sm"
                                disabled={!d.koordinat[0]}
                                title="Tinjau lokasi objek pada peta"
                                onClick={() => {
                                  const p = d.koordinat[0];
                                  if (p) onFokusKePeta(p.lat, p.lng, d.judul);
                                }}
                              >
                                <MapPin size={14} /> Peta
                              </button>
                              <button type="button" className="btn-outline-sm" onClick={() => setItemDiedit(d)} title="Edit data objek">
                                <Edit3 size={13} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn-primary-sm"
                                disabled={!hitungSkorKualitasData(d).geometriValid}
                                onClick={() => onVerifikasiData(d.id, "terverifikasi")}
                                title="Sahkan data valid"
                              >
                                <Check size={13} /> Sah
                              </button>
                              <button
                                type="button"
                                className="btn-outline-sm"
                                title="Minta revisi data kepada kader"
                                onClick={() => {
                                  const catatan = window.prompt("Catatan revisi untuk kader", d.catatanAdmin ?? "");
                                  if (catatan?.trim()) onVerifikasiData(d.id, "ditolak", catatan.trim());
                                }}
                              >
                                <X size={13} /> Revisi
                              </button>
                              <button
                                type="button"
                                className="btn-danger-sm"
                                onClick={() => onHapusDataSpasial(d.id)}
                                title="Pindahkan ke Pencadangan 90 Hari"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="btn-outline-sm aksi-data-trigger"
                              aria-haspopup="menu"
                              onClick={() => setMenuAksiData(d)}
                            >
                              Aksi <ChevronDown size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8faf9", borderRadius: 12 }}>
                  Belum ada data lapangan yang direkam.
                </div>
              )}
            </>
          )}

          {tampilanData === "pencadangan" && (
            <div className="admin-pencadangan-panel">
              <CatatanPerangkat style={{ marginBottom: 10 }}>
                File survei yang dihapus admin tersimpan di folder Pencadangan selama 90 hari dan otomatis terhapus permanen jika tidak
                dipulihkan sebelum masa retensi berakhir. Data di Pencadangan tidak dihitung sebagai syarat kenaikan level.
              </CatatanPerangkat>

              {pencadanganList.length > 0 ? (
                <div className="admin-pencadangan-list">
                  {pencadanganList.map((entri) => {
                    const sisa = sisaHariPencadangan(entri);
                    return (
                      <div key={entri.id} className="admin-pencadangan-card">
                        <div className="admin-pencadangan-info">
                          <div className="admin-pencadangan-judul">
                            <strong>{entri.data.judul}</strong>
                            <span className="admin-pencadangan-sisa">{sisa} hari tersisa</span>
                          </div>
                          <div className="admin-pencadangan-meta">
                            <span>{entri.data.namaKader}</span> · <span>{entri.data.lapisanNama || entri.data.jenisGeometri.toUpperCase()}</span> ·{" "}
                            <span>Dipindah {new Date(entri.dipindahkanPada).toLocaleDateString("id-ID")}</span>
                          </div>
                          <div className="admin-pencadangan-status">
                            {entri.statusGDrive === "di_pencadangan" && "Tersinkron ke folder Pencadangan_90_Hari Google Drive"}
                            {entri.statusGDrive === "menunggu_pindah" && "Menunggu pemindahan ke Pencadangan_90_Hari Google Drive"}
                            {entri.statusGDrive === "menunggu_pulih" && "Menunggu pemulihan ke database Google Drive"}
                            {entri.statusGDrive === "menunggu_hapus_permanen" && "Menunggu penghapusan permanen di Google Drive"}
                            {entri.statusGDrive === "lokal_saja" && "Arsip lokal perangkat (belum pernah diunggah ke Google Drive)"}
                          </div>
                        </div>
                        <div className="admin-pencadangan-aksi">
                          {onPulihkanCadangan && (
                            <button
                              type="button"
                              className="btn-outline-sm"
                              onClick={() => onPulihkanCadangan(entri.id)}
                              title="Kembalikan data ke database aktif"
                            >
                              <RotateCcw size={13} /> Pulihkan
                            </button>
                          )}
                          {onHapusPermanenCadangan && (
                            <button
                              type="button"
                              className="btn-danger-sm"
                              onClick={() => onHapusPermanenCadangan(entri.id)}
                              title="Hapus permanen sekarang"
                            >
                              <Trash2 size={13} /> Hapus Permanen
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8faf9", borderRadius: 12 }}>
                  Folder Pencadangan 90 Hari kosong. Data yang dihapus oleh Admin akan tampil di sini selama 90 hari sebelum dihapus permanen.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MENU AKSI DATA (MOBILE): daftar pilihan tindakan */}
      {menuAksiData && (
        <div className="aksi-sheet-backdrop" onClick={() => setMenuAksiData(null)} role="presentation">
          <div className="aksi-sheet" role="menu" aria-label="Pilihan tindakan data" onClick={(e) => e.stopPropagation()}>
            <div className="aksi-sheet-judul">
              <strong>{menuAksiData.judul}</strong>
              <span>
                {menuAksiData.namaKader} · {menuAksiData.id}
              </span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              disabled={!menuAksiData.koordinat[0]}
              onClick={() => {
                const d = menuAksiData;
                setMenuAksiData(null);
                tinjauPetaData(d);
              }}
            >
              <MapPin size={18} /> Peta
            </button>
            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              onClick={() => {
                const d = menuAksiData;
                setMenuAksiData(null);
                setItemDiedit(d);
              }}
            >
              <Edit3 size={18} /> Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item aksi-sheet-sah"
              disabled={!hitungSkorKualitasData(menuAksiData).geometriValid}
              onClick={() => {
                const d = menuAksiData;
                setMenuAksiData(null);
                onVerifikasiData(d.id, "terverifikasi");
              }}
            >
              <Check size={18} /> Sah
            </button>
            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item"
              onClick={() => {
                const d = menuAksiData;
                setMenuAksiData(null);
                mintaRevisiData(d);
              }}
            >
              <X size={18} /> Revisi
            </button>
            <button
              type="button"
              role="menuitem"
              className="aksi-sheet-item aksi-sheet-hapus"
              onClick={() => {
                const d = menuAksiData;
                setMenuAksiData(null);
                onHapusDataSpasial(d.id);
              }}
            >
              <Trash2 size={18} /> Hapus
            </button>
            <button type="button" className="aksi-sheet-batal" onClick={() => setMenuAksiData(null)}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDIT DATA SPASIAL */}
      {itemDiedit && (
        <div className="modal-backdrop" onClick={() => setItemDiedit(null)}>
          <form onSubmit={handleSimpanEditData} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Ubah Data: {itemDiedit.id}</h3>
              <button type="button" className="btn-icon-close" onClick={() => setItemDiedit(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div>
                <label>Judul Objek</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemDiedit.judul}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, judul: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div>
                  <label>Nama Lapisan</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Lapisan 1"
                    value={itemDiedit.lapisanNama || itemDiedit.tematik || ""}
                    onChange={(e) => setItemDiedit({ ...itemDiedit, lapisanNama: e.target.value })}
                  />
                </div>

                <div>
                  <label>Status Verifikasi</label>
                  <select
                    className="form-input"
                    value={itemDiedit.statusSinkron}
                    onChange={(e) => setItemDiedit({ ...itemDiedit, statusSinkron: e.target.value as StatusSinkron })}
                  >
                    <option value="lokal">Lokal (HP)</option>
                    <option value="tersinkron">Tersinkron GDrive</option>
                    <option value="terverifikasi">Terverifikasi Sah</option>
                    <option value="ditolak">Ditolak</option>
                  </select>
                </div>
              </div>

              <div>
                <label>Deskripsi</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={itemDiedit.deskripsi}
                  onChange={(e) => setItemDiedit({ ...itemDiedit, deskripsi: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-outline-sm" onClick={() => setItemDiedit(null)}>
                Batal
              </button>
              <button type="submit" className="btn-primary-sm">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB C: TUGAS SURVEI & SKEMA ISIAN LAPISAN PETA */}
      {subTabAdmin === "tugas_survei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <CatatanPerangkat>
            Tugas tersimpan di perangkat ini dan otomatis muncul pada menu Lapisan pengguna agar format isian Point, Line, dan Polygon
            mengikuti aturan yang Anda tetapkan.
          </CatatanPerangkat>
          <form onSubmit={handleBuatTugas} className="section-card">
            <div className="section-header-flex" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1.02rem", display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={18} color="#0B6E4F" aria-hidden="true" />
                {tugasDieditId ? "Ubah Tugas dan Skema Isian Peta" : "Buat Tugas Pemetaan Baru"}
              </h3>
              {tugasDieditId && (
                <button type="button" className="btn-outline-sm" onClick={resetFormTugas}>
                  Batal Ubah
                </button>
              )}
            </div>

            <div className="form-row-2">
              <div>
                <label>Judul Tugas / Nama Lapisan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Inventarisasi Pohon Pakan"
                  value={judulTugas}
                  onChange={(e) => setJudulTugas(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Wilayah Target</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Blok / wilayah"
                  value={wilayahTugas}
                  onChange={(e) => setWilayahTugas(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-3" style={{ marginTop: 10 }}>
              <div>
                <label>Fokus Geometri</label>
                <select className="form-input" value={geomTugas} onChange={(e) => setGeomTugas(e.target.value as JenisGeometri)}>
                  <option value="point">Titik (Point)</option>
                  <option value="line">Jalur (Line)</option>
                  <option value="polygon">Poligon (Area)</option>
                </select>
              </div>
              <div>
                <label>Target Kuantitas</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="50 Titik / 5 km / 5 Ha"
                  value={kuantitasTugas}
                  onChange={(e) => setKuantitasTugas(e.target.value)}
                />
              </div>
              <div>
                <label>Batas Waktu</label>
                <input type="date" className="form-input" value={deadlineTugas} onChange={(e) => setDeadlineTugas(e.target.value)} />
              </div>
            </div>

            <div className="form-row-2" style={{ marginTop: 10 }}>
              <div>
                <label>Latitude Acuan</label>
                <input type="text" className="form-input" value={latTugas} onChange={(e) => setLatTugas(e.target.value)} />
              </div>
              <div>
                <label>Longitude Acuan</label>
                <input type="text" className="form-input" value={lngTugas} onChange={(e) => setLngTugas(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Instruksi Tugas</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Rincian tugas lapangan untuk kader..."
                value={descTugas}
                onChange={(e) => setDescTugas(e.target.value)}
              />
            </div>

            {/* PENGATUR TABEL & NILAI DATA ISIAN PETA INTERAKTIF (KOSONG SECARA BAWAAN) */}
            <div className="tugas-skema-builder">
              <div className="tugas-skema-head">
                <div>
                  <strong>Tabel dan Aturan Data Isian di Peta Interaktif</strong>
                  <p className="text-xs text-muted" style={{ margin: "2px 0 0" }}>
                    Dimulai kosong tanpa kategori bawaan. Admin bebas menambah atau mengurangi tabel, kolom, tipe input, serta nilai pilihannya untuk Point, Line, dan Polygon.
                  </p>
                </div>
              </div>

              <div className="tugas-skema-tabs" role="tablist" aria-label="Pilih skema geometri">
                {(
                  [
                    ["point", "Point (Titik)"],
                    ["line", "Line (Jalur)"],
                    ["polygon", "Polygon (Area)"]
                  ] as const
                ).map(([g, label]) => {
                  const jmlKolom = skemaTugas[g].length;
                  const jmlTabel = ambilDaftarTabelGeometri(skemaTugas, g).length;
                  const aktif = tabGeomSkema === g;
                  return (
                    <button
                      type="button"
                      key={g}
                      role="tab"
                      aria-selected={aktif}
                      className={`tugas-skema-tab ${aktif ? "aktif" : ""}`}
                      onClick={() => {
                        setTabGeomSkema(g);
                        setTabelDipilih(ambilDaftarTabelGeometri(skemaTugas, g)[0] ?? "");
                      }}
                    >
                      <span>{label}</span>
                      <span className="tugas-skema-badge tabular-nums">{jmlTabel > 0 ? `${jmlTabel}T·${jmlKolom}` : jmlKolom}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pengelola Tambah / Kurangi Tabel */}
              <div className="tugas-tabel-bar">
                <input
                  type="text"
                  className="form-input"
                  placeholder={`Nama tabel baru untuk ${tabGeomSkema.toUpperCase()}...`}
                  value={namaTabelBaru}
                  onChange={(e) => setNamaTabelBaru(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!namaTabelBaru.trim()}
                  onClick={tambahTabelKeSkema}
                >
                  <Table2 size={15} aria-hidden="true" /> Tambah Tabel
                </button>
              </div>

              {/* Daftar tabel & kolom yang sudah dibuat Admin untuk geometri aktif */}
              {(() => {
                const grupTabel = kelompokkanFieldPerTabel(skemaTugas, tabGeomSkema);
                if (grupTabel.length === 0) {
                  return (
                    <div className="tugas-skema-empty">
                      Kosong: belum ada tabel atau kolom untuk <b>{tabGeomSkema.toUpperCase()}</b>. Tambahkan tabel terlebih dahulu atau langsung tambah kolom di bawah.
                    </div>
                  );
                }
                return (
                  <div className="tugas-tabel-list">
                    {grupTabel.map((grp) => (
                      <div key={grp.namaTabel} className="tugas-tabel-card">
                        <div className="tugas-tabel-card-head">
                          <div className="tugas-tabel-card-title">
                            <Table2 size={15} color="#0B6E4F" aria-hidden="true" />
                            <strong>{grp.namaTabel}</strong>
                            <span className="tugas-skema-badge tabular-nums">{grp.fields.length} kolom</span>
                          </div>
                          <div className="tugas-skema-field-actions">
                            <button
                              type="button"
                              className="btn-outline-sm"
                              onClick={() => setTabelDipilih(grp.namaTabel)}
                              title="Pilih tabel ini untuk menambah kolom baru"
                            >
                              + Kolom
                            </button>
                            <button
                              type="button"
                              className="btn-outline-sm"
                              onClick={() => gantiNamaTabelDiSkema(grp.namaTabel)}
                              aria-label={`Ubah nama tabel ${grp.namaTabel}`}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-danger-sm"
                              onClick={() => hapusTabelDariSkema(grp.namaTabel)}
                              aria-label={`Hapus tabel ${grp.namaTabel}`}
                              title="Hapus tabel beserta seluruh kolomnya"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {grp.fields.length === 0 ? (
                          <div className="tugas-skema-empty">
                            Tabel <b>{grp.namaTabel}</b> masih kosong. Tambahkan kolom isian di bawah.
                          </div>
                        ) : (
                          <div className="tugas-skema-field-list">
                            {grp.fields.map((f: FieldSkemaAtribut) => {
                              const idxGlobal = skemaTugas[tabGeomSkema].findIndex((x) => x.id === f.id);
                              return (
                                <div key={f.id} className="tugas-skema-field-item">
                                  <div className="tugas-skema-field-meta">
                                    <div className="tugas-skema-field-title">
                                      <strong>{f.nama}</strong>
                                      <span className="badge-kategori">{LABEL_TIPE_FIELD[f.tipe]}</span>
                                      <button
                                        type="button"
                                        className={`tugas-wajib-toggle ${f.wajib ? "wajib" : ""}`}
                                        onClick={() => toggleWajibField(tabGeomSkema, f.id)}
                                      >
                                        {f.wajib ? "Wajib" : "Opsional"}
                                      </button>
                                    </div>
                                    {f.tipe === "pilihan" && (
                                      <div className="tugas-field-inline-edit">
                                        <label className="text-xs text-muted">
                                          Nilai Pilihan (pisah koma):
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={(f.opsi ?? []).join(", ")}
                                            onChange={(e) =>
                                              perbaruiFieldSkema(tabGeomSkema, f.id, {
                                                opsi: e.target.value
                                                  .split(",")
                                                  .map((x) => x.trim())
                                                  .filter(Boolean)
                                              })
                                            }
                                          />
                                        </label>
                                      </div>
                                    )}
                                    <div className="tugas-field-inline-edit">
                                      <label className="text-xs text-muted">
                                        Nilai Bawaan:
                                        <input
                                          type="text"
                                          className="form-input"
                                          placeholder="Kosong (diisi kader)"
                                          value={f.nilaiBawaan ?? ""}
                                          onChange={(e) =>
                                            perbaruiFieldSkema(tabGeomSkema, f.id, {
                                              nilaiBawaan: e.target.value || undefined
                                            })
                                          }
                                        />
                                      </label>
                                    </div>
                                  </div>
                                  <div className="tugas-skema-field-actions">
                                    <button
                                      type="button"
                                      className="btn-outline-sm"
                                      disabled={idxGlobal <= 0}
                                      aria-label={`Naikkan ${f.nama}`}
                                      onClick={() => geserFieldSkema(tabGeomSkema, idxGlobal, -1)}
                                    >
                                      <ArrowUp size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-outline-sm"
                                      disabled={idxGlobal === skemaTugas[tabGeomSkema].length - 1}
                                      aria-label={`Turunkan ${f.nama}`}
                                      onClick={() => geserFieldSkema(tabGeomSkema, idxGlobal, 1)}
                                    >
                                      <ArrowDown size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-danger-sm"
                                      aria-label={`Hapus ${f.nama}`}
                                      onClick={() => hapusFieldSkema(tabGeomSkema, f.id)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Composer tambah kolom baru ke tabel terpilih */}
              <div className="tugas-skema-composer">
                <div className="form-row-2">
                  <div>
                    <label>Masukkan ke Tabel</label>
                    <input
                      type="text"
                      list={`daftar-tabel-${tabGeomSkema}`}
                      className="form-input"
                      placeholder="Misal: Tabel Identitas (otomatis dibuat bila baru)"
                      value={tabelDipilih}
                      onChange={(e) => setTabelDipilih(e.target.value)}
                    />
                    <datalist id={`daftar-tabel-${tabGeomSkema}`}>
                      {ambilDaftarTabelGeometri(skemaTugas, tabGeomSkema).map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label>Nama Kolom / Isian</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Kolom ${tabGeomSkema}...`}
                      value={namaFieldBaru}
                      onChange={(e) => setNamaFieldBaru(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row-3" style={{ marginTop: 8 }}>
                  <div>
                    <label>Format Input</label>
                    <select
                      className="form-input"
                      value={tipeFieldBaru}
                      onChange={(e) => setTipeFieldBaru(e.target.value as TipeFieldSkema)}
                    >
                      <option value="teks">Teks Singkat</option>
                      <option value="angka">Angka</option>
                      <option value="pilihan">Pilihan (Dropdown)</option>
                      <option value="tanggal">Tanggal</option>
                      <option value="catatan">Catatan Panjang</option>
                      <option value="foto">Foto</option>
                    </select>
                  </div>
                  <div>
                    <label>Nilai Bawaan (Opsional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nilai awal kolom"
                      value={nilaiBawaanBaru}
                      onChange={(e) => setNilaiBawaanBaru(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Status Isian</label>
                    <button
                      type="button"
                      className={`form-input tugas-wajib-btn ${wajibFieldBaru ? "aktif" : ""}`}
                      aria-pressed={wajibFieldBaru}
                      onClick={() => setWajibFieldBaru((v) => !v)}
                    >
                      {wajibFieldBaru ? "✓ Wajib Diisi" : "Opsional"}
                    </button>
                  </div>
                </div>
                <div className="form-row-2" style={{ marginTop: 8 }}>
                  {tipeFieldBaru === "pilihan" ? (
                    <div>
                      <label>Daftar Nilai Pilihan (pisahkan dengan koma)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nilai A, Nilai B, Nilai C"
                        value={opsiFieldBaru}
                        onChange={(e) => setOpsiFieldBaru(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <label>Teks Petunjuk (Opsional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Petunjuk pengisian"
                        value={placeholderFieldBaru}
                        onChange={(e) => setPlaceholderFieldBaru(e.target.value)}
                      />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ width: "100%" }}
                      disabled={!namaFieldBaru.trim()}
                      onClick={tambahFieldKeSkema}
                    >
                      <Plus size={15} aria-hidden="true" /> Tambah Kolom ke {tabGeomSkema.toUpperCase()}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: 14, width: "100%" }}
              title="Publikasikan penugasan survei dan sinkronkan ke menu Lapisan"
            >
              <PlusCircle size={16} /> {tugasDieditId ? "Simpan Perubahan Tugas dan Skema" : "Publikasikan Tugas ke Lapisan"}
            </button>
          </form>

          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList size={17} color="#0B6E4F" aria-hidden="true" />
              Daftar Tugas ({tugasList.length})
            </h3>
            {tugasList.length > 0 ? (
              <div className="admin-tugas-grid">
                {tugasList.map((t) => {
                  const ringkas = hitungRingkasSkema(t.skemaGeometri);
                  return (
                    <div key={t.id} className="admin-tugas-card">
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                          <span className="badge-kategori">{t.jenisTargetGeometri.toUpperCase()}</span>
                          <span
                            className={`badge-sync ${
                              t.status === "selesai"
                                ? "status-terverifikasi"
                                : t.status === "menunggu_verifikasi"
                                  ? "status-lokal"
                                  : "status-tersinkron"
                            }`}
                          >
                            {t.status === "selesai" ? "SELESAI" : t.status === "menunggu_verifikasi" ? "MENUNGGU VERIF" : "AKTIF"}
                          </span>
                        </div>
                        <h4 style={{ margin: "8px 0 4px", fontSize: "0.96rem", color: "#0f172a" }}>{t.judul}</h4>
                        <div className="text-xs text-muted">
                          {t.targetKuantitas} · {t.targetWilayah} · Batas {t.batasWaktu}
                        </div>
                        <div className="tugas-skema-summary-pills">
                          <span>Point: {ringkas.tabelPoint} tabel ({ringkas.point})</span>
                          <span>Line: {ringkas.tabelLine} tabel ({ringkas.line})</span>
                          <span>Polygon: {ringkas.tabelPolygon} tabel ({ringkas.polygon})</span>
                        </div>
                      </div>
                      <div className="admin-tugas-actions">
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => mulaiEditTugas(t)}
                          title="Ubah tugas atau skema isian Point, Line, dan Polygon"
                        >
                          <Edit3 size={13} /> Ubah Skema
                        </button>
                        {t.status !== "selesai" && onVerifikasiTugas && (
                          <button
                            type="button"
                            className="btn-primary-sm"
                            onClick={() => onVerifikasiTugas(t.id)}
                            title="Sahkan penyelesaian tugas (+60 poin level)"
                          >
                            <Check size={13} /> Sahkan
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => onFokusKePeta(t.koordinatAcuan.lat, t.koordinatAcuan.lng, t.judul)}
                        >
                          <Compass size={13} /> Peta
                        </button>
                        <button type="button" className="btn-danger-sm" onClick={() => onHapusTugas(t.id)} title="Hapus tugas">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Belum ada tugas aktif.</div>
            )}
          </div>

          <form onSubmit={handleBuatPengumuman} className="section-card">
            <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>📢 Buat Pengumuman</h3>
            <div className="form-row-2">
              <input
                type="text"
                className="form-input"
                placeholder="Judul pengumuman"
                value={judulAnn}
                onChange={(e) => setJudulAnn(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Isi pesan"
                value={isiAnn}
                onChange={(e) => setIsiAnn(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-outline-sm" style={{ marginTop: 10 }} title="Umumkan pesan kepada seluruh kader">
              Umumkan
            </button>
          </form>
        </div>
      )}

      {/* 5. TAB D: SERTIFIKAT */}
      {subTabAdmin === "sertifikat" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <LogoSertifikatResmiSvg size={20} variant="zamrud" /> Sertifikat
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label>Nomor sertifikat berikutnya</label>
              <input type="text" className="form-input" value={nomorSertBaru} onChange={(e) => setNomorSertBaru(e.target.value)} />
            </div>

            <div className="admin-signers-grid">
              {daftarPenandatangan.map((sig, idx) => (
                <div key={sig.id} className="admin-signer-box">
                  <div className="admin-signer-box-head">
                    <strong>
                      Penandatangan #{idx + 1} · {sig.jabatan || `Posisi ${idx + 1}`}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <label className="btn-outline-sm admin-ttd-btn" style={{ margin: 0, cursor: "pointer" }} title="Unggah gambar tanda tangan">
                        <PenTool size={12} /> {sig.tandaTanganBase64 ? "Ganti TTD" : "Unggah TTD"}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            void unggahTtdAdmin(idx, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {sig.tandaTanganBase64 && (
                        <button
                          type="button"
                          className="btn-outline-sm admin-ttd-btn"
                          onClick={() => {
                            const baru = daftarPenandatangan.map((item, i) =>
                              i === idx ? { ...item, tandaTanganBase64: undefined } : item
                            );
                            setDaftarPenandatangan(baru);
                            onUbahPenandatanganSertifikat?.(baru[0]?.nama || "Adi Junedi", baru[0]?.jabatan || "Direktur", baru);
                          }}
                          title="Hapus gambar tanda tangan"
                        >
                          Hapus TTD
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="form-row-3">
                    <div>
                      <label>Nama Penandatangan</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nama yang menandatangani sertifikat"
                        value={sig.nama}
                        onChange={(e) => ubahSatuPenandatangan(idx, { nama: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Jabatan Penandatangan</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Jabatan pejabat penandatangan"
                        value={sig.jabatan}
                        onChange={(e) => ubahSatuPenandatangan(idx, { jabatan: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Instansi</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Instansi penandatangan"
                        value={sig.instansi}
                        onChange={(e) => ubahSatuPenandatangan(idx, { instansi: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-outline"
                style={{ flex: "1 1 200px" }}
                onClick={() =>
                  onUbahPenandatanganSertifikat?.(
                    daftarPenandatangan[0]?.nama || "Adi Junedi",
                    daftarPenandatangan[0]?.jabatan || "Direktur",
                    daftarPenandatangan
                  )
                }
                title="Simpan keempat penandatangan sertifikat"
              >
                ✍️ Simpan
              </button>
            </div>

            <h4 style={{ margin: "16px 0 8px", fontSize: "0.92rem" }}>Kader dan capaian terverifikasi</h4>
            {pesanTerbit && (
              <div
                role="status"
                className="alert-banner-success"
                style={
                  pesanTerbit.ok
                    ? { margin: "0 0 8px" }
                    : { margin: "0 0 8px", background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }
                }
              >
                {pesanTerbit.teks}
              </div>
            )}
            {ringkasanKader(dataSpasial, sertifikatList, profilKader.modeKombinasiTarget).length === 0 ? (
              <p className="text-muted" style={{ fontSize: "0.84rem", margin: 0 }}>
                Belum ada data kader. Sertifikat bisa diterbitkan setelah data kader diverifikasi.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table" id="tabel-kader-sertifikat">
                  <thead>
                    <tr>
                      <th>Kader</th>
                      <th>Terverifikasi</th>
                      <th>Status</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ringkasanKader(dataSpasial, sertifikatList, profilKader.modeKombinasiTarget).map((k) => (
                      <tr key={k.idKader}>
                        <td>
                          <strong>{k.namaKader}</strong>
                          <div className="text-xs text-muted">
                            {k.idKader} • {k.desaWilayah}
                          </div>
                        </td>
                        <td className="text-xs">
                          {k.capaian.totalPoinTitik} titik • {k.capaian.totalTrackingKm.toFixed(1)} km •{" "}
                          {k.capaian.totalPoligonHa.toFixed(1)} Ha
                        </td>
                        <td>
                          <span
                            className={`badge-sync ${k.sudahTerbit ? "status-terverifikasi" : k.capaian.berhakSertifikat ? "status-tersinkron" : "status-lokal"}`}
                            style={{ marginLeft: 0 }}
                          >
                            {k.sudahTerbit ? "TERBIT" : k.capaian.berhakSertifikat ? "SIAP TERBIT" : "BELUM"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            disabled={k.sudahTerbit || !k.capaian.berhakSertifikat}
                            title={
                              k.sudahTerbit
                                ? "Sertifikat sudah diterbitkan"
                                : k.capaian.berhakSertifikat
                                  ? "Terbitkan sertifikat untuk kader ini"
                                  : "Belum memenuhi syarat sertifikasi (50 titik, 5 km jalur, dan 5 Ha poligon terverifikasi)"
                            }
                            onClick={() => {
                              const hasil = siapkanSertifikat(k, nomorSertBaru, sertifikatList, {
                                namaOrganisasi: profilKader.namaOrganisasi,
                                ditandatanganiOleh: penandatangan,
                                jabatanPenandatangan,
                                penandatanganList: daftarPenandatangan,
                                fotoKaderBase64: k.idKader === profilKader.idKader ? profilKader.fotoKaderBase64 : undefined
                              });
                              setPesanTerbit({ teks: hasil.pesan, ok: hasil.ok });
                              if (hasil.ok && hasil.sertifikat) onTerbitkanSertifikat(hasil.sertifikat);
                            }}
                          >
                            <LogoSertifikatResmiSvg size={14} variant="zamrud" /> Terbitkan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sertifikatList.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {sertifikatList.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      fontSize: "0.84rem"
                    }}
                  >
                    <div>
                      <strong>{s.nomorSertifikat}</strong> — {s.namaKader}
                      <div style={{ color: "#047857", fontSize: "0.78rem" }}>
                        Penandatangan:{" "}
                        {(s.penandatanganList && s.penandatanganList.length > 0
                          ? s.penandatanganList
                          : [{ nama: s.ditandatanganiOleh, jabatan: s.jabatanPenandatangan }]
                        ).map((p, i) => (
                          <span key={i}>
                            {i > 0 ? " • " : ""}
                            <strong>{p.nama}</strong> ({p.jabatan})
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="badge-sync status-terverifikasi">TERBIT</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
