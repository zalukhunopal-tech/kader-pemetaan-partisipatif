import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Lock,
  MapPin,
  Route,
  Hexagon,
  Table2,
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
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "../../lib/geoUtils";
import { buatId } from "../../lib/id";
import { capWilayah } from "../../lib/auth";
import { kompresFoto, perkiraBytesDataUrl, SISI_MAKS_FOTO, TARGET_BYTE_FOTO } from "../../lib/foto";
import { bacaDraftSurvei, DraftSurvei, DRAFT_KOSONG, simpanDraftSurvei } from "../../lib/draftSurvei";
import { ambilRataRataGps } from "../../lib/posisiPerangkat";
import { hitungSkorKualitasData } from "../../lib/kualitasData";
import { susunAtributPolygonPrmAid, susunAtributLinePrmAid, susunAtributPointPrmAid } from "../../lib/atributPrmAid";
import { ambilAngkaNominal, formatNominalRupiah, kelompokkanFieldPerTabel, LABEL_TIPE_FIELD, validasiIsianSkema } from "../../lib/skemaTugas";
import { BottomSheet } from "./BottomSheet";
import { PerekamMemoSuara } from "./PerekamMemoSuara";
import { KartuLokasiTitik } from "./KartuLokasiTitik";
import { bacaSistemKoordinat, formatKoordinat, simpanSistemKoordinat, SistemKoordinat } from "../../lib/sistemKoordinat";

