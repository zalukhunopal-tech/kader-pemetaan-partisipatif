import { hitungSkorKualitasData } from "../lib/kualitasData";
import React, { useMemo, useState } from "react";
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
  SkemaPengkodeanSertifikat,
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
import {
  adalahDataImpor,
  adalahDataSimulasi,
  eksporKeCSV,
  eksporKeGeoJSON,
  sanitasiAtributKustom,
  sanitasiTeksInput
} from "../lib/geoUtils";
import { buatArsipZip, eksporPaketShapefile } from "../lib/shapefile";
import { kompresFotoKeDataUrl } from "../lib/foto";
import { sisaHariPencadangan } from "../lib/pencadanganData";
import { AkunSesi, muatSemuaAkun } from "../lib/auth";
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
  RotateCcw,
  Share2,
  Table2,
  Users
} from "lucide-react";
import { buatId } from "../lib/id";
import {
  buatNomorSertifikatOtomatis,
  nomorSertifikatBerikut,
  ringkasanKader,
  siapkanSemuaSertifikatOtomatis,
  siapkanSertifikat
} from "../lib/sertifikat";
import { DEFAULT_PENANDATANGAN_SERTIFIKAT } from "../lib/sertifikatBawaan";
import { LogoSertifikatResmiSvg } from "./sertifikat/LogoSertifikatResmiSvg";
import { Check, ChevronDown, Download, Hexagon, PlusCircle, Route, X, MapPin, Edit3, Trash2, Battery, Radio, Compass, UserCog } from "lucide-react";
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
  onTerbitkanBanyakSertifikat?: (daftar: SertifikatKader[]) => void;
  onUbahPenandatanganSertifikat?: (
    nama: string,
    jabatan: string,
    daftarPenandatangan?: PenandatanganSertifikatItem[]
  ) => void;
  onTambahPengumuman?: (p: PengumumanBroadcast) => void;
  onTambahTugas: (t: TugasPemetaan) => void;
  onUbahTugas?: (t: TugasPemetaan) => void;
  onVerifikasiTugas?: (id: string) => void;
  onHapusTugas: (id: string) => void;
  onBalasPesanAdmin: (teks: string) => void;
  onFokusKePeta: (lat: number, lng: number, label: string, tugasId?: string) => void;
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
  onTerbitkanBanyakSertifikat,
  onUbahPenandatanganSertifikat,
  onTambahTugas,
  onUbahTugas,
  onVerifikasiTugas,
  onHapusTugas,
  onFokusKePeta
}) => {
const [subTabAdmin, setSubTabAdmin] = useState<"kader_aktif" | "kelola_data" | "tugas_survei" | "sertifikat" | "akun" | "user_level">("kader_aktif");
const [tampilanData, setTampilanData] = useState<"aktif" | "pencadangan">("aktif");
const [filterLapisanAdmin, setFilterLapisanAdmin] = useState<string>("semua");

  const [itemDiedit, setItemDiedit] = useState<DataSpasialItem | null>(null);
  // Menu aksi data (mobile): satu daftar pilihan yang muncul saat tombol "Aksi" ditekan
  const [menuAksiData, setMenuAksiData] = useState<DataSpasialItem | null>(null);
  const [revisiDataTarget, setRevisiDataTarget] = useState<DataSpasialItem | null>(null);
  const [catatanRevisiInput, setCatatanRevisiInput] = useState<string>("");
  useTombolEsc(itemDiedit !== null, () => setItemDiedit(null));
  useTombolEsc(menuAksiData !== null, () => setMenuAksiData(null));
  useTombolEsc(revisiDataTarget !== null, () => {
    setRevisiDataTarget(null);
    setCatatanRevisiInput("");
  });

  const tinjauPetaData = (d: DataSpasialItem) => {
    const p = d.koordinat[0];
    if (p) onFokusKePeta(p.lat, p.lng, d.judul);
  };

  const mintaRevisiData = (d: DataSpasialItem) => {
    setRevisiDataTarget(d);
    setCatatanRevisiInput(d.catatanAdmin ?? "");
  };

  const kirimCatatanRevisi = (e: React.FormEvent) => {
    e.preventDefault();
    const catatanBersih = sanitasiTeksInput(catatanRevisiInput);
    if (!revisiDataTarget || !catatanBersih) return;
    onVerifikasiData(revisiDataTarget.id, "ditolak", catatanBersih);
    setRevisiDataTarget(null);
    setCatatanRevisiInput("");
  };

  // Form Tugas Spasial & Format Data Lapisan (per tipe data Point, Line, Polygon atau Default)
  const [tugasDieditId, setTugasDieditId] = useState<string | null>(null);
  const [temaKegiatan, setTemaKegiatan] = useState("");
  const [targetKaderTipe, setTargetKaderTipe] = useState<"semua" | "tertentu">("semua");
  const [targetKaderTerpilih, setTargetKaderTerpilih] = useState<string[]>([]);
  const [tipeGeometriTerpilih, setTipeGeometriTerpilih] = useState<JenisGeometri[]>([]);
  const [bukaTipeData, setBukaTipeData] = useState(false);
  const [tabFormatGeometri, setTabFormatGeometri] = useState<JenisGeometri>("point");
  const [isianPerGeometri, setIsianPerGeometri] = useState<Record<JenisGeometri, FieldSkemaAtribut[]>>({
    point: [],
    line: [],
    polygon: []
  });
  const [galatFormTugas, setGalatFormTugas] = useState<string>("");

  const daftarKaderTerdaftar = useMemo(() => {
    try {
      const semua = muatSemuaAkun();
      const kader = semua.filter((a) => a.peran === "kader" && a.statusPersetujuan !== "ditolak");
      if (kader.length > 0) return kader;
    } catch {
      // fallback jika diuji tanpa akun storage
    }
    return kaderAktifList.map((k) => ({
      idKader: k.idKader,
      nama: k.nama,
      email: `${k.idKader.toLowerCase()}@kader.local`,
      desaWilayah: k.desaWilayah,
      peran: "kader" as const
    }));
  }, [kaderAktifList]);

  // Form Penerbitan & Pengaturan Penandatangan Sertifikat
  // Nomor berikutnya mengikuti jumlah sertifikat yang sudah terbit; nomor yang diketik admin berlaku
  // sampai jumlah itu berubah (mis. setelah menerbitkan), lalu kembali ke nomor otomatis berikutnya
  const [skemaSertifikat, setSkemaSertifikat] = useState<SkemaPengkodeanSertifikat>(
    profilKader.skemaPengkodeanSertifikat || "standar"
  );
  const [nomorDiketik, setNomorDiketik] = useState<{ untukJumlah: number; nilai: string } | null>(null);
  const nomorSertBaru =
    nomorDiketik && nomorDiketik.untukJumlah === sertifikatList.length
      ? nomorDiketik.nilai
      : nomorSertifikatBerikut(sertifikatList, new Date(), { skema: skemaSertifikat });
  const setNomorSertBaru = (nilai: string) => setNomorDiketik({ untukJumlah: sertifikatList.length, nilai });
  const [pesanTerbit, setPesanTerbit] = useState<{ teks: string; ok: boolean } | null>(null);

  const daftarRingkasanKader = useMemo(
    () => ringkasanKader(dataSpasial, sertifikatList, profilKader.modeKombinasiTarget),
    [dataSpasial, sertifikatList, profilKader.modeKombinasiTarget]
  );
  const daftarKaderBerhakBelumTerbit = useMemo(
    () => daftarRingkasanKader.filter((k) => k.capaian.berhakSertifikat && !k.sudahTerbit),
    [daftarRingkasanKader]
  );

  const handleTerbitkanSemuaOtomatis = () => {
    if (daftarKaderBerhakBelumTerbit.length === 0) return;
    const hasilBatch = siapkanSemuaSertifikatOtomatis(daftarKaderBerhakBelumTerbit, sertifikatList, {
      namaOrganisasi: profilKader.namaOrganisasi,
      ditandatanganiOleh: penandatangan,
      jabatanPenandatangan,
      penandatanganList: daftarPenandatangan,
      skemaPengkodean: skemaSertifikat
    });

    if (hasilBatch.berhasil.length > 0) {
      if (onTerbitkanBanyakSertifikat) {
        onTerbitkanBanyakSertifikat(hasilBatch.berhasil);
      } else {
        hasilBatch.berhasil.forEach((s) => onTerbitkanSertifikat(s));
      }
      setPesanTerbit({
        teks: `✓ Berhasil menerbitkan ${hasilBatch.berhasil.length} sertifikat otomatis dengan nomor berbeda untuk setiap kader.`,
        ok: true
      });
    } else if (hasilBatch.gagal.length > 0) {
      setPesanTerbit({
        teks: `⚠️ Gagal menerbitkan sertifikat: ${hasilBatch.gagal[0].alasan}`,
        ok: false
      });
    }
  };
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
    setTemaKegiatan("");
    setTargetKaderTipe("semua");
    setTargetKaderTerpilih([]);
    setTipeGeometriTerpilih([]);
    setBukaTipeData(false);
    setTabFormatGeometri("point");
    setIsianPerGeometri({ point: [], line: [], polygon: [] });
    setGalatFormTugas("");
  };

  const mulaiEditTugas = (t: TugasPemetaan) => {
    setTugasDieditId(t.id);
    setTemaKegiatan(t.judul);
    if (!t.targetKader || t.targetKader.length === 0 || t.targetKader.includes("*")) {
      setTargetKaderTipe("semua");
      setTargetKaderTerpilih([]);
    } else {
      setTargetKaderTipe("tertentu");
      setTargetKaderTerpilih([...t.targetKader]);
    }
    const tipeDiizinkan = t.tipeGeometriDiizinkan && t.tipeGeometriDiizinkan.length > 0 ? [...t.tipeGeometriDiizinkan] : [];
    const skema = t.skemaGeometri;
    const fPoint = skema?.point?.length ? skema.point.map((f) => ({ ...f })) : (t.fields ?? []).map((f) => ({ ...f }));
    const fLine = skema?.line?.length ? skema.line.map((f) => ({ ...f })) : (t.fields ?? []).map((f) => ({ ...f }));
    const fPoly = skema?.polygon?.length ? skema.polygon.map((f) => ({ ...f })) : (t.fields ?? []).map((f) => ({ ...f }));
    const adaFormatKhusus = fPoint.length > 0 || fLine.length > 0 || fPoly.length > 0;
    const tipeFinal: JenisGeometri[] =
      tipeDiizinkan.length > 0
        ? tipeDiizinkan
        : adaFormatKhusus
          ? (["point", "line", "polygon"] as JenisGeometri[]).filter((g) =>
              g === "point" ? fPoint.length > 0 : g === "line" ? fLine.length > 0 : fPoly.length > 0
            )
          : [];
    setTipeGeometriTerpilih(tipeFinal);
    setBukaTipeData(tipeFinal.length > 0);
    setTabFormatGeometri(tipeFinal[0] ?? "point");
    setIsianPerGeometri({
      point: tipeFinal.includes("point") ? fPoint : [],
      line: tipeFinal.includes("line") ? fLine : [],
      polygon: tipeFinal.includes("polygon") ? fPoly : []
    });
    setGalatFormTugas("");
  };

  const toggleTipeGeometri = (jenis: JenisGeometri) => {
    setTipeGeometriTerpilih((prev) => {
      const urutan: JenisGeometri[] = ["point", "line", "polygon"];
      const baru = prev.includes(jenis) ? prev.filter((x) => x !== jenis) : urutan.filter((x) => prev.includes(x) || x === jenis);
      if (baru.length > 0 && !baru.includes(tabFormatGeometri)) {
        setTabFormatGeometri(baru[0]);
      } else if (!prev.includes(jenis)) {
        setTabFormatGeometri(jenis);
      }
      return baru;
    });
  };

  const daftarIsianAktif = isianPerGeometri[tabFormatGeometri] ?? [];

  const tambahFieldIsian = () => {
    setIsianPerGeometri((prev) => ({
      ...prev,
      [tabFormatGeometri]: [
        ...(prev[tabFormatGeometri] ?? []),
        buatFieldSkemaBaru({
          nama: "",
          tipe: "teks",
          wajib: true,
          tabel: `Data ${tabFormatGeometri === "point" ? "Point" : tabFormatGeometri === "line" ? "Line" : "Polygon"}`
        })
      ]
    }));
  };

  const perbaruiFieldIsian = (id: string, patch: Partial<FieldSkemaAtribut>) => {
    setIsianPerGeometri((prev) => ({
      ...prev,
      [tabFormatGeometri]: (prev[tabFormatGeometri] ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f))
    }));
  };

  const hapusFieldIsian = (id: string) => {
    setIsianPerGeometri((prev) => ({
      ...prev,
      [tabFormatGeometri]: (prev[tabFormatGeometri] ?? []).filter((f) => f.id !== id)
    }));
  };

  const geserFieldIsian = (idx: number, arah: -1 | 1) => {
    setIsianPerGeometri((prev) => {
      const daftar = [...(prev[tabFormatGeometri] ?? [])];
      const target = idx + arah;
      if (target < 0 || target >= daftar.length) return prev;
      const [dipindah] = daftar.splice(idx, 1);
      daftar.splice(target, 0, dipindah);
      return { ...prev, [tabFormatGeometri]: daftar };
    });
  };

  const togglePilihKader = (idKader: string) => {
    setTargetKaderTerpilih((prev) =>
      prev.includes(idKader) ? prev.filter((x) => x !== idKader) : [...prev, idKader]
    );
  };

  const handleBagikanTugas = (e: React.FormEvent) => {
    e.preventDefault();
    setGalatFormTugas("");
    const tema = sanitasiTeksInput(temaKegiatan);
    if (!tema) {
      setGalatFormTugas("Tema kegiatan wajib diisi.");
      return;
    }
    if (targetKaderTipe === "tertentu" && targetKaderTerpilih.length === 0) {
      setGalatFormTugas("Pilih minimal satu kader penerima jika opsi 'Pilih Kader Tertentu' aktif.");
      return;
    }

    const labelGeo: Record<JenisGeometri, string> = { point: "Point", line: "Line", polygon: "Polygon" };
    const modeDefault = tipeGeometriTerpilih.length === 0;
    const tipeDipakai: JenisGeometri[] = modeDefault ? ["point", "line", "polygon"] : tipeGeometriTerpilih;

    if (!modeDefault) {
      for (const g of tipeDipakai) {
        const list = isianPerGeometri[g] ?? [];
        for (let i = 0; i < list.length; i++) {
          if (!list[i].nama.trim()) {
            setTabFormatGeometri(g);
            setGalatFormTugas(`Nama data isian #${i + 1} pada format ${labelGeo[g]} belum diisi.`);
            return;
          }
        }
      }
    }

    const fPoint = !modeDefault && tipeDipakai.includes("point") ? isianPerGeometri.point.map((f) => ({ ...f, tabel: "Data Point" })) : [];
    const fLine = !modeDefault && tipeDipakai.includes("line") ? isianPerGeometri.line.map((f) => ({ ...f, tabel: "Data Line" })) : [];
    const fPoly = !modeDefault && tipeDipakai.includes("polygon") ? isianPerGeometri.polygon.map((f) => ({ ...f, tabel: "Data Polygon" })) : [];
    const totalIsian = fPoint.length + fLine.length + fPoly.length;

    const skemaGeom: SkemaAtributGeometri = {
      point: fPoint,
      line: fLine,
      polygon: fPoly,
      daftarTabel: {
        point: fPoint.length > 0 ? ["Data Point"] : [],
        line: fLine.length > 0 ? ["Data Line"] : [],
        polygon: fPoly.length > 0 ? ["Data Polygon"] : []
      }
    };

    const ringkasTipe = modeDefault
      ? "Default (Point, Line, Polygon)"
      : tipeDipakai.map((g) => labelGeo[g]).join(", ");

    const payload: TugasPemetaan = {
      id: tugasDieditId ?? buatId("TSK"),
      judul: tema,
      deskripsi:
        totalIsian > 0
          ? `Format tugas "${tema}" (${ringkasTipe}) dengan ${totalIsian} isian data.`
          : `Tugas "${tema}" (${ringkasTipe}) menggunakan format bawaan default.`,
      targetWilayah: "Seluruh Wilayah",
      jenisTargetGeometri: tipeDipakai[0] ?? "point",
      tipeGeometriDiizinkan: modeDefault ? undefined : [...tipeDipakai],
      targetKuantitas: totalIsian > 0 ? `${totalIsian} isian data` : "Format default",
      batasWaktu: "-",
      koordinatAcuan: { lat: 2.8575, lng: 117.3775 },
      status: tugasDieditId ? (tugasList.find((x) => x.id === tugasDieditId)?.status ?? "aktif") : "aktif",
      dibuatOleh: sesiAdmin?.nama || "Admin GIS",
      targetKader: targetKaderTipe === "semua" ? ["*"] : targetKaderTerpilih,
      fields: totalIsian > 0 ? [...fPoint, ...fLine, ...fPoly] : undefined,
      skemaGeometri: skemaGeom
    };

    if (tugasDieditId && onUbahTugas) {
      onUbahTugas(payload);
    } else {
      onTambahTugas(payload);
    }
    resetFormTugas();
  };

  const handleSimpanEditData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDiedit) return;
    const atributBersih = sanitasiAtributKustom(itemDiedit.atributKustom);
    onUbahDataSpasial({
      ...itemDiedit,
      judul: sanitasiTeksInput(itemDiedit.judul) || itemDiedit.judul,
      deskripsi: sanitasiTeksInput(itemDiedit.deskripsi),
      lapisanNama: sanitasiTeksInput(itemDiedit.lapisanNama) || "Lapisan 1",
      atributKustom: Object.keys(atributBersih).length > 0 ? atributBersih : undefined
    });
    setItemDiedit(null);
  };

  const opsiLapisanAdmin = useMemo(() => {
    const daftar: { id: string; nama: string; tugas?: TugasPemetaan }[] = [];
    const terlihat = new Set<string>();
    for (const t of tugasList) {
      const id = `LAP-TGS-${t.id}`;
      if (!terlihat.has(id)) {
        terlihat.add(id);
        daftar.push({ id, nama: t.judul, tugas: t });
      }
    }
    for (const d of dataSpasial) {
      const nama = (d.lapisanNama || d.tematik || "").trim();
      const id = d.lapisanId || (nama ? `NAMA:${nama}` : "");
      if (id && nama && !terlihat.has(id) && !daftar.some((x) => x.nama.toLowerCase() === nama.toLowerCase())) {
        terlihat.add(id);
        daftar.push({ id, nama });
      }
    }
    return daftar;
  }, [tugasList, dataSpasial]);

  const lapisanAdminTerpilih = useMemo(
    () => opsiLapisanAdmin.find((o) => o.id === filterLapisanAdmin) ?? null,
    [opsiLapisanAdmin, filterLapisanAdmin]
  );

  const dataSpasialTersaringAdmin = useMemo(() => {
    if (filterLapisanAdmin === "semua" || !lapisanAdminTerpilih) return dataSpasial;
    return dataSpasial.filter((d) => {
      if (lapisanAdminTerpilih.tugas) {
        return d.tugasId === lapisanAdminTerpilih.tugas.id || d.lapisanId === lapisanAdminTerpilih.id;
      }
      return (
        d.lapisanId === lapisanAdminTerpilih.id ||
        (d.lapisanNama || d.tematik || "").trim().toLowerCase() === lapisanAdminTerpilih.nama.toLowerCase()
      );
    });
  }, [dataSpasial, filterLapisanAdmin, lapisanAdminTerpilih]);

  const kolomTugasAdminTabel = useMemo(() => {
    if (filterLapisanAdmin === "semua") return [];
    const kolom: string[] = [];
    const ada = new Set<string>();
    const tambah = (k: string) => {
      const bersih = k.trim();
      if (bersih && !ada.has(bersih)) {
        ada.add(bersih);
        kolom.push(bersih);
      }
    };
    const skema = lapisanAdminTerpilih?.tugas?.skemaGeometri;
    if (skema) {
      for (const f of [...(skema.point ?? []), ...(skema.line ?? []), ...(skema.polygon ?? [])]) {
        tambah(f.nama);
      }
    }
    for (const d of dataSpasialTersaringAdmin) {
      if (d.atributKustom) {
        for (const k of Object.keys(d.atributKustom)) tambah(k);
      }
    }
    return kolom;
  }, [filterLapisanAdmin, lapisanAdminTerpilih, dataSpasialTersaringAdmin]);

  const unduhEksporAdmin = (namaBerkas: string, isi: string | Uint8Array, mimeType: string) => {
    const muatan: BlobPart = typeof isi === "string" ? isi : new Uint8Array(isi);
    const blob = new Blob([muatan], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkas;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <span className="text-xs text-muted">Tarik ke bawah untuk menyegarkan</span>
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
              <Archive size={14} aria-hidden="true" />
              <span>Pencadangan 90 Hari ({pencadanganList.length})</span>
            </button>
          </div>

          {tampilanData === "aktif" && (
            <>
              <CatatanPerangkat style={{ marginBottom: 10 }}>
                Menghapus data di sini akan memindahkannya ke folder Pencadangan 90 Hari (baik di perangkat maupun di folder
                Pencadangan_90_Hari Google Drive) dan mengeluarkannya dari perhitungan level.
              </CatatanPerangkat>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10
                }}
              >
                <select
                  aria-label="Filter lapisan kolam data admin"
                  className="form-input"
                  style={{ width: "auto", minWidth: 185, padding: "5px 10px", fontSize: "0.82rem" }}
                  value={filterLapisanAdmin}
                  onChange={(e) => setFilterLapisanAdmin(e.target.value)}
                >
                  <option value="semua">Semua Lapisan ({dataSpasial.length})</option>
                  {opsiLapisanAdmin.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
                </select>
                {dataSpasialTersaringAdmin.length > 0 && (
                  <div className="export-buttons">
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => {
                        const nama = (lapisanAdminTerpilih?.nama || "Database_Admin_WebGIS").replace(/\s+/g, "_");
                        unduhEksporAdmin(`${nama}.geojson`, eksporKeGeoJSON(dataSpasialTersaringAdmin), "application/geo+json");
                      }}
                    >
                      <Download size={13} /> GeoJSON WebGIS
                    </button>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => {
                        const nama = (lapisanAdminTerpilih?.nama || "Database_Admin_WebGIS").replace(/\s+/g, "_");
                        unduhEksporAdmin(
                          `${nama}.csv`,
                          eksporKeCSV(dataSpasialTersaringAdmin, { sertakanAtributTugas: kolomTugasAdminTabel.length > 0 }),
                          "text/csv;charset=utf-8"
                        );
                      }}
                    >
                      <Download size={13} /> CSV
                    </button>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => {
                        const nama = (lapisanAdminTerpilih?.nama || "Database_Admin_WebGIS").replace(/\s+/g, "_");
                        const zip = buatArsipZip(eksporPaketShapefile(dataSpasialTersaringAdmin, nama));
                        unduhEksporAdmin(`${nama}_shp.zip`, zip, "application/zip");
                      }}
                    >
                      <Download size={13} /> SHP
                    </button>
                  </div>
                )}
              </div>

              {dataSpasialTersaringAdmin.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table data-table-admin-spasial">
                    <thead>
                      <tr>
                        <th>Kader</th>
                        <th>Objek</th>
                        {kolomTugasAdminTabel.map((kol) => (
                          <th key={kol}>{kol}</th>
                        ))}
                        <th>Status</th>
                        <th>Kualitas</th>
                        <th>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataSpasialTersaringAdmin.map((d) => (
                        <tr key={d.id}>
                          <td className="col-admin-kader">
                            <strong>{d.namaKader}</strong>
                            <div className="text-xs text-muted">{d.id}</div>
                          </td>
                          <td className="col-admin-objek">
                            <span className="badge-kategori">{d.lapisanNama || d.jenisGeometri.toUpperCase()}</span>{" "}
                            {adalahDataImpor(d) && <span className="badge-kategori">IMPOR</span>}{" "}
                            {adalahDataSimulasi(d) && <span className="badge-kategori">SIMULASI</span>} <strong>{d.judul}</strong>
                            {kolomTugasAdminTabel.length === 0 && d.atributKustom && Object.keys(d.atributKustom).length > 0 && (
                              <div className="text-xs text-muted" style={{ marginTop: 3 }}>
                                {Object.entries(d.atributKustom)
                                  .map(([k, v]) => `${k}: ${String(v).startsWith("data:image/") ? "[Foto]" : v}`)
                                  .join(" · ")}
                              </div>
                            )}
                          </td>
                          {kolomTugasAdminTabel.map((kol) => {
                            const v = d.atributKustom?.[kol];
                            return (
                              <td key={kol} className="text-xs">
                                {v ? (String(v).startsWith("data:image/") ? "[Foto]" : v) : "-"}
                              </td>
                            );
                          })}
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
                                title="Verifikasi data valid"
                              >
                                <Check size={13} /> Verifikasi
                              </button>
                              <button
                                type="button"
                                className="btn-outline-sm"
                                title="Minta revisi data kepada kader"
                                onClick={() => mintaRevisiData(d)}
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
              <Check size={18} /> Verifikasi
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
                    <option value="terverifikasi">Terverifikasi</option>
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

              {(() => {
                const tugasCocok = itemDiedit.tugasId ? tugasList.find((t) => t.id === itemDiedit.tugasId) : undefined;
                const kunciSkema = (tugasCocok?.skemaGeometri?.[itemDiedit.jenisGeometri] ?? []).map((f) => f.nama);
                const kunciAda = Object.keys(itemDiedit.atributKustom ?? {});
                const semuaKunci = Array.from(new Set([...kunciSkema, ...kunciAda])).filter(
                  (k) => !String(itemDiedit.atributKustom?.[k] ?? "").startsWith("data:image/")
                );
                if (semuaKunci.length === 0) return null;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <strong style={{ fontSize: "0.84rem", color: "#0B6E4F" }}>Isian Format Tugas (Kolam Data)</strong>
                    {semuaKunci.map((kunci) => (
                      <div key={kunci}>
                        <label>{kunci}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={itemDiedit.atributKustom?.[kunci] ?? ""}
                          onChange={(e) =>
                            setItemDiedit({
                              ...itemDiedit,
                              atributKustom: {
                                ...(itemDiedit.atributKustom ?? {}),
                                [kunci]: e.target.value
                              }
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
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

      {/* 4. TAB C: TUGAS SURVEI DAN FORMAT DATA LAPISAN */}
      {subTabAdmin === "tugas_survei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <CatatanPerangkat>
            Tugas tersimpan di perangkat ini dan otomatis dibagikan ke menu Lapisan kader yang dipilih. Format isian data yang Anda
            tetapkan akan langsung muncul saat kader melakukan pemetaan di peta interaktif.
          </CatatanPerangkat>

          <form onSubmit={handleBagikanTugas} className="section-card tugas-builder-card">
            <div className="section-header-flex" style={{ marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
                  <Layers size={20} color="#0B6E4F" aria-hidden="true" />
                  {tugasDieditId ? "Ubah Tugas dan Format Data Lapisan" : "Buat Tugas dan Format Data Baru"}
                </h3>
                <p className="text-xs text-muted" style={{ margin: "4px 0 0" }}>
                  Tentukan tema kegiatan, pilih kader yang berhak mengisi, dan susun format data yang harus diambil di lapangan.
                </p>
              </div>
              {tugasDieditId && (
                <button type="button" className="btn-outline-sm" onClick={resetFormTugas}>
                  Batal Ubah
                </button>
              )}
            </div>

            {/* 1. TEMA KEGIATAN (WAJIB) */}
            <div className="tugas-section-box">
              <label className="tugas-section-label" htmlFor="input-tema-kegiatan">
                <span className="tugas-label-text">Tema Kegiatan</span>
                <span className="tugas-badge-wajib">Wajib</span>
              </label>
              <input
                id="input-tema-kegiatan"
                type="text"
                className="form-input tugas-input-tema"
                placeholder="Contoh: Inventarisasi Sumber Mata Air / Pemetaan Pohon Pakan / Batas Adat"
                value={temaKegiatan}
                onChange={(e) => setTemaKegiatan(e.target.value)}
                required
              />
            </div>

            {/* 2. PILIHAN SASARAN PENERIMA TUGAS (SHARE KE USER MANA) */}
            <div className="tugas-section-box" style={{ marginTop: 12 }}>
              <div className="tugas-target-pills" role="radiogroup" aria-label="Sasaran Penerima Tugas">
                <button
                  type="button"
                  role="radio"
                  aria-checked={targetKaderTipe === "semua"}
                  className={`tugas-target-pill ${targetKaderTipe === "semua" ? "aktif" : ""}`}
                  onClick={() => {
                    setTargetKaderTipe("semua");
                    setTargetKaderTerpilih([]);
                  }}
                >
                  <Users size={16} />
                  <span>Semua Kader (Publik)</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={targetKaderTipe === "tertentu"}
                  className={`tugas-target-pill ${targetKaderTipe === "tertentu" ? "aktif" : ""}`}
                  onClick={() => setTargetKaderTipe("tertentu")}
                >
                  <UserCog size={16} />
                  <span>Pilih Kader Tertentu</span>
                  {targetKaderTerpilih.length > 0 && (
                    <span className="tugas-counter-pill">{targetKaderTerpilih.length}</span>
                  )}
                </button>
              </div>

              {targetKaderTipe === "tertentu" && (
                <div className="tugas-kader-picker-wrap">
                  <p className="text-xs text-muted" style={{ margin: "0 0 8px" }}>
                    Centang kader yang berhak melihat dan mengisi tugas ini di menu Lapisan:
                  </p>
                  {daftarKaderTerdaftar.length > 0 ? (
                    <div className="tugas-kader-grid">
                      {daftarKaderTerdaftar.map((k) => {
                        const dipilih = targetKaderTerpilih.includes(k.idKader);
                        return (
                          <button
                            type="button"
                            key={k.idKader}
                            className={`tugas-kader-chip ${dipilih ? "terpilih" : ""}`}
                            onClick={() => togglePilihKader(k.idKader)}
                            aria-pressed={dipilih}
                          >
                            <span className="tugas-kader-check-icon">{dipilih ? "✓" : "+"}</span>
                            <div className="tugas-kader-chip-info">
                              <strong>{k.nama}</strong>
                              <small>{k.desaWilayah || k.email || k.idKader}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="tugas-empty-notice">
                      Belum ada akun kader terdaftar. Tugas dapat disimpan sementara untuk Semua Kader.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. PILIHAN TIPE DATA YANG DIAMBIL DAN PENGATURAN FORMAT PER TIPE (ATAU DEFAULT) */}
            <div className="tugas-section-box" style={{ marginTop: 14 }}>
              <button
                type="button"
                id="tombol-tipe-data"
                className="tugas-tipe-data-accordion-btn"
                onClick={() => setBukaTipeData((prev) => !prev)}
                aria-expanded={bukaTipeData}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.98rem", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#0f172a" }}>
                    <ClipboardList size={17} color="#0B6E4F" aria-hidden="true" />
                    Tipe Data
                    {tipeGeometriTerpilih.length > 0 && (
                      <span className="tugas-counter-pill" style={{ marginLeft: 4 }}>
                        {tipeGeometriTerpilih.map((g) => (g === "point" ? "Point" : g === "line" ? "Line" : "Polygon")).join(", ")}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-muted" style={{ margin: "3px 0 0" }}>
                    {bukaTipeData
                      ? "Pilih tipe data yang ingin dibuat formulirnya (Point, Line, atau Polygon). Klik dua kali pada tipe data untuk membatalkan."
                      : tipeGeometriTerpilih.length > 0
                        ? `${tipeGeometriTerpilih.length} tipe data dipilih (${tipeGeometriTerpilih.map((g) => (g === "point" ? "Point" : g === "line" ? "Line" : "Polygon")).join(", ")}). Klik untuk mengubah pilihan formulir.`
                        : "Klik untuk memilih tipe data apa saja yang mau dibuat formulirnya."}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span className="text-xs text-muted" style={{ fontWeight: 600 }}>
                    {bukaTipeData ? "Tutup" : "Pilih"}
                  </span>
                  <ChevronDown
                    size={18}
                    color="#64748b"
                    style={{
                      transform: bukaTipeData ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease"
                    }}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {bukaTipeData && (
                <div className="tugas-tipe-data-konten" style={{ marginTop: 12 }}>
                  <div className="tugas-geom-picker" role="group" aria-label="Pilih tipe data yang diambil">
                    {(
                      [
                        { id: "point" as const, label: "Point", ket: "Titik lokasi", Ikon: MapPin, kelasWarna: "point" },
                        { id: "line" as const, label: "Line", ket: "Jalur / garis", Ikon: Route, kelasWarna: "line" },
                        { id: "polygon" as const, label: "Polygon", ket: "Area / bidang", Ikon: Hexagon, kelasWarna: "polygon" }
                      ] as const
                    ).map(({ id, label, ket, Ikon, kelasWarna }) => {
                      const aktif = tipeGeometriTerpilih.includes(id);
                      const jml = isianPerGeometri[id]?.length ?? 0;
                      return (
                        <button
                          key={id}
                          type="button"
                          id={`tugas-geom-chip-${id}`}
                          className={`tugas-geom-chip tugas-geom-chip-${kelasWarna} ${aktif ? `aktif terpilih-${kelasWarna}` : ""}`}
                          aria-pressed={aktif}
                          onClick={() => toggleTipeGeometri(id)}
                          title={aktif ? `Klik lagi untuk membatalkan ${label} (kembali seperti semula)` : `Pilih ${label} untuk membuat formulir khusus`}
                        >
                          <span className="tugas-geom-chip-icon" aria-hidden="true">
                            <Ikon size={16} />
                          </span>
                          <span className="tugas-geom-chip-text">
                            <strong>{label}</strong>
                            <small>{aktif ? (jml > 0 ? `${jml} isian` : "Format default") : ket}</small>
                          </span>
                          <span className="tugas-geom-chip-check" aria-hidden="true">
                            {aktif ? "✓" : "+"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {tipeGeometriTerpilih.length === 0 ? (
                    <div className="tugas-empty-builder" style={{ marginTop: 10 }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#0f172a" }}>Mode Default Aktif</p>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>
                        Kader dapat mengisi data <b>Point, Line, dan Polygon</b> dengan format standar bawaan. Pilih salah satu atau beberapa tipe data di atas bila ingin mengatur format isian khusus.
                      </p>
                    </div>
                  ) : (
                    <div className="tugas-format-per-tipe" style={{ marginTop: 12 }}>
                      <p className="text-xs text-muted" style={{ margin: "0 0 10px" }}>
                        Atur kolom isian khusus untuk data{" "}
                        <b>{tabFormatGeometri === "point" ? "Point" : tabFormatGeometri === "line" ? "Line" : "Polygon"}</b>. Jika dibiarkan kosong, tipe ini memakai format default.
                      </p>

                  {daftarIsianAktif.length === 0 ? (
                    <div className="tugas-empty-builder">
                      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
                        Format {tabFormatGeometri === "point" ? "Point" : tabFormatGeometri === "line" ? "Line" : "Polygon"} masih Default
                      </p>
                      <p className="text-xs text-muted" style={{ margin: 0 }}>
                        Klik tombol <b>"+ Tambah Data Isian"</b> di bawah untuk menambahkan kolom data kustom (contoh: Nama Pemilik, Kondisi, Biaya, Tanggal).
                      </p>
                    </div>
                  ) : (
                    <div className="tugas-builder-field-list">
                      {daftarIsianAktif.map((f, idx) => (
                        <div key={f.id} className="tugas-builder-field-card">
                          {/* Baris atas: nomor urut, toggle Wajib/Opsional, dan tombol aksi sejajar rapi */}
                          <div className="tugas-field-card-head">
                            <div className="tugas-field-head-left">
                              <span className="tugas-field-index">#{idx + 1}</span>
                              <button
                                type="button"
                                className={`tugas-wajib-toggle ${f.wajib ? "wajib" : ""}`}
                                onClick={() => perbaruiFieldIsian(f.id, { wajib: !f.wajib })}
                                title="Klik untuk mengubah status isian wajib atau opsional"
                              >
                                {f.wajib ? "✓ Wajib" : "Opsional"}
                              </button>
                            </div>
                            <div className="tugas-field-actions">
                              <button
                                type="button"
                                className="btn-outline-sm tugas-field-act-btn"
                                disabled={idx === 0}
                                aria-label={`Naikkan ${f.nama || `Isian #${idx + 1}`}`}
                                onClick={() => geserFieldIsian(idx, -1)}
                                title="Pindah ke atas"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-outline-sm tugas-field-act-btn"
                                disabled={idx === daftarIsianAktif.length - 1}
                                aria-label={`Turunkan ${f.nama || `Isian #${idx + 1}`}`}
                                onClick={() => geserFieldIsian(idx, 1)}
                                title="Pindah ke bawah"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-danger-sm tugas-field-act-btn"
                                aria-label={`Hapus ${f.nama || `Isian #${idx + 1}`}`}
                                onClick={() => hapusFieldIsian(f.id)}
                                title="Hapus isian ini"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Baris nama data lebar penuh agar tidak terpotong di HP maupun PC */}
                          <div className="tugas-field-name-wrap">
                            <label className="tugas-field-sublabel" htmlFor={`field-nama-${f.id}`}>
                              Nama Data
                            </label>
                            <input
                              id={`field-nama-${f.id}`}
                              type="text"
                              className="form-input tugas-field-name-input"
                              placeholder="Contoh: Nama Pemilik, Kondisi Fisik, Estimasi Biaya..."
                              value={f.nama}
                              onChange={(e) => perbaruiFieldIsian(f.id, { nama: e.target.value })}
                              required
                            />
                          </div>

                          {/* Baris kontrol tipe nilai dan pengaturan tambahan dalam grid 2 kolom rapi */}
                          <div className="tugas-field-card-controls">
                            <div className="tugas-control-item">
                              <label className="tugas-field-sublabel" htmlFor={`field-tipe-${f.id}`}>
                                Tipe Nilai Data
                              </label>
                              <select
                                id={`field-tipe-${f.id}`}
                                className="form-input"
                                value={f.tipe}
                                onChange={(e) => perbaruiFieldIsian(f.id, { tipe: e.target.value as TipeFieldSkema })}
                              >
                                <option value="teks">Teks Singkat</option>
                                <option value="angka">Angka / Bilangan</option>
                                <option value="nominal">Nominal Rupiah (Rp)</option>
                                <option value="tanggal">Tanggal (Date Picker)</option>
                                <option value="pilihan">Pilihan (Dropdown)</option>
                                <option value="catatan">Catatan Panjang</option>
                                <option value="foto">Foto Bukti</option>
                              </select>
                            </div>

                            {f.tipe === "pilihan" && (
                              <div className="tugas-control-item">
                                <label className="tugas-field-sublabel">Daftar Pilihan (pisahkan koma)</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Misal: Baik, Rusak Ringan, Rusak Berat"
                                  value={(f.opsi ?? []).join(", ")}
                                  onChange={(e) =>
                                    perbaruiFieldIsian(f.id, {
                                      opsi: e.target.value
                                        .split(",")
                                        .map((x) => x.trim())
                                        .filter(Boolean)
                                    })
                                  }
                                />
                              </div>
                            )}

                            {f.tipe === "nominal" && (
                              <div className="tugas-control-item">
                                <label className="tugas-field-sublabel">Format Mata Uang</label>
                                <div className="tugas-nominal-hint">
                                  Otomatis memformat angka dengan awalan <b>Rp</b> dan pemisah ribuan.
                                </div>
                              </div>
                            )}

                            {f.tipe !== "pilihan" && f.tipe !== "nominal" && f.tipe !== "foto" && (
                              <div className="tugas-control-item">
                                <label className="tugas-field-sublabel">Petunjuk / Placeholder (Opsional)</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Petunjuk untuk kader saat mengisi..."
                                  value={f.placeholder || ""}
                                  onChange={(e) => perbaruiFieldIsian(f.id, { placeholder: e.target.value })}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="tugas-btn-tambah-field"
                    onClick={tambahFieldIsian}
                  >
                    <Plus size={16} /> Tambah Data Isian{" "}
                    {tabFormatGeometri === "point" ? "Point" : tabFormatGeometri === "line" ? "Line" : "Polygon"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

            {galatFormTugas && (
              <p role="alert" className="field-error" style={{ marginTop: 10 }}>
                {galatFormTugas}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary tugas-btn-submit-share"
              style={{ marginTop: 16 }}
            >
              <Share2 size={17} />
              <span>{tugasDieditId ? "Simpan Perubahan Tugas" : "Bagikan Tugas ke Menu Lapisan"}</span>
            </button>
          </form>

          {/* DAFTAR TUGAS YANG TELAH DIBAGIKAN */}
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList size={17} color="#0B6E4F" aria-hidden="true" />
              Daftar Tugas dan Lapisan Dibagikan ({tugasList.length})
            </h3>
            {tugasList.length > 0 ? (
              <div className="admin-tugas-grid">
                {tugasList.map((t) => {
                  const skema = t.skemaGeometri;
                  const tipeList =
                    t.tipeGeometriDiizinkan && t.tipeGeometriDiizinkan.length > 0
                      ? t.tipeGeometriDiizinkan
                      : (["point", "line", "polygon"] as JenisGeometri[]);
                  const labelTipe = (g: JenisGeometri) => (g === "point" ? "Point" : g === "line" ? "Line" : "Polygon");
                  const teksTipe =
                    t.tipeGeometriDiizinkan && t.tipeGeometriDiizinkan.length > 0
                      ? tipeList.map(labelTipe).join(", ")
                      : "Default (Point, Line, Polygon)";
                  const daftarF =
                    skema && (skema.point.length > 0 || skema.line.length > 0 || skema.polygon.length > 0)
                      ? [...skema.point, ...skema.line, ...skema.polygon]
                      : (t.fields ?? []);
                  const untukSemua = !t.targetKader || t.targetKader.length === 0 || t.targetKader.includes("*");
                  return (
                    <div key={t.id} className="admin-tugas-card">
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                          <span className={`tugas-target-chip ${untukSemua ? "semua" : "tertentu"}`}>
                            {untukSemua ? "Semua Kader" : `${t.targetKader?.length} Kader Tertentu`}
                          </span>
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
                        <h4 style={{ margin: "8px 0 4px", fontSize: "0.98rem", color: "#0f172a" }}>{t.judul}</h4>
                        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                          Tipe data di Lapisan: <b>{teksTipe}</b>
                        </div>

                        {daftarF.length > 0 ? (
                          <div className="tugas-fields-preview-wrap">
                            <span className="text-xs text-muted" style={{ display: "block", marginBottom: 4 }}>
                              Format Data ({daftarF.length} isian):
                            </span>
                            <div className="tugas-fields-chips">
                              {daftarF.map((df) => (
                                <span key={df.id} className="tugas-field-pill-tag">
                                  {df.wajib ? "*" : ""}{df.nama} ({LABEL_TIPE_FIELD[df.tipe] || df.tipe})
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="tugas-fields-preview-wrap">
                            <span className="text-xs text-muted">Menggunakan format isian standar (Default).</span>
                          </div>
                        )}
                      </div>

                      <div className="admin-tugas-actions" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => mulaiEditTugas(t)}
                          title="Ubah tugas atau format data isian"
                        >
                          <Edit3 size={13} /> Ubah
                        </button>
                        {t.status !== "selesai" && onVerifikasiTugas && (
                          <button
                            type="button"
                            className="btn-primary-sm"
                            onClick={() => onVerifikasiTugas(t.id)}
                            title="Verifikasi penyelesaian tugas (+60 poin level)"
                          >
                            <Check size={13} /> Verifikasi
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => {
                            const objekTugas = dataSpasial.find(
                              (d) =>
                                (d.tugasId === t.id || d.lapisanId === `LAP-TGS-${t.id}`) &&
                                d.koordinat[0]
                            );
                            const koord = objekTugas?.koordinat[0] ?? t.koordinatAcuan;
                            onFokusKePeta(koord.lat, koord.lng, t.judul, t.id);
                          }}
                          title="Lihat acuan di peta"
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
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                Belum ada tugas yang dibagikan. Buat tugas baru pada formulir di atas.
              </div>
            )}
          </div>
        </div>
      )}



      {/* 5. TAB D: SERTIFIKAT */}
      {subTabAdmin === "sertifikat" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="section-card">
            <h3 style={{ margin: "0 0 10px", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <LogoSertifikatResmiSvg size={20} variant="zamrud" /> Sertifikat
            </h3>

            <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <div>
                <label htmlFor="pilih-skema-pengkodean" style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 4, display: "block" }}>
                  Skema Automasi Pengkodean Sertifikat
                </label>
                <select
                  id="pilih-skema-pengkodean"
                  className="form-input"
                  value={skemaSertifikat}
                  onChange={(e) => setSkemaSertifikat(e.target.value as SkemaPengkodeanSertifikat)}
                >
                  <option value="standar">Standar Berurutan (0001/SKPP-GIS/WILAYAH/XI/2026)</option>
                  <option value="wilayah">Berbasis Wilayah Desa (0001/SKPP-GIS/[DESA]/XI/2026)</option>
                  <option value="kader">Kode Unik Kader (0001/SKPP-GIS/[ID-KADER]/XI/2026)</option>
                  <option value="warsi">Resmi KKI Warsi (SKPP-WARSI/2026/XI/0001-[KADER])</option>
                </select>
              </div>

              <div>
                <label htmlFor="input-nomor-berikutnya" style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 4, display: "block" }}>
                  Pratinjau nomor berikutnya (atau kustom)
                </label>
                <input
                  id="input-nomor-berikutnya"
                  type="text"
                  className="form-input"
                  value={nomorSertBaru}
                  onChange={(e) => setNomorSertBaru(e.target.value)}
                  placeholder="Nomor sertifikat otomatis..."
                />
              </div>
            </div>

            <div className="admin-signers-grid">
              {daftarPenandatangan.map((sig, idx) => (
                <div key={sig.id} className="admin-signer-box">
                  <div className="admin-signer-box-head">
                    <span className="admin-signer-rank-pill">#{idx + 1}</span>
                    <strong className="admin-signer-heading" title={sig.jabatan || `Posisi ${idx + 1}`}>
                      {sig.jabatan || `Penandatangan ${idx + 1}`}
                    </strong>
                  </div>

                  <div className="admin-signer-fields">
                    <div className="admin-signer-field">
                      <label htmlFor={`admin-sig-nama-${sig.id}`}>Nama Penandatangan</label>
                      <input
                        id={`admin-sig-nama-${sig.id}`}
                        type="text"
                        className="form-input"
                        placeholder="Nama lengkap beserta gelar"
                        value={sig.nama}
                        onChange={(e) => ubahSatuPenandatangan(idx, { nama: e.target.value })}
                      />
                    </div>
                    <div className="admin-signer-field">
                      <label htmlFor={`admin-sig-jabatan-${sig.id}`}>Jabatan Penandatangan</label>
                      <input
                        id={`admin-sig-jabatan-${sig.id}`}
                        type="text"
                        className="form-input"
                        placeholder="Jabatan pejabat penandatangan"
                        value={sig.jabatan}
                        onChange={(e) => ubahSatuPenandatangan(idx, { jabatan: e.target.value })}
                      />
                    </div>
                    <div className="admin-signer-field">
                      <label htmlFor={`admin-sig-instansi-${sig.id}`}>Instansi</label>
                      <input
                        id={`admin-sig-instansi-${sig.id}`}
                        type="text"
                        className="form-input"
                        placeholder="Instansi penandatangan"
                        value={sig.instansi}
                        onChange={(e) => ubahSatuPenandatangan(idx, { instansi: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-signer-ttd-row">
                    <div className="admin-signer-ttd-preview">
                      {sig.tandaTanganBase64 ? (
                        <img src={sig.tandaTanganBase64} alt={`Tanda tangan ${sig.nama || `Posisi ${idx + 1}`}`} />
                      ) : (
                        <span className="admin-signer-ttd-empty">Belum ada TTD</span>
                      )}
                    </div>
                    <div className="admin-signer-ttd-actions">
                      <label className="btn-outline-sm admin-ttd-btn" title="Unggah gambar tanda tangan">
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
                          className="btn-danger-sm admin-ttd-btn"
                          onClick={() => {
                            const baru = daftarPenandatangan.map((item, i) =>
                              i === idx ? { ...item, tandaTanganBase64: undefined } : item
                            );
                            setDaftarPenandatangan(baru);
                            onUbahPenandatanganSertifikat?.(baru[0]?.nama || "Adi Junedi", baru[0]?.jabatan || "Direktur", baru);
                          }}
                          title="Hapus gambar tanda tangan"
                        >
                          Hapus
                        </button>
                      )}
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "16px 0 8px" }}>
              <h4 style={{ margin: 0, fontSize: "0.92rem" }}>Kader dan capaian terverifikasi</h4>
              {daftarKaderBerhakBelumTerbit.length > 0 && (
                <button
                  type="button"
                  id="btn-terbitkan-semua-otomatis"
                  className="btn-primary-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={handleTerbitkanSemuaOtomatis}
                  title="Terbitkan sertifikat dengan nomor otomatis berbeda untuk seluruh kader yang memenuhi syarat"
                >
                  <LogoSertifikatResmiSvg size={14} variant="zamrud" /> Terbitkan Semua Otomatis ({daftarKaderBerhakBelumTerbit.length})
                </button>
              )}
            </div>
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
            {daftarRingkasanKader.length === 0 ? (
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
                      <th>Nomor Sertifikat (Otomatis)</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daftarRingkasanKader.map((k) => {
                      const sertSudah = sertifikatList.find((s) => s.idKader === k.idKader);
                      const nomorOtomatisPreview = sertSudah
                        ? sertSudah.nomorSertifikat
                        : buatNomorSertifikatOtomatis(k, sertifikatList, undefined, { skema: skemaSertifikat });
                      return (
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
                            <code
                              style={{
                                fontSize: "0.78rem",
                                background: k.sudahTerbit ? "#ecfdf5" : "#f1f5f9",
                                color: k.sudahTerbit ? "#065f46" : "#334155",
                                padding: "3px 6px",
                                borderRadius: 4,
                                border: `1px solid ${k.sudahTerbit ? "#a7f3d0" : "#cbd5e1"}`
                              }}
                            >
                              {nomorOtomatisPreview}
                            </code>
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
                                    ? `Terbitkan sertifikat otomatis nomor ${nomorOtomatisPreview}`
                                    : "Belum memenuhi syarat sertifikasi (50 titik, 5 km jalur, dan 5 Ha poligon terverifikasi)"
                              }
                              onClick={() => {
                                const nomorPakai =
                                  nomorDiketik && nomorDiketik.untukJumlah === sertifikatList.length
                                    ? nomorDiketik.nilai
                                    : nomorOtomatisPreview;
                                const hasil = siapkanSertifikat(k, nomorPakai, sertifikatList, {
                                  namaOrganisasi: profilKader.namaOrganisasi,
                                  ditandatanganiOleh: penandatangan,
                                  jabatanPenandatangan,
                                  penandatanganList: daftarPenandatangan,
                                  fotoKaderBase64: k.idKader === profilKader.idKader ? profilKader.fotoKaderBase64 : undefined,
                                  skemaPengkodean: skemaSertifikat
                                });
                                setPesanTerbit({ teks: hasil.pesan, ok: hasil.ok });
                                if (hasil.ok && hasil.sertifikat) onTerbitkanSertifikat(hasil.sertifikat);
                              }}
                            >
                              <LogoSertifikatResmiSvg size={14} variant="zamrud" /> Terbitkan
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* MODAL CATATAN REVISI DATA (menggantikan window.prompt yang diblokir di iframe/PWA) */}
      {revisiDataTarget && (
        <div
          className="konfirmasi-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-revisi-judul"
          onClick={() => {
            setRevisiDataTarget(null);
            setCatatanRevisiInput("");
          }}
        >
          <form className="konfirmasi-modal-card" onSubmit={kirimCatatanRevisi} onClick={(e) => e.stopPropagation()}>
            <div className="konfirmasi-modal-head">
              <h4 id="modal-revisi-judul" className="konfirmasi-modal-title">
                Catatan Revisi Data
              </h4>
            </div>
            <p className="konfirmasi-modal-desc">
              Tuliskan catatan perbaikan untuk objek <strong>{revisiDataTarget.judul}</strong> agar dapat diperbaiki kader:
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Contoh: Koordinat belum tepat atau foto kurang jelas..."
              value={catatanRevisiInput}
              onChange={(e) => setCatatanRevisiInput(e.target.value)}
              autoFocus
              required
            />
            <div className="konfirmasi-modal-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setRevisiDataTarget(null);
                  setCatatanRevisiInput("");
                }}
              >
                Batalkan
              </button>
              <button type="submit" className="btn-primary">
                Kirim Revisi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
