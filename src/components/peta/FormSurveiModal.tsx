import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Leaf,
  Droplets,
  Flag,
  Flame,
  Layers,
  Lock,
  Trees,
  Landmark,
  House,
  MoreHorizontal,
  Trash2
} from "lucide-react";
import {
  BuktiFotoLapangan,
  DataSpasialItem,
  FieldSkemaAtribut,
  HasilRataRataGps,
  JenisGeometri,
  KategoriSurvei,
  KoordinatTitik,
  LapisanSpasial,
  MemoSuara,
  ProfilKader
} from "../../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm, sanitasiTeksInput } from "../../lib/geoUtils";
import { buatId } from "../../lib/id";
import { capWilayah } from "../../lib/auth";
import { kompresFoto, perkiraBytesDataUrl, SISI_MAKS_FOTO, TARGET_BYTE_FOTO } from "../../lib/foto";
import { bacaDraftSurvei, DraftSurvei, DRAFT_KOSONG, simpanDraftSurvei } from "../../lib/draftSurvei";
import { ambilRataRataGps } from "../../lib/posisiPerangkat";
import { hitungSkorKualitasData } from "../../lib/kualitasData";
import { susunAtributPolygonPrmAid, susunAtributLinePrmAid, susunAtributPointPrmAid } from "../../lib/atributPrmAid";
import { validasiIsianSkema } from "../../lib/skemaTugas";
import { KolamTematik, selesaikanKolamTematik } from "../../lib/tematik";
import { BottomSheet } from "./BottomSheet";
import { PerekamMemoSuara } from "./PerekamMemoSuara";
import { KartuLokasiTitik } from "./KartuLokasiTitik";
import { bacaSistemKoordinat, formatKoordinat, simpanSistemKoordinat, SistemKoordinat } from "../../lib/sistemKoordinat";

const PILIHAN_CORAK = [
  { id: "Pin Merah", label: "Pin Merah", warna: "#ef4444" },
  { id: "Jingga jejak", label: "Jingga jejak", warna: "#f26101" },
  { id: "Hijau zamrud", label: "Hijau zamrud", warna: "#0d7344" },
  { id: "Biru langit", label: "Biru langit", warna: "#0284c7" },
  { id: "Kuning emas", label: "Kuning emas", warna: "#eab308" },
  { id: "Ungu peta", label: "Ungu peta", warna: "#7c3aed" }
] as const;

export const KATEGORI_VISUAL: { kategori: KategoriSurvei; judul: string; contoh: string; Ikon: typeof Leaf }[] = [
  { kategori: "Tanda Batas", judul: "Batas", contoh: "Patok, sempadan alam", Ikon: Flag },
  { kategori: "Wilayah Adat / Lahan", judul: "Lahan", contoh: "Hutan, kebun, ulayat", Ikon: Trees },
  { kategori: "Biodiversitas", judul: "Biodiversitas", contoh: "Satwa, flora, fauna, tumbuhan", Ikon: Leaf },
  { kategori: "Mata Air", judul: "Air", contoh: "Mata air, aliran", Ikon: Droplets },
  { kategori: "Ancaman / Temuan", judul: "Ancaman", contoh: "Kebakaran, perambahan", Ikon: Flame },
  { kategori: "Sarana Desa", judul: "Sarana", contoh: "Jalan, bangunan desa", Ikon: House },
  { kategori: "Situs Budaya", judul: "Budaya", contoh: "Sejarah, toponimi", Ikon: Landmark },
  { kategori: "Lainnya", judul: "Lainnya", contoh: "Objek dan data lainnya", Ikon: MoreHorizontal }
];