const PILIHAN_CORAK = [
  { id: "Merah", label: "Merah", warna: "#ef4444" },
  { id: "Jingga", label: "Jingga", warna: "#f26101" },
  { id: "Hijau", label: "Hijau", warna: "#0d7344" },
  { id: "Biru", label: "Biru", warna: "#0284c7" },
  { id: "Kuning", label: "Kuning", warna: "#eab308" },
  { id: "Ungu", label: "Ungu", warna: "#7c3aed" }
] as const;

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
    const skemaFields = lapisanTerpakai?.skemaGeometri?.[jenis] ?? [];
    const atributKustomMap: Record<string, string> = {};
    if (skemaFields.length > 0) {
      const hitungNama = new Map<string, number>();
      for (const f of skemaFields) {
        hitungNama.set(f.nama, (hitungNama.get(f.nama) ?? 0) + 1);
      }
      for (const f of skemaFields) {
        const val = (isian.atributKustom?.[f.id] ?? f.nilaiBawaan ?? "").trim();
        if (val !== "") {
          const kunci = (hitungNama.get(f.nama) ?? 0) > 1 && f.tabel ? `${f.tabel} · ${f.nama}` : f.nama;
          atributKustomMap[kunci] = val;
        }
      }
    }
    const elevasiAngka = Number(String(isian.elevasi ?? "").replace(",", "."));
    const elevasiFinal =
      Number.isFinite(elevasiAngka) && String(isian.elevasi ?? "").trim() !== "" ? elevasiAngka : titik[0]?.elevasi;

    const item: DataSpasialItem = {
      id: buatId("SPS"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      ...capWilayah(profil.idKader),
      jenisGeometri: jenis,
      kategori: isian.kategori || "Lainnya",
      lapisanId: lapisanTerpakai?.id || undefined,
      lapisanNama: lapisanTerpakai?.nama || "Lapisan 1",
      tugasId: lapisanTerpakai?.tugasId || undefined,
      atributKustom: Object.keys(atributKustomMap).length > 0 ? atributKustomMap : undefined,
      elevasi: elevasiFinal,
      judul: isian.judul.trim(),
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
      statusSinkron: "lokal",
      createdAt: waktu,
      updatedAt: waktu,
      riwayatPembaruan: []
    };
    item.kualitasData = hitungSkorKualitasData(item);

    if (jenis === "polygon") {
      const atribut = susunAtributPolygonPrmAid({
        jenisGeometri: "polygon",
        judul: isian.judul,
        kategori: item.kategori,
        deskripsi: isian.deskripsi,
        luasHa: item.luasHa,
        url: isian.url,
        tepi: isian.tepi,
        warna: isian.warna
      });
      item.tepi = atribut.tepi;
      item.warna = isian.warna || atribut.warna;
      item.simbol = isian.simbol || "Hijau";
      item.url = atribut.url || undefined;
    } else if (jenis === "line") {
      const atribut = susunAtributLinePrmAid({
        jenisGeometri: "line",
        judul: isian.judul,
        kategori: item.kategori,
        deskripsi: isian.deskripsi,
        panjangKm: item.panjangKm,
        url: isian.url,
        warna: isian.warna
      });
      item.warna = isian.warna || "#f26101";
      item.simbol = isian.simbol || "Jingga";
      item.url = atribut.url || undefined;
    } else {
      const atribut = susunAtributPointPrmAid({
        jenisGeometri: "point",
        judul: isian.judul,
        kategori: item.kategori,
        deskripsi: isian.deskripsi,
        url: isian.url,
        simbol: isian.simbol
      });
      item.warna = isian.warna || "#ef4444";
      item.simbol = isian.simbol || "Merah";
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
    [bukaEditKoord, setBukaEditKoord] = useState(false),
    [bukaEditLapisan, setBukaEditLapisan] = useState(false),
    [bukaFotoPanel, setBukaFotoPanel] = useState(() => Boolean(aksiAwal === "foto" || form.isian.foto)),
    [bukaDeskripsiPanel, setBukaDeskripsiPanel] = useState(() => Boolean(form.isian.deskripsi)),
    [bukaPilihCorak, setBukaPilihCorak] = useState(false),
    [bukaEditElevasi, setBukaEditElevasi] = useState(false),
    [bukaGrafikTrek, setBukaGrafikTrek] = useState(false),
    [bukaSkemaPanel, setBukaSkemaPanel] = useState(false);
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

  const grupTabelAktif = useMemo(() => {
    if (!modeRekam || !lapisanAktif?.skemaGeometri) return [];
    return kelompokkanFieldPerTabel(lapisanAktif.skemaGeometri, modeRekam).filter((g) => g.fields.length > 0);
  }, [lapisanAktif, modeRekam]);

  const nilaiKustom = useMemo(() => isian.atributKustom ?? {}, [isian.atributKustom]);
  const ubahNilaiKustom = (fieldId: string, nilai: string) => {
    setGalatSkema("");
    ubah("atributKustom", { ...nilaiKustom, [fieldId]: nilai });
  };

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

  const titikUtama = koordinat[0];
  const teksKoordSaatIni = titikUtama ? formatKoordinat(titikUtama.lat, titikUtama.lng, sistemAktif).salin : "-";
  const elevasiTeks = isian.elevasi?.trim()
    ? `${isian.elevasi.replace(".", ",")} m`
    : titikUtama?.elevasi !== undefined
      ? `${titikUtama.elevasi.toFixed(2).replace(".", ",")} m`
      : "---";
  const corakAktif =
    PILIHAN_CORAK.find((c) => c.id === isian.simbol || c.warna === isian.warna) ??
    (modeRekam === "line" ? PILIHAN_CORAK[1] : modeRekam === "polygon" ? PILIHAN_CORAK[2] : PILIHAN_CORAK[0]);

  const sekarangObj = new Date();
  const dibuatTeks = `${String(sekarangObj.getDate()).padStart(2, "0")}/${String(sekarangObj.getMonth() + 1).padStart(2, "0")}/${String(
    sekarangObj.getFullYear()
  ).slice(-2)} pada ${String(sekarangObj.getHours()).padStart(2, "0")}.${String(sekarangObj.getMinutes()).padStart(2, "0")}`;

  const durasiTrekTeks = useMemo(() => {
    if (koordinat.length < 2 || !koordinat[0]?.timestamp || !koordinat[koordinat.length - 1]?.timestamp) return "00:00:00";
    const t0 = Date.parse(koordinat[0].timestamp!);
    const t1 = Date.parse(koordinat[koordinat.length - 1].timestamp!);
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return "00:00:00";
    const totalDetik = Math.floor((t1 - t0) / 1000);
    const jam = String(Math.floor(totalDetik / 3600)).padStart(2, "0");
    const mnt = String(Math.floor((totalDetik % 3600) / 60)).padStart(2, "0");
    const dtk = String(totalDetik % 60).padStart(2, "0");
    return `${jam}:${mnt}:${dtk}`;
  }, [koordinat]);

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
    const val = nilaiKustom[f.id] ?? f.nilaiBawaan ?? "";
    const labelReq = f.wajib ? " *" : "";
    if (f.tipe === "pilihan") {
      return (
        <div key={f.id} className="avz-isian-baris avz-tabel-kolom">
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
        <div key={f.id} className="avz-isian-baris avz-tabel-kolom">
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
    if (f.tipe === "nominal") {
      const displayVal = val ? (val.startsWith("Rp") ? val : formatNominalRupiah(val)) : "";
      return (
        <div key={f.id} className="avz-isian-baris avz-tabel-kolom">
          <div className="avz-isian-kepala">
            <strong>
              {f.nama}
              {labelReq}
            </strong>
            <span className={`avz-skema-tag ${f.wajib ? "wajib" : ""}`}>{f.wajib ? "Wajib" : "Nominal (Rp)"}</span>
          </div>
          <div className="avz-nominal-input-wrap">
            <span className="avz-nominal-prefix">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              className="form-input avz-nominal-input"
              required={Boolean(f.wajib)}
              placeholder={f.placeholder || "0"}
              value={displayVal.replace(/^Rp\s*/, "")}
              onChange={(e) => {
                const raw = ambilAngkaNominal(e.target.value);
                ubahNilaiKustom(f.id, raw ? formatNominalRupiah(raw) : "");
              }}
            />
          </div>
        </div>
      );
    }
    if (f.tipe === "foto") {
      return (
        <div key={f.id} className="avz-isian-baris avz-tabel-kolom">
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
      <div key={f.id} className="avz-isian-baris avz-tabel-kolom">
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
        {lapisanAktif?.tipeGeometriDiizinkan &&
          lapisanAktif.tipeGeometriDiizinkan.length > 0 &&
          modeRekam &&
          !lapisanAktif.tipeGeometriDiizinkan.includes(modeRekam) && (
            <div className="avz-skema-banner" role="status" style={{ background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}>
              <div>
                <strong>{`Tipe ${modeRekam.toUpperCase()} memakai format default`}</strong>
                <small>
                  {`Tugas "${lapisanAktif.nama}" dikhususkan untuk: ${lapisanAktif.tipeGeometriDiizinkan
                    .map((g) => (g === "point" ? "Point" : g === "line" ? "Line" : "Polygon"))
                    .join(", ")}.`}
                </small>
              </div>
              {onPilihLapisanAktif && (
                <button type="button" className="avz-aksi-hijau" onClick={() => onPilihLapisanAktif(null)}>
                  Ganti Default
                </button>
              )}
            </div>
          )}

        {lapisanAktif && skemaAktifFields.length > 0 && (
          <div className="avz-skema-banner">
            <div>
              <strong>{`Lapisan Tugas Admin: ${lapisanAktif.nama}`}</strong>
              <small>{`Format tabel dan isian ${modeRekam?.toUpperCase()} dari Admin.`}</small>
            </div>
            {onPilihLapisanAktif && (
              <button type="button" className="avz-aksi-hijau" onClick={() => onPilihLapisanAktif(null)}>
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
              onClick={() => {
                namaInputRef.current?.focus();
                namaInputRef.current?.select();
              }}
            >
              Edit
            </button>
          </div>
          <input
            ref={namaInputRef}
            className="form-input avz-input-bersih"
            type="text"
            required
            maxLength={500}
            placeholder={modeRekam === "point" ? "Tanda tempat 1" : modeRekam === "line" ? "Trek 1" : "Area 1"}
            value={isian.judul}
            onChange={(e) => ubah("judul", e.target.value)}
          />
        </div>

        {/* 2. KOORDINAT (Point) / JARAK (Line) / LUAS (Polygon) */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{modeRekam === "point" ? "Koordinat" : modeRekam === "line" ? "Jarak" : "Luas"}</strong>
            {modeRekam === "point" && (
              <button type="button" className="avz-aksi-hijau" onClick={() => setBukaEditKoord((v) => !v)}>
                {bukaEditKoord ? "Tutup" : "Edit"}
              </button>
            )}
          </div>
          {modeRekam === "point" ? (
            !bukaEditKoord && (
              <button
                type="button"
                className="avz-isian-nilai-edit tabular-nums"
                onClick={() => setBukaEditKoord(true)}
                aria-label="Edit koordinat titik"
              >
                {teksKoordSaatIni}
              </button>
            )
          ) : (
            <span className="avz-isian-nilai-panah tabular-nums">
              {modeRekam === "line"
                ? `${panjangDraftKm.toFixed(2).replace(".", ",")} km`
                : `${luasDraftHa.toFixed(2).replace(".", ",")} Ha`}
              <ChevronRight size={20} aria-hidden="true" />
            </span>
          )}
          {modeRekam === "point" && bukaEditKoord && (
            <div style={{ marginTop: 4 }}>
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
                autoFokus
                sembunyikanLabel
              />
            </div>
          )}
        </div>

        {/* 3. LAPISAN SAAT INI + EDIT LAPISAN (BERSIH TANPA KATEGORI BAWAAN) */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Lapisan saat ini</strong>
          </div>
          <button
            type="button"
            className="avz-isian-nilai-panah avz-corak-btn"
            onClick={() => setBukaEditLapisan((v) => !v)}
          >
            <span>{lapisanAktif?.nama || "Lapisan 1"}</span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <button type="button" className="avz-tombol-garis" onClick={() => setBukaEditLapisan((v) => !v)}>
            Edit Lapisan
          </button>
          {bukaEditLapisan && onPilihLapisanAktif && (
            <div className="form-tematik-box" style={{ marginTop: 8 }}>
              <label>
                Pilih Lapisan Peta
                <select
                  className="form-input"
                  value={lapisanAktif?.id ?? ""}
                  onChange={(e) => {
                    onPilihLapisanAktif(e.target.value || null);
                    setBukaEditLapisan(false);
                  }}
                >
                  <option value="">Lapisan 1 (Default)</option>
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

        {/* TABEL & KOLOM KHUSUS TUGAS ADMIN (DITAMPILKAN SESUAI FORMAT ADMIN SAAT LAPISAN DIPILIH) */}
        {grupTabelAktif.length > 0 && (
          <div className="avz-tabel-grup-wrap">
            {grupTabelAktif.map((grp) => (
              <div key={grp.namaTabel} className="avz-tabel-kartu">
                <div className="avz-tabel-kartu-head">
                  <Table2 size={15} color="#0B6E4F" aria-hidden="true" />
                  <strong>{grp.namaTabel}</strong>
                </div>
                <div className="avz-tabel-kartu-isi">{grp.fields.map((f) => renderFieldSkema(f))}</div>
              </div>
            ))}
          </div>
        )}

        {/* 4. FOTO */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Foto</strong>
            <button type="button" className="avz-aksi-hijau" onClick={() => setBukaFotoPanel((v) => !v)}>
              {isian.foto ? "Ubah" : bukaFotoPanel ? "Tutup" : "Tambah"}
            </button>
          </div>
          {!bukaFotoPanel && !isian.foto && (
            <button
              type="button"
              className="avz-isian-nilai-edit avz-isian-kosong"
              onClick={() => setBukaFotoPanel(true)}
            >
              Ketuk untuk menambah foto...
            </button>
          )}
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
                    form.handlePilihFoto(e, {
                      posisi: koordinat[0] ?? { lat: 0, lng: 0 },
                      idKader: profil.idKader,
                      desa: profil.desaWilayah,
                      diambilPada: new Date().toISOString(),
                      tematik: lapisanAktif?.nama || undefined,
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
            <button type="button" className="avz-aksi-hijau" onClick={() => setBukaDeskripsiPanel((v) => !v)}>
              {isian.deskripsi ? "Edit" : bukaDeskripsiPanel ? "Tutup" : "Tambah"}
            </button>
          </div>
          {!bukaDeskripsiPanel && (
            <button
              type="button"
              className={`avz-isian-nilai-edit ${isian.deskripsi ? "" : "avz-isian-kosong"}`}
              onClick={() => setBukaDeskripsiPanel(true)}
            >
              {isian.deskripsi || "Ketuk untuk menambah deskripsi..."}
            </button>
          )}
          {bukaDeskripsiPanel && (
            <textarea
              rows={3}
              className="form-input avz-input-bersih"
              maxLength={10000}
              placeholder="Catatan atau deskripsi objek..."
              value={isian.deskripsi}
              autoFocus
              onChange={(e) => ubah("deskripsi", e.target.value)}
            />
          )}
        </div>

        {/* 6. CORAK */}
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Corak</strong>
          </div>
          <button type="button" className="avz-isian-nilai-panah avz-corak-btn" onClick={() => setBukaPilihCorak((v) => !v)}>
            <span>{corakAktif.label}</span>
            <span className="avz-corak-preview">
              {modeRekam === "point" ? (
                <MapPin size={20} color={corakAktif.warna} fill={corakAktif.warna} aria-hidden="true" />
              ) : modeRekam === "line" ? (
                <Route size={20} color={corakAktif.warna} aria-hidden="true" />
              ) : (
                <Hexagon size={20} color={corakAktif.warna} aria-hidden="true" />
              )}
              <ChevronRight size={20} aria-hidden="true" />
            </span>
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
          {!bukaEditElevasi ? (
            <button
              type="button"
              className="avz-isian-nilai-edit tabular-nums"
              onClick={() => setBukaEditElevasi(true)}
            >
              {elevasiTeks}
            </button>
          ) : (
            <input
              type="number"
              step="any"
              className="form-input avz-input-bersih"
              placeholder="Elevasi (meter)"
              value={isian.elevasi ?? ""}
              autoFocus
              onChange={(e) => ubah("elevasi", e.target.value)}
            />
          )}
          <button type="button" className="avz-tombol-garis" disabled={gpsSibuk} onClick={() => void rataGps()}>
            {gpsSibuk ? `Mengukur (${sampel} sampel)...` : "Ambil elevasi"}
          </button>
        </div>

        {/* 8. TAMPILKAN GRAFIK & OPERASI (KHUSUS TREK / LINE, SESUAI SCREENSHOT 1) */}
        {modeRekam === "line" && (
          <>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Tampilkan Grafik</strong>
              </div>
              <button type="button" className="avz-isian-nilai-panah avz-corak-btn" onClick={() => setBukaGrafikTrek((v) => !v)}>
                <span className="tabular-nums">
                  Dist: {panjangDraftKm.toFixed(2).replace(".", ",")} km | {durasiTrekTeks}
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
                <span className="avz-lock-yellow" title="Konversi trek menjadi poligon area">
                  <Lock size={13} aria-hidden="true" />
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

        {/* 9. DIBUAT & SKEMA ATRIBUT (UNTUK POINT & AREA DEFAULT, SESUAI SCREENSHOT 2) */}
        {modeRekam !== "line" && (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Dibuat</strong>
            </div>
            <span className="tabular-nums">{dibuatTeks}</span>
          </div>
        )}

        {skemaAktifFields.length === 0 && modeRekam !== "line" && (
          <div className="avz-isian-baris">
            <div className="avz-isian-kepala">
              <strong>Skema atribut</strong>
              <button type="button" className="avz-aksi-hijau" onClick={() => setBukaSkemaPanel((v) => !v)}>
                {bukaSkemaPanel ? "Tutup" : "Edit"}
              </button>
            </div>
            <button
              type="button"
              className="avz-isian-nilai-edit avz-isian-kecil"
              onClick={() => setBukaSkemaPanel((v) => !v)}
            >
              Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
            </button>
            {bukaSkemaPanel && (
              <div className="avz-atribut-ekstra">
                {onPilihLapisanAktif && lapisanList.length > 0 && (
                  <label>
                    Gunakan Lapisan Tugas Admin
                    <select
                      className="form-input"
                      value={lapisanAktif?.id ?? ""}
                      onChange={(e) => onPilihLapisanAktif(e.target.value || null)}
                    >
                      <option value="">Lapisan 1 (Default)</option>
                      {lapisanList.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nama}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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

        <footer className="modal-footer avz-footer-pills">
          {onNavigasiTitik && (
            <button type="button" className="avz-pill-outline-btn" onClick={onNavigasiTitik}>
              Navigasi
            </button>
          )}
          <button type="button" className="avz-pill-outline-btn" onClick={bagikanDraft}>
            Bagikan
          </button>
          <button
            type="submit"
            className="avz-pill-primary-btn"
            disabled={gpsSibuk || memoSibuk || form.memprosesFoto || Boolean(galatGeometri)}
          >
            Simpan
          </button>
        </footer>
      </form>
    </BottomSheet>
  );
}