/** Draf per akun di IndexedDB. Tidak memuat akun, sandi atau token. */
export function useFormSurvei(idKader: string) {
  const [isian, setIsian] = useState(() => bacaDraftSurvei(idKader));
  const [galatFoto, setGalatFoto] = useState<string | null>(null),
    [memprosesFoto, setMemprosesFoto] = useState(false);
  useEffect(() => {
    simpanDraftSurvei(idKader, isian);
  }, [idKader, isian]);
  const ubah = <K extends keyof DraftSurvei>(k: K, v: DraftSurvei[K]) => setIsian((s) => ({ ...s, [k]: v }));
  const simpanGeometri = useCallback((jenis: JenisGeometri | null, titik: KoordinatTitik[]) => {
    setIsian((s) => {
      const rekaman = jenis ? { jenis, titik } : undefined;
      if (JSON.stringify(s.rekaman) === JSON.stringify(rekaman)) return s;
      return { ...s, rekaman };
    });
  }, []);
  const handlePilihFoto = (e: React.ChangeEvent<HTMLInputElement>, bukti?: BuktiFotoLapangan) => {
    const input = e.target,
      file = input.files?.[0];
    if (!file) return;
    setGalatFoto(null);
    setMemprosesFoto(true);
    kompresFoto(file, SISI_MAKS_FOTO, TARGET_BYTE_FOTO, bukti)
      .then((foto) => {
        simpanDraftSurvei(idKader, { ...bacaDraftSurvei(idKader), foto, buktiFoto: bukti });
        setIsian((s) => ({ ...s, foto, buktiFoto: bukti }));
      })
      .catch((err: unknown) => setGalatFoto(err instanceof Error ? err.message : "Foto tidak dapat diproses."))
      .finally(() => {
        setMemprosesFoto(false);
        input.value = "";
      });
  };
  const susunItem = (
    profil: ProfilKader,
    jenis: JenisGeometri,
    titik: KoordinatTitik[],
    kompas?: number,
    konteksKolam?: { lapisanList?: LapisanSpasial[]; dataSpasial?: DataSpasialItem[]; lapisanAktif?: LapisanSpasial | null }
  ): DataSpasialItem => {
    const waktu = new Date().toISOString();
    const lapisanTerpakai = konteksKolam?.lapisanAktif ?? null;
    const hasilTematik = selesaikanKolamTematik({
      namaTematik: isian.tematik,
      kategori: isian.kategori,
      lapisanList: konteksKolam?.lapisanList ?? [],
      dataSpasial: konteksKolam?.dataSpasial ?? []
    });
    const skemaFields = lapisanTerpakai?.skemaGeometri?.[jenis] ?? [];
    const atributKustomMap: Record<string, string> = {};
    if (skemaFields.length > 0 && isian.atributKustom) {
      for (const f of skemaFields) {
        const val = isian.atributKustom[f.id];
        if (val !== undefined && val !== "") {
          atributKustomMap[f.nama] = val;
        }
      }
    }
    const elevasiAngka = Number(String(isian.elevasi ?? "").replace(",", "."));
    const elevasiFinal = Number.isFinite(elevasiAngka) && String(isian.elevasi ?? "").trim() !== ""
      ? elevasiAngka
      : titik[0]?.elevasi;

    const item: DataSpasialItem = {
      id: buatId("SPS"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      ...capWilayah(profil.idKader),
      jenisGeometri: jenis,
      kategori: hasilTematik.kategori,
      tematik: hasilTematik.tematik,
      lapisanId: lapisanTerpakai?.id || undefined,
      lapisanNama: lapisanTerpakai?.nama || undefined,
      tugasId: lapisanTerpakai?.tugasId || undefined,
      atributKustom: Object.keys(atributKustomMap).length > 0 ? atributKustomMap : undefined,
      elevasi: elevasiFinal,
      judul: isian.judul.trim(),
      namaLokal: isian.namaLokal.trim() || undefined,
      namaIlmiah: isian.namaIlmiah.trim() || undefined,
      jumlahIndividu: Number(isian.jumlahIndividu) || 1,
      manfaatMasyarakat: isian.manfaat.trim() || undefined,
      kondisiAncaman: isian.kondisi.trim() || undefined,
      deskripsi: isian.deskripsi.trim(),
      koordinat: titik,
      panjangKm: jenis === "line" ? hitungPanjangGarisKm(titik) : 0,
      luasHa: jenis === "polygon" ? hitungLuasPoligonHa(titik) : 0,
      kompasDerajat: kompas,
      fotoBase64: isian.foto || undefined,
      buktiFoto: isian.buktiFoto,
      namaFileFoto: isian.foto ? `${profil.idKader}_${Date.now()}.jpg` : undefined,
      gpsAveraging: jenis === "point" ? isian.averaging : undefined,
      memoSuara: isian.memo.length ? isian.memo : undefined,
      kesepakatanBatas: isian.saksi.trim()
        ? {
            saksi: isian.saksi
              .split(",")
              .map((n) => sanitasiTeksInput(n.trim()))
              .filter(Boolean),
            catatan: isian.deskripsi
          }
        : undefined,
      statusSinkron: "lokal",
      createdAt: waktu,
      updatedAt: waktu,
      riwayatPembaruan: []
    };
    item.kualitasData = hitungSkorKualitasData(item);

    // Tetapkan atribut terstruktur PRM-AID (Polygon: label, luas_ha, keterangan, url, tepi, warna | Line: label, panjang_m, keterangan, url, warna | Point: label, kategori, keterangan, url, simbol)
    if (jenis === "polygon") {
      const atribut = susunAtributPolygonPrmAid({
        jenisGeometri: "polygon",
        judul: isian.judul,
        kategori: isian.kategori,
        deskripsi: isian.deskripsi,
        luasHa: item.luasHa,
        url: isian.url,
        tepi: isian.tepi,
        warna: isian.warna
      });
      item.tepi = atribut.tepi;
      item.warna = atribut.warna;
      item.url = atribut.url || undefined;
    } else if (jenis === "line") {
      const atribut = susunAtributLinePrmAid({
        jenisGeometri: "line",
        judul: isian.judul,
        kategori: isian.kategori,
        deskripsi: isian.deskripsi,
        panjangKm: item.panjangKm,
        url: isian.url,
        warna: isian.warna
      });
      item.warna = atribut.warna;
      item.url = atribut.url || undefined;
    } else {
      const atribut = susunAtributPointPrmAid({
        jenisGeometri: "point",
        judul: isian.judul,
        kategori: isian.kategori,
        deskripsi: isian.deskripsi,
        url: isian.url,
        simbol: isian.simbol
      });
      item.simbol = atribut.simbol;
      item.url = atribut.url || undefined;
    }

    return item;
  };
  return {
    isian,
    ubah,
    simpanGeometri,
    rekaman: isian.rekaman,
    galatFoto,
    memprosesFoto,
    handlePilihFoto,
    susunItem,
    setKategoriInput: (v: KategoriSurvei) => ubah("kategori", v),
    tambahMemo: (m: MemoSuara) => {
      // Finalisasi audio dapat selesai setelah tab peta ditutup. Persistensi tidak bergantung pada render React.
      const d = bacaDraftSurvei(idKader);
      if (!d.memo.some((v) => v.id === m.id)) simpanDraftSurvei(idKader, { ...d, memo: [...d.memo, m] });
      setIsian((s) => ({ ...s, memo: s.memo.some((v) => v.id === m.id) ? s.memo : [...s.memo, m] }));
    },
    kosongkan: () => {
      setIsian({ ...DRAFT_KOSONG });
      setGalatFoto(null);
    }
  };
}

interface FormSurveiModalProps {
  form: ReturnType<typeof useFormSurvei>;
  modeRekam: JenisGeometri | null;
  panjangDraftKm: number;
  luasDraftHa: number;
  profil: ProfilKader;
  koordinat: KoordinatTitik[];
  galatGeometri?: string;
  onHasilAveraging: (hasil: HasilRataRataGps) => void;
  onSimpan: (e: React.FormEvent) => void;
  onTutup: () => void;
  sistemKoordinat?: SistemKoordinat;
  onGantiSistemKoordinat?: (s: SistemKoordinat) => void;
  onUbahKoordinat?: (titik: KoordinatTitik) => void;
  aksiAwal?: "averaging" | "foto" | null;
  kolamTematikList?: KolamTematik[];
  lapisanList?: LapisanSpasial[];
  lapisanAktif?: LapisanSpasial | null;
  onPilihLapisanAktif?: (id: string | null) => void;
  onKonversiKeArea?: () => void;
  onNavigasiTitik?: () => void;
}
export function FormSurveiModal({
  form,
  modeRekam,
  panjangDraftKm,
  luasDraftHa,
  profil,
  koordinat,
  galatGeometri,
  onHasilAveraging,
  onSimpan,
  onTutup,
  sistemKoordinat,
  onGantiSistemKoordinat,
  onUbahKoordinat,
  aksiAwal = null,
  kolamTematikList = [],
  lapisanList = [],
  lapisanAktif = null,
  onPilihLapisanAktif,
  onKonversiKeArea,
  onNavigasiTitik
}: FormSurveiModalProps) {
  const [sistemAktif, setSistemAktif] = useState<SistemKoordinat>(() => sistemKoordinat || bacaSistemKoordinat());
  useEffect(() => {
    if (sistemKoordinat) setSistemAktif(sistemKoordinat);
  }, [sistemKoordinat]);
  const [memoSibuk, setMemoSibuk] = useState(false),
    [gpsSibuk, setGpsSibuk] = useState(false),
    [sampel, setSampel] = useState(0),
    [galatGps, setGalatGps] = useState(""),
    [galatSkema, setGalatSkema] = useState(""),
    [sorotFoto, setSorotFoto] = useState(false),
    [modeTematikBaru, setModeTematikBaru] = useState(false),
    [bukaEditKoord, setBukaEditKoord] = useState(false),
    [bukaEditLapisan, setBukaEditLapisan] = useState(false),
    [bukaFotoPanel, setBukaFotoPanel] = useState(() => Boolean(aksiAwal === "foto" || form.isian.foto)),
    [bukaDeskripsiPanel, setBukaDeskripsiPanel] = useState(() => Boolean(form.isian.deskripsi)),
    [bukaPilihCorak, setBukaPilihCorak] = useState(false),
    [bukaEditElevasi, setBukaEditElevasi] = useState(false),
    [bukaGrafikTrek, setBukaGrafikTrek] = useState(false),
    [bukaAtributEkstra, setBukaAtributEkstra] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fotoBoxRef = useRef<HTMLDivElement | null>(null);
  const namaInputRef = useRef<HTMLInputElement | null>(null);
  const sudahAksiAwalRef = useRef<"averaging" | "foto" | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const { isian, ubah } = form;

  const skemaAktifFields: FieldSkemaAtribut[] = useMemo(() => {
    if (!modeRekam || !lapisanAktif?.skemaGeometri) return [];
    return lapisanAktif.skemaGeometri[modeRekam] ?? [];
  }, [lapisanAktif, modeRekam]);

  const nilaiKustom = useMemo(() => isian.atributKustom ?? {}, [isian.atributKustom]);
  const ubahNilaiKustom = (fieldId: string, nilai: string) => {
    setGalatSkema("");
    ubah("atributKustom", { ...nilaiKustom, [fieldId]: nilai });
  };

  const nilaiTematikSekarang = (isian.tematik || "").trim();
  const kolamCocokSelect = useMemo(
    () => kolamTematikList.find((k) => k.nama.toLowerCase() === nilaiTematikSekarang.toLowerCase()),
    [kolamTematikList, nilaiTematikSekarang]
  );
  const opsiSelectTematik = !nilaiTematikSekarang ? (modeTematikBaru ? "__BARU__" : "") : kolamCocokSelect ? kolamCocokSelect.nama : "__BARU__";
  const resolusiPratinjau = useMemo(
    () =>
      selesaikanKolamTematik({
        namaTematik: nilaiTematikSekarang,
        kategori: isian.kategori,
        lapisanList: kolamTematikList.map((k, idx) => ({
          id: k.lapisanId || `POOL-${idx}`,
          nama: k.nama,
          jumlahPeta: k.jumlahObjek,
          kategoriDefault: k.kategori,
          adalahTematik: true,
          createdAt: ""
        })),
        dataSpasial: []
      }),
    [nilaiTematikSekarang, isian.kategori, kolamTematikList]
  );

  const rataGps = async () => {
    abort.current?.abort();
    const kontrol = new AbortController();
    abort.current = kontrol;
    setGpsSibuk(true);
    setGalatGps("");
    setSampel(0);
    try {
      const h = await ambilRataRataGps({ signal: kontrol.signal, progres: setSampel });
      if (!kontrol.signal.aborted) {
        ubah("averaging", h);
        onHasilAveraging(h);
      }
    } catch (e) {
      if (!kontrol.signal.aborted) setGalatGps(e instanceof Error ? e.message : "GPS tidak tersedia.");
    } finally {
      if (!kontrol.signal.aborted) setGpsSibuk(false);
    }
  };
  useEffect(() => {
    if (!aksiAwal) {
      sudahAksiAwalRef.current = null;
      return;
    }
    if (sudahAksiAwalRef.current === aksiAwal) return;
    sudahAksiAwalRef.current = aksiAwal;
    if (aksiAwal === "averaging") {
      void rataGps();
    } else if (aksiAwal === "foto") {
      setBukaFotoPanel(true);
      setSorotFoto(true);
      const tScroll = window.setTimeout(() => {
        fotoBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      const tSorot = window.setTimeout(() => setSorotFoto(false), 3000);
      return () => {
        window.clearTimeout(tScroll);
        window.clearTimeout(tSorot);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aksiAwal]);
  const field = (k: "judul" | "namaLokal" | "namaIlmiah" | "jumlahIndividu" | "manfaat" | "kondisi", label: string, required = false) => (
    <label>
      {label}
      <input
        className="form-input"
        type={k === "jumlahIndividu" ? "number" : "text"}
        min={k === "jumlahIndividu" ? 1 : undefined}
        required={required}
        maxLength={500}
        placeholder={k === "judul" ? "Masukkan nama objek" : undefined}
        value={isian[k]}
        onChange={(e) => ubah(k, e.target.value)}
      />
    </label>
  );
  const titikUtama = koordinat[0];
  const teksKoordSaatIni = titikUtama
    ? formatKoordinat(titikUtama.lat, titikUtama.lng, sistemAktif).salin
    : "-";
  const elevasiTeks =
    isian.elevasi?.trim()
      ? `${isian.elevasi.replace(".", ",")} m`
      : titikUtama?.elevasi !== undefined
        ? `${titikUtama.elevasi.toFixed(2).replace(".", ",")} m`
        : "---";
  const corakAktif = PILIHAN_CORAK.find((c) => c.id === isian.simbol || c.warna === isian.warna) ??
    (modeRekam === "line" ? PILIHAN_CORAK[1] : modeRekam === "polygon" ? PILIHAN_CORAK[2] : PILIHAN_CORAK[0]);

  const sekarangObj = new Date();
  const dibuatTeks = `${String(sekarangObj.getDate()).padStart(2, "0")}/${String(sekarangObj.getMonth() + 1).padStart(2, "0")}/${String(
    sekarangObj.getFullYear()
  ).slice(-2)} pada ${String(sekarangObj.getHours()).padStart(2, "0")}.${String(sekarangObj.getMinutes()).padStart(2, "0")}`;

  const bagikanDraft = () => {
    const nama = isian.judul.trim() || (modeRekam === "point" ? "Tanda tempat 1" : modeRekam === "line" ? "Trek" : "Area");
    const teks = `${nama} — ${teksKoordSaatIni}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator.share({ title: nama, text: teks }).catch(() => undefined);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(teks).catch(() => undefined);
    }
  };

  const renderFieldSkema = (f: FieldSkemaAtribut) => {
    const val = nilaiKustom[f.id] ?? "";
    const labelReq = f.wajib ? " *" : "";
    if (f.tipe === "pilihan") {
      return (
        <div key={f.id} className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>
              {f.nama}
              {labelReq}
            </strong>
            <span className="avz-skema-tag">{f.wajib ? "Wajib" : "Pilihan"}</span>
          </div>
          <select
            className="form-input"
            required={Boolean(f.wajib)}
            value={val}
            onChange={(e) => ubahNilaiKustom(f.id, e.target.value)}
          >
            <option value="">Pilih {f.nama}...</option>
            {(f.opsi ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (f.tipe === "catatan") {
      return (
        <div key={f.id} className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>
              {f.nama}
              {labelReq}
            </strong>
            <span className="avz-skema-tag">{f.wajib ? "Wajib" : "Catatan"}</span>
          </div>
          <textarea
            rows={3}
            className="form-input"
            required={Boolean(f.wajib)}
            placeholder={f.placeholder || `Isi ${f.nama.toLowerCase()}...`}
            value={val}
            onChange={(e) => ubahNilaiKustom(f.id, e.target.value)}
          />
        </div>
      );
    }
    if (f.tipe === "foto") {
      return (
        <div key={f.id} className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>
              {f.nama}
              {labelReq}
            </strong>
            <span className="avz-skema-tag">{f.wajib ? "Wajib" : "Foto"}</span>
          </div>
          <label className="avz-tombol-garis" style={{ cursor: "pointer", justifyContent: "center" }}>
            <Camera size={16} /> {val ? "Ganti Foto" : "Ambil / Pilih Foto"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void kompresFoto(file, SISI_MAKS_FOTO, TARGET_BYTE_FOTO).then((url) => ubahNilaiKustom(f.id, url));
                e.target.value = "";
              }}
            />
          </label>
          {val && <img src={val} alt={f.nama} className="avz-isian-foto" style={{ maxHeight: 140, objectFit: "cover" }} />}
        </div>
      );
    }
    return (
      <div key={f.id} className="avz-isian-baris">
        <div className="avz-isian-kepala">
          <strong>
            {f.nama}
            {labelReq}
          </strong>
          <span className="avz-skema-tag">{f.wajib ? "Wajib" : f.tipe}</span>
        </div>
        <input
          type={f.tipe === "angka" ? "number" : f.tipe === "tanggal" ? "date" : "text"}
          step={f.tipe === "angka" ? "any" : undefined}
          className="form-input"
          required={Boolean(f.wajib)}
          placeholder={f.placeholder || `Masukkan ${f.nama.toLowerCase()}...`}
          value={val}
          onChange={(e) => ubahNilaiKustom(f.id, e.target.value)}
        />
      </div>
    );
  };

  return (
    <BottomSheet
      judul={modeRekam === "point" ? "Pin dijatuhkan" : modeRekam === "line" ? "Trek" : "Area"}
      onTutup={onTutup}
      awal={55}
      className="field-survey-sheet"
      halaman
      aksiKanan={
        <button
          type="submit"
          form="form-survei-lapangan"
          className="avenza-head-btn avz-centang"
          aria-label="Simpan"
          disabled={gpsSibuk || memoSibuk || form.memprosesFoto || Boolean(galatGeometri)}
        >
          <Check size={26} />
        </button>
      }
    >
      <form
        id="form-survei-lapangan"
        className="modal-form field-survey-form avz-isian"
        onSubmit={(e) => {
          if (gpsSibuk || memoSibuk || form.memprosesFoto) {
            e.preventDefault();
            return;
          }
          if (skemaAktifFields.length > 0) {
            const gagal = validasiIsianSkema(skemaAktifFields, nilaiKustom);
            if (gagal) {
              e.preventDefault();
              setGalatSkema(gagal);
              return;
            }
          }
          onSimpan(e);
        }}
      >
        {lapisanAktif && skemaAktifFields.length > 0 && (
          <div className="avz-skema-banner">
            <div>
              <strong>{`Lapisan Tugas Admin: ${lapisanAktif.nama}`}</strong>
              <small>{`Format isian mengikuti aturan tugas ${modeRekam?.toUpperCase()}.`}</small>
            </div>
            {onPilihLapisanAktif && (
              <button
                type="button"
                className="avz-aksi-hijau"
                onClick={() => onPilihLapisanAktif(null)}
              >
                Default
              </button>
            )}
          </div>
        )}

        {galatGeometri && (
          <p role="alert" className="field-error">
            {galatGeometri}
          </p>
        )}
        {galatSkema && (
          <p role="alert" className="field-error">
            {galatSkema}
          </p>
        )}

        {/* 1. NAMA */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Nama</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => namaInputRef.current?.focus()}
            >
              Edit
            </button>
          </div>
          <input
            ref={namaInputRef}
            className="form-input"
            type="text"
            required
            maxLength={500}
            placeholder="Masukkan nama objek"
            value={isian.judul}
            onChange={(e) => ubah("judul", e.target.value)}
          />
        </div>

        {/* 2. KOORDINAT (Point) / JARAK (Line) / LUAS (Polygon) */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{modeRekam === "point" ? "Koordinat" : modeRekam === "line" ? "Jarak" : "Luas"}</strong>
            {modeRekam === "point" && (
              <button
                type="button"
                className="avz-aksi-hijau"
                onClick={() => setBukaEditKoord((v) => !v)}
              >
                {bukaEditKoord ? "Tutup" : "Edit"}
              </button>
            )}
          </div>
          {modeRekam === "point" ? (
            <span className="tabular-nums">{teksKoordSaatIni}</span>
          ) : (
            <span className="avz-isian-nilai-panah tabular-nums">
              {modeRekam === "line"
                ? `${panjangDraftKm.toFixed(2).replace(".", ",")} km`
                : `${luasDraftHa.toFixed(2).replace(".", ",")} Ha`}
              <ChevronRight size={20} aria-hidden="true" />
            </span>
          )}
          {modeRekam === "point" && bukaEditKoord && (
            <div style={{ marginTop: 8 }}>
              <KartuLokasiTitik
                titik={koordinat[0]}
                sistem={sistemAktif}
                onGantiSistem={(s) => {
                  setSistemAktif(s);
                  simpanSistemKoordinat(s);
                  onGantiSistemKoordinat?.(s);
                }}
                onUbahKoordinat={onUbahKoordinat}
                gpsSibuk={gpsSibuk}
                sampel={sampel}
                onUkurGps={() => void rataGps()}
                onBatalUkur={() => {
                  abort.current?.abort();
                  setGpsSibuk(false);
                }}
                infoAveraging={
                  isian.averaging
                    ? `${isian.averaging.jumlahSampel} sampel · sebaran ${isian.averaging.sebaranMeter.toFixed(1)} m · akurasi ±${isian.averaging.titik.akurasi?.toFixed(1)} m`
                    : undefined
                }
                galatGps={galatGps}
              />
            </div>
          )}
        </div>

        {/* 3. LAPISAN SAAT INI + EDIT LAPISAN */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Lapisan saat ini</strong>
          </div>
          <span className="avz-isian-nilai-panah">
            {lapisanAktif?.nama || isian.tematik || "Lapisan 1"} <ChevronRight size={20} aria-hidden="true" />
          </span>
          <button
            type="button"
            className="avz-tombol-garis"
            onClick={() => setBukaEditLapisan((v) => !v)}
          >
            Edit Lapisan
          </button>

          {/* Pilihan Kategori ringkas 1-ketuk (kompatibel penuh dengan tes & filter database) */}
          <div className="avz-kategori-strip" role="group" aria-label="Pilihan kategori survei">
            {KATEGORI_VISUAL.map(({ kategori, judul, Ikon }) => {
              const aktif = isian.kategori === kategori;
              return (
                <button
                  type="button"
                  key={kategori}
                  className={`form-kategori-chip ${aktif ? "aktif" : ""}`}
                  aria-pressed={aktif}
                  title={kategori}
                  onClick={() => ubah("kategori", kategori)}
                >
                  <Ikon size={14} />
                  <span>{judul}</span>
                </button>
              );
            })}
          </div>

          <div className="form-tematik-box" style={{ marginTop: 8 }}>
            <label>
              <span className="form-tematik-label">
                <Layers size={15} /> Peta Tematik (Kolam Data)
              </span>
              <select
                className="form-input"
                aria-label="Pilih Peta Tematik"
                value={opsiSelectTematik}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setModeTematikBaru(false);
                    ubah("tematik", "");
                  } else if (v === "__BARU__") {
                    setModeTematikBaru(true);
                    if (kolamCocokSelect) ubah("tematik", "");
                  } else {
                    setModeTematikBaru(false);
                    ubah("tematik", v);
                  }
                }}
              >
                <option value="">Kosongkan (Peta Biasa)</option>
                {kolamTematikList.map((k) => {
                  const teksOpsi = `${k.nama} (${k.kategori} · ${k.jumlahObjek})`;
                  return (
                    <option key={k.nama} value={k.nama} title={teksOpsi}>
                      {teksOpsi.length > 36 ? `${teksOpsi.slice(0, 33).trimEnd()}…` : teksOpsi}
                    </option>
                  );
                })}
                <option value="__BARU__">+ Buat Peta Tematik Baru…</option>
              </select>
            </label>

            {opsiSelectTematik === "__BARU__" && (
              <label>
                Nama Peta Tematik Baru
                <input
                  type="text"
                  className="form-input"
                  maxLength={80}
                  placeholder="Misal: Sebaran Meranti, Batas Adat"
                  value={isian.tematik || ""}
                  onChange={(e) => ubah("tematik", e.target.value)}
                />
              </label>
            )}

            {resolusiPratinjau.status === "tematik_tersendiri" && kolamCocokSelect && (
              <div className="form-tematik-info peringatan">
                <span>
                  Kolam <strong>{kolamCocokSelect.nama}</strong> berkategori <strong>{kolamCocokSelect.kategori}</strong>.
                </span>
                <button
                  type="button"
                  className="btn-outline-sm form-tematik-samakan-btn"
                  onClick={() => ubah("kategori", kolamCocokSelect.kategori)}
                >
                  Samakan ke {kolamCocokSelect.kategori}
                </button>
              </div>
            )}
          </div>

          {(isian.kategori === "Tanda Batas" || isian.kategori === "Wilayah Adat / Lahan") && (
            <label style={{ marginTop: 8 }}>
              Saksi Lapangan / Tokoh Desa
              <input
                className="form-input"
                value={isian.saksi}
                maxLength={1000}
                placeholder="Pisahkan beberapa nama dengan koma"
                onChange={(e) => ubah("saksi", e.target.value)}
              />
            </label>
          )}

          {bukaEditLapisan && onPilihLapisanAktif && (
            <div className="form-tematik-box" style={{ marginTop: 8 }}>
              <label>
                Pilih Lapisan Tugas / Standar
                <select
                  className="form-input"
                  value={lapisanAktif?.id ?? ""}
                  onChange={(e) => onPilihLapisanAktif(e.target.value || null)}
                >
                  <option value="">Lapisan 1 (Bawaan Standar)</option>
                  {lapisanList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nama}
                      {l.tugasId ? " (Tugas Admin)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* KOLOM KUSTOM TUGAS ADMIN (AKTIF BILA DIPILIH DARI MENU LAPISAN) */}
        {skemaAktifFields.length > 0 && skemaAktifFields.map((f) => renderFieldSkema(f))}

        {/* 4. FOTO */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Foto</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => setBukaFotoPanel((v) => !v)}
            >
              {isian.foto ? "Ubah" : bukaFotoPanel ? "Tutup" : "Tambah"}
            </button>
          </div>
          {(bukaFotoPanel || isian.foto) && (
            <div ref={fotoBoxRef} className={`form-photo-box ${isian.foto ? "punya-foto" : ""} ${sorotFoto ? "sorot-aksi-foto" : ""}`}>
              <label className="btn-media-simbol" aria-label="Ambil atau pilih foto" title="Ambil atau pilih foto">
                <Camera size={22} />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={form.memprosesFoto}
                  onChange={(e) => {
                    const labelTematik =
                      resolusiPratinjau.status !== "non_tematik"
                        ? resolusiPratinjau.tematik
                        : isian.tematik?.trim() || undefined;
                    form.handlePilihFoto(e, {
                      posisi: koordinat[0] ?? { lat: 0, lng: 0 },
                      idKader: profil.idKader,
                      desa: profil.desaWilayah,
                      diambilPada: new Date().toISOString(),
                      tematik: labelTematik,
                      stampVisual: true
                    });
                  }}
                />
              </label>
              {form.memprosesFoto && (
                <span className="form-media-status" role="status">
                  Memproses foto…
                </span>
              )}
              {isian.foto && (
                <div className="form-foto-preview-card">
                  <img className="survey-photo-preview" src={isian.foto} alt="Bukti foto survei" />
                  <div className="form-foto-preview-foot">
                    <span>{Math.round(perkiraBytesDataUrl(isian.foto) / 1024)} KB</span>
                    <button
                      type="button"
                      className="btn-icon-close"
                      aria-label="Hapus foto"
                      title="Hapus foto"
                      onClick={() => {
                        ubah("foto", "");
                        ubah("buktiFoto", undefined);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
              {form.galatFoto && <p role="alert">{form.galatFoto}</p>}
            </div>
          )}
        </div>

        {/* 5. DESKRIPSI */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Deskripsi</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => setBukaDeskripsiPanel((v) => !v)}
            >
              {isian.deskripsi ? "Edit" : bukaDeskripsiPanel ? "Tutup" : "Tambah"}
            </button>
          </div>
          {isian.deskripsi && !bukaDeskripsiPanel && <span className="avz-isian-kecil">{isian.deskripsi}</span>}
          {bukaDeskripsiPanel && (
            <textarea
              rows={3}
              className="form-input"
              maxLength={10000}
              placeholder="Cerita tempat, kondisi, atau catatan..."
              value={isian.deskripsi}
              onChange={(e) => ubah("deskripsi", e.target.value)}
            />
          )}
        </div>

        {/* 6. CORAK */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Corak</strong>
          </div>
          <button
            type="button"
            className="avz-isian-nilai-panah avz-corak-btn"
            onClick={() => setBukaPilihCorak((v) => !v)}
          >
            <span className="avz-corak-preview">
              <span className="avz-corak-dot" style={{ background: corakAktif.warna }} aria-hidden="true" />
              {corakAktif.label}
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          {bukaPilihCorak && (
            <div className="avz-corak-chips">
              {PILIHAN_CORAK.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`avz-corak-chip ${corakAktif.id === c.id ? "aktif" : ""}`}
                  onClick={() => {
                    ubah("warna", c.warna);
                    ubah("simbol", c.label);
                    setBukaPilihCorak(false);
                  }}
                >
                  <span className="avz-corak-dot" style={{ background: c.warna }} aria-hidden="true" />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 7. ELEVASI / PEROLEHAN ELEVASI TOTAL */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{modeRekam === "point" ? "Elevasi" : "Perolehan elevasi total"}</strong>
            <button type="button" className="avz-aksi-hijau" onClick={() => setBukaEditElevasi((v) => !v)}>
              {bukaEditElevasi ? "Tutup" : "Edit"}
            </button>
          </div>
          <span className="tabular-nums">{elevasiTeks}</span>
          {bukaEditElevasi && (
            <input
              type="number"
              step="any"
              className="form-input"
              placeholder="Elevasi (meter)"
              value={isian.elevasi ?? ""}
              onChange={(e) => ubah("elevasi", e.target.value)}
            />
          )}
          <button
            type="button"
            className="avz-tombol-garis"
            disabled={gpsSibuk}
            onClick={() => void rataGps()}
          >
            {gpsSibuk ? `Mengukur (${sampel} sampel)...` : "Ambil elevasi"}
          </button>
        </div>

        {/* 8. TAMPILKAN GRAFIK & OPERASI (KHUSUS TREK / LINE, SESUAI SS 1) */}
        {modeRekam === "line" && (
          <>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Tampilkan Grafik</strong>
              </div>
              <button
                type="button"
                className="avz-isian-nilai-panah avz-corak-btn"
                onClick={() => setBukaGrafikTrek((v) => !v)}
              >
                <span className="tabular-nums">
                  Dist: {panjangDraftKm.toFixed(2).replace(".", ",")} km | {koordinat.length} titik
                </span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
              {bukaGrafikTrek && (
                <div className="avz-grafik-ringkas">
                  <span>Panjang lintasan: {panjangDraftKm.toFixed(2).replace(".", ",")} km</span>
                  <span>Jumlah simpul: {koordinat.length} titik GPS</span>
                </div>
              )}
            </div>

            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Operasi</strong>
                <span className="avz-lock-pill" title="Konversi trek menjadi poligon area">
                  <Lock size={12} aria-hidden="true" />
                </span>
              </div>
              <button
                type="button"
                className="avz-tombol-garis"
                disabled={!onKonversiKeArea || koordinat.length < 3}
                onClick={onKonversiKeArea}
              >
                Konversikan ke Area
              </button>
            </div>
          </>
        )}

        {/* 9. DIBUAT */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Dibuat</strong>
          </div>
          <span className="tabular-nums">{dibuatTeks}</span>
        </div>

        {/* 10. SKEMA ATRIBUT (DEFAULT AVENZA INFO + ATURAN EKSTRA OPSIONAL) */}
        {skemaAktifFields.length === 0 && (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Skema atribut</strong>
              <button type="button" className="avz-aksi-hijau" onClick={() => setBukaAtributEkstra((v) => !v)}>
                {bukaAtributEkstra ? "Tutup" : "Edit"}
              </button>
            </div>
            <span className="avz-isian-kecil">
              Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
            </span>
            {bukaAtributEkstra && (
              <div className="avz-atribut-ekstra">
                <div className="form-row-2">
                  {field("namaLokal", "Nama Lokal")}
                  {field("namaIlmiah", "Nama Ilmiah")}
                </div>
                <div className="form-row-2">
                  {field("jumlahIndividu", "Jumlah")}
                  {field("manfaat", "Manfaat bagi masyarakat")}
                </div>
                {field("kondisi", "Kondisi saat ini")}
                <label>
                  Tautan atau URL Informasi (Opsional)
                  <input
                    type="url"
                    className="form-input"
                    maxLength={500}
                    placeholder="https://walaya.prm.my.id/… atau tautan berkas"
                    value={isian.url || ""}
                    onChange={(e) => ubah("url", e.target.value)}
                  />
                </label>
                <PerekamMemoSuara
                  memo={isian.memo}
                  onTambah={form.tambahMemo}
                  onHapus={(id) => ubah("memo", isian.memo.filter((m) => m.id !== id))}
                  onSibuk={setMemoSibuk}
                />
              </div>
            )}
          </div>
        )}

        <footer className="modal-footer">
          {onNavigasiTitik && (
            <button type="button" className="btn-outline-sm" onClick={onNavigasiTitik}>
              Navigasi
            </button>
          )}
          <button type="button" className="btn-outline-sm" onClick={bagikanDraft}>
            Bagikan
          </button>
          <button type="submit" className="btn-primary" disabled={gpsSibuk || memoSibuk || form.memprosesFoto || Boolean(galatGeometri)}>
            Simpan Lokasi
          </button>
        </footer>
      </form>
    </BottomSheet>
  );
}
