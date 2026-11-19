import React, { useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Route,
  Layers,
  Lock,
  Check
} from "lucide-react";
import { DataSpasialItem, KoordinatTitik, LapisanSpasial } from "../../types";
import { hitungJarakMeter, hitungLuasPoligonHa, hitungPanjangGarisKm, sanitasiTeksInput } from "../../lib/geoUtils";
import { uraikanTeksKoordinat } from "../../lib/sistemKoordinat";

export type TahapPeek = "ringkas" | "sedang" | "penuh";

const PILIHAN_WARNA_CORAK = [
  { id: "merah", warna: "#ef4444", label: "Merah" },
  { id: "biru", warna: "#0284c7", label: "Biru" },
  { id: "hijau", warna: "#0d7344", label: "Hijau" },
  { id: "jingga", warna: "#f26101", label: "Jingga" },
  { id: "kuning", warna: "#eab308", label: "Kuning" },
  { id: "ungu", warna: "#a855f7", label: "Ungu" }
];

function ringkasNamaWarna(label?: string): string {
  if (!label) return "";
  const l = label.toLowerCase();
  if (l.includes("merah")) return "Merah";
  if (l.includes("jingga") || l.includes("oren") || l.includes("oranye")) return "Jingga";
  if (l.includes("hijau")) return "Hijau";
  if (l.includes("biru")) return "Biru";
  if (l.includes("kuning")) return "Kuning";
  if (l.includes("ungu")) return "Ungu";
  return label;
}

function hitungPerimeterPoligonKm(titik: KoordinatTitik[]): number {
  if (titik.length < 2) return 0;
  let totalM = 0;
  for (let i = 0; i < titik.length - 1; i++) {
    totalM += hitungJarakMeter(titik[i], titik[i + 1]);
  }
  if (titik.length >= 3) {
    totalM += hitungJarakMeter(titik[titik.length - 1], titik[0]);
  }
  return totalM / 1000;
}

function formatLuasArea(luasHa: number): string {
  if (luasHa >= 100) {
    return `${(luasHa / 100).toFixed(2).replace(".", ",")} km²`;
  }
  if (luasHa > 0 && luasHa < 0.01) {
    return `${Math.round(luasHa * 10_000)} m²`;
  }
  return `${luasHa.toFixed(2).replace(".", ",")} Ha`;
}

export interface PeekSheetInteraktifProps {
  mode: "draft_pin" | "objek_terpilih";
  titikDraft?: KoordinatTitik[];
  lapisanAktif?: LapisanSpasial | null;
  lapisanList?: LapisanSpasial[];
  onPilihLapisanAktif?: (id: string | null) => void;
  objekTerpilih?: DataSpasialItem | null;
  tahapAwal?: TahapPeek;
  onTahapChange?: (tahap: TahapPeek) => void;
  onBukaFormLengkap: () => void;
  onBukaDetailLengkap: () => void;
  onTutup: () => void;
  onGoTo: (target: { lat: number; lng: number; judul: string }) => void;
  onBagikan: (teks: string) => void;
  onHapus?: (id: string) => void;
  onPesan?: (pesan: string) => void;
  elevasiMeter?: number | null;
  onAmbilElevasiGps?: () => void;
  sedangUkurGps?: boolean;
  onKonversiKeArea?: () => void;
  onBukaHalamanLapisan?: () => void;
  onUbahKoordinat?: (titik: KoordinatTitik) => void;
  onPerbaruiObjek?: (dataDiubah: DataSpasialItem) => void;
  namaDraft?: string;
  onUbahNamaDraft?: (nama: string) => void;
  deskripsiDraft?: string;
  onUbahDeskripsiDraft?: (teks: string) => void;
  elevasiDraft?: string;
  onUbahElevasiDraft?: (elevasi: string) => void;
  onUbahCorakDraft?: (simbol: string, warna: string) => void;
  fotoDraft?: string;
  onSimpanLangsung?: (
    nama: string,
    simbol?: string,
    warna?: string,
    ekstra?: { deskripsi?: string; elevasi?: string }
  ) => void;
}

/** Ikon kotak berarsir diagonal (Area) sesuai tampilan ringkas Avenza */
const IkonAreaBerarsir: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="#475569"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
    <circle cx="4.5" cy="4.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="19.5" cy="4.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="4.5" cy="19.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="19.5" cy="19.5" r="1.5" fill="#475569" stroke="none" />
    <path d="M8.5 15.5l7-7M7 11l4-4M13 17l4-4" />
  </svg>
);

/** Ikon kotak perimeter bersudut sesuai tampilan ringkas Avenza */
const IkonPerimeterKotak: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="#475569"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
    <circle cx="4.5" cy="4.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="19.5" cy="4.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="4.5" cy="19.5" r="1.5" fill="#475569" stroke="none" />
    <circle cx="19.5" cy="19.5" r="1.5" fill="#475569" stroke="none" />
  </svg>
);

/** Ikon corak area jingga trapesium (persis tampilan detail Area) */
const IkonCorakAreaJingga: React.FC<{ warna?: string }> = ({ warna = "#f26101" }) => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
    <polygon
      points="6,4 19,7 17,20 3,16"
      fill={warna}
      fillOpacity="0.42"
      stroke={warna}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Komponen Peek Card interaktif bawah peta (ala Avenza Maps):
 * - Saat titik/garis/area diklik di peta, tampil dalam mode ringkas sederhana.
 * - Geser (swipe) ke atas -> berubah halus ke tampilan detail lengkap.
 * - Geser (swipe) ke bawah -> kembali halus ke tampilan sederhana (atau menutup bila sudah ringkas).
 */
export const PeekSheetInteraktif: React.FC<PeekSheetInteraktifProps> = ({
  mode,
  titikDraft = [],
  lapisanAktif,
  lapisanList = [],
  onPilihLapisanAktif,
  objekTerpilih,
  tahapAwal = "ringkas",
  onTahapChange,
  onBukaFormLengkap,
  onBukaDetailLengkap,
  onTutup,
  onGoTo,
  onBagikan,
  onHapus,
  onPesan,
  elevasiMeter,
  onAmbilElevasiGps,
  sedangUkurGps = false,
  onKonversiKeArea,
  onBukaHalamanLapisan,
  onUbahKoordinat,
  onPerbaruiObjek,
  namaDraft,
  onUbahNamaDraft,
  deskripsiDraft,
  onUbahDeskripsiDraft,
  elevasiDraft,
  onUbahElevasiDraft,
  onUbahCorakDraft,
  fotoDraft,
  onSimpanLangsung
}) => {
  const [tahap, setTahap] = useState<TahapPeek>(tahapAwal);
  const [sedangSeret, setSedangSeret] = useState(false);
  const [namaInput, setNamaInput] = useState(
    mode === "draft_pin" ? namaDraft || "Tanda tempat 1" : objekTerpilih?.judul || ""
  );
  const [sedangEditNama, setSedangEditNama] = useState(false);
  const [sedangEditKoord, setSedangEditKoord] = useState(false);
  const [koordInput, setKoordInput] = useState("");
  const [galatKoord, setGalatKoord] = useState("");
  const [deskripsiInput, setDeskripsiInput] = useState(
    mode === "draft_pin" ? deskripsiDraft || "" : objekTerpilih?.deskripsi || ""
  );
  const [sedangEditDeskripsi, setSedangEditDeskripsi] = useState(false);
  const [elevasiInput, setElevasiInput] = useState(
    mode === "draft_pin"
      ? elevasiDraft || ""
      : objekTerpilih?.elevasi !== undefined
        ? String(objekTerpilih.elevasi)
        : ""
  );
  const [sedangEditElevasi, setSedangEditElevasi] = useState(false);
  const [bukaEditLapisan, setBukaEditLapisan] = useState(false);
  const [bukaPilihCorak, setBukaPilihCorak] = useState(false);
  const [corakTerpilih, setCorakTerpilih] = useState(() => {
    const namaSimbol = ringkasNamaWarna(objekTerpilih?.simbol);
    const cocok =
      (objekTerpilih?.warna
        ? PILIHAN_WARNA_CORAK.find((c) => c.warna.toLowerCase() === objekTerpilih.warna?.toLowerCase())
        : undefined) ??
      (namaSimbol ? PILIHAN_WARNA_CORAK.find((c) => c.label.toLowerCase() === namaSimbol.toLowerCase()) : undefined);
    if (cocok) return cocok;
    if (mode === "objek_terpilih" && (objekTerpilih?.jenisGeometri === "polygon" || objekTerpilih?.jenisGeometri === "line")) {
      return PILIHAN_WARNA_CORAK[3];
    }
    return PILIHAN_WARNA_CORAK[0];
  });

  const sheetRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const seretAwalRef = useRef<{ y: number; time: number; tinggiAwal: number } | null>(null);
  const totalGeserRef = useRef(0);

  useEffect(() => {
    onTahapChange?.(tahap);
  }, [tahap, onTahapChange]);

  const gantiTahap = (tahapBaru: TahapPeek) => {
    setTahap(tahapBaru);
  };

  // Handler Drag halus Touch dan Pointer (berlaku di HP dan PC, baik naik maupun turun)
  const mulaiSeret = (clientY: number) => {
    const tinggiSaatIni = sheetRef.current?.offsetHeight || 160;
    seretAwalRef.current = { y: clientY, time: Date.now(), tinggiAwal: tinggiSaatIni };
    totalGeserRef.current = 0;
    setSedangSeret(true);
  };

  const lakukanSeret = (clientY: number) => {
    if (!seretAwalRef.current || !sheetRef.current) return;
    const dy = clientY - seretAwalRef.current.y;
    totalGeserRef.current = dy;

    // Di mode detail, batasi geser ke atas agar terasa kokoh dan responsif saat digeser ke bawah
    const minY = tahap === "ringkas" ? -320 : -24;
    const maxY = tahap === "ringkas" ? 180 : 320;
    const clampedDy = Math.max(minY, Math.min(maxY, dy));
    sheetRef.current.style.transform = `translateY(${clampedDy}px)`;
  };

  const selesaikanSeret = () => {
    if (!seretAwalRef.current || !sheetRef.current) return;
    const dy = totalGeserRef.current;
    const dt = Math.max(20, Date.now() - seretAwalRef.current.time);
    const v = dy / dt; // negatif = naik, positif = turun

    sheetRef.current.style.transform = "";
    setSedangSeret(false);
    seretAwalRef.current = null;

    const naik = dy < -28 || v < -0.32;
    const turun = dy > 28 || v > 0.32;

    if (naik) {
      if (tahap === "ringkas") {
        gantiTahap("penuh");
      } else if (tahap === "sedang") {
        gantiTahap("penuh");
      }
    } else if (turun) {
      if (tahap === "penuh" || tahap === "sedang") {
        gantiTahap("ringkas");
      } else if (tahap === "ringkas" && (dy > 65 || v > 0.45)) {
        onTutup();
      }
    }
  };

  const titikUtama = mode === "draft_pin" ? titikDraft[0] : objekTerpilih?.koordinat[0];
  const teksKoordinat = titikUtama ? `${titikUtama.lat.toFixed(6)}, ${titikUtama.lng.toFixed(6)}` : "-";
  const namaLapisan =
    mode === "draft_pin"
      ? lapisanAktif?.nama || "Lapisan 1"
      : objekTerpilih?.lapisanNama || objekTerpilih?.tematik || "Lapisan 1";

  const jenisGeo = mode === "draft_pin" ? "point" : objekTerpilih?.jenisGeometri || "point";
  const judulTipe =
    mode === "draft_pin"
      ? "Pin dijatuhkan"
      : jenisGeo === "point"
        ? "Titik"
        : jenisGeo === "line"
          ? "Jalur"
          : "Area";
  const judulRingkas = mode === "draft_pin" ? "Pin dijatuhkan" : objekTerpilih?.judul || "Objek Peta";

  const panjangLineKm =
    objekTerpilih?.panjangKm !== undefined && objekTerpilih.panjangKm > 0
      ? objekTerpilih.panjangKm
      : hitungPanjangGarisKm(objekTerpilih?.koordinat ?? []);
  const luasAreaHa =
    objekTerpilih?.luasHa !== undefined && objekTerpilih.luasHa > 0
      ? objekTerpilih.luasHa
      : hitungLuasPoligonHa(objekTerpilih?.koordinat ?? []);
  const perimeterAreaKm =
    jenisGeo === "polygon"
      ? hitungPerimeterPoligonKm(objekTerpilih?.koordinat ?? [])
      : 0;

  const teksArea = formatLuasArea(luasAreaHa);
  const teksPerimeter = `${perimeterAreaKm.toFixed(2).replace(".", ",")} km`;
  const teksJarak = `${panjangLineKm.toFixed(2).replace(".", ",")} km`;

  const ukuranTeks =
    jenisGeo === "point"
      ? teksKoordinat
      : jenisGeo === "line"
        ? teksJarak
        : teksArea;

  const elevasiVal =
    elevasiInput.trim() !== "" && Number.isFinite(Number(elevasiInput.replace(",", ".")))
      ? Number(elevasiInput.replace(",", "."))
      : mode === "draft_pin"
        ? (elevasiMeter ?? titikUtama?.elevasi)
        : (objekTerpilih?.elevasi ?? titikUtama?.elevasi);

  const fotoTampil = mode === "draft_pin" ? fotoDraft : objekTerpilih?.fotoBase64;
  const teksNamaTampil = namaInput.trim() || (mode === "draft_pin" ? "Tanda tempat 1" : objekTerpilih?.judul || "Tanda tempat 1");

  const tglDibuat = objekTerpilih?.createdAt ? new Date(objekTerpilih.createdAt) : new Date();
  const formatTgl = `${String(tglDibuat.getDate()).padStart(2, "0")}/${String(tglDibuat.getMonth() + 1).padStart(2, "0")}/${String(tglDibuat.getFullYear()).slice(-2)} pada ${String(tglDibuat.getHours()).padStart(2, "0")}.${String(tglDibuat.getMinutes()).padStart(2, "0")}`;

  const atributEntries = Object.entries(objekTerpilih?.atributKustom ?? {}).filter(([, val]) => String(val ?? "").trim() !== "");

  const simpanEditNama = () => {
    const bersih =
      sanitasiTeksInput(namaInput) ||
      (mode === "draft_pin" ? "Tanda tempat 1" : objekTerpilih?.judul || "Tanda tempat 1");
    setNamaInput(bersih);
    setSedangEditNama(false);
    if (mode === "draft_pin") {
      onUbahNamaDraft?.(bersih);
    } else if (objekTerpilih && onPerbaruiObjek && bersih !== objekTerpilih.judul) {
      onPerbaruiObjek({ ...objekTerpilih, judul: bersih });
    }
    return bersih;
  };

  const mulaiEditKoordinat = () => {
    setKoordInput(teksKoordinat === "-" ? "" : teksKoordinat);
    setGalatKoord("");
    setSedangEditKoord(true);
  };

  const simpanEditKoordinat = () => {
    const hasil = uraikanTeksKoordinat(koordInput);
    if (!hasil) {
      setGalatKoord("Format koordinat tidak dikenali. Contoh: -6.200000, 106.816666");
      return;
    }
    setGalatKoord("");
    const titikBaru: KoordinatTitik = {
      ...(titikUtama ?? { lat: hasil.lat, lng: hasil.lng }),
      lat: hasil.lat,
      lng: hasil.lng,
      akurasi: undefined
    };
    if (mode === "draft_pin") {
      onUbahKoordinat?.(titikBaru);
    } else if (objekTerpilih && onPerbaruiObjek) {
      const sisa = objekTerpilih.koordinat.slice(1);
      onPerbaruiObjek({ ...objekTerpilih, koordinat: [titikBaru, ...sisa] });
    }
    setSedangEditKoord(false);
    onPesan?.("Koordinat titik diperbarui");
  };

  const simpanEditDeskripsi = () => {
    const bersih = sanitasiTeksInput(deskripsiInput);
    setDeskripsiInput(bersih);
    setSedangEditDeskripsi(false);
    if (mode === "draft_pin") {
      onUbahDeskripsiDraft?.(bersih);
    } else if (objekTerpilih && onPerbaruiObjek && bersih !== (objekTerpilih.deskripsi || "")) {
      onPerbaruiObjek({ ...objekTerpilih, deskripsi: bersih });
    }
    return bersih;
  };

  const simpanEditElevasi = () => {
    const bersih = elevasiInput.trim();
    setSedangEditElevasi(false);
    const angka = Number(bersih.replace(",", "."));
    if (mode === "draft_pin") {
      onUbahElevasiDraft?.(bersih);
    } else if (objekTerpilih && onPerbaruiObjek) {
      onPerbaruiObjek({
        ...objekTerpilih,
        elevasi: bersih !== "" && Number.isFinite(angka) ? angka : undefined
      });
    }
    return bersih;
  };

  const handleSimpanAksi = () => {
    const namaFinal = sedangEditNama ? simpanEditNama() : sanitasiTeksInput(teksNamaTampil) || "Tanda tempat 1";
    const deskFinal = sedangEditDeskripsi ? simpanEditDeskripsi() : sanitasiTeksInput(deskripsiInput);
    const elevFinal = sedangEditElevasi ? simpanEditElevasi() : elevasiInput.trim();
    if (sedangEditKoord) {
      const hasil = uraikanTeksKoordinat(koordInput);
      if (hasil) simpanEditKoordinat();
    }
    if (mode === "objek_terpilih") {
      if (objekTerpilih && onPerbaruiObjek) {
        const angkaElev = Number(elevFinal.replace(",", "."));
        onPerbaruiObjek({
          ...objekTerpilih,
          judul: namaFinal,
          deskripsi: deskFinal,
          simbol: corakTerpilih.label,
          warna: corakTerpilih.warna,
          elevasi:
            elevFinal !== "" && Number.isFinite(angkaElev) ? angkaElev : objekTerpilih.elevasi
        });
      }
      gantiTahap("ringkas");
      return;
    }
    if (onSimpanLangsung) {
      onSimpanLangsung(namaFinal, corakTerpilih.label, corakTerpilih.warna, {
        deskripsi: deskFinal,
        elevasi: elevFinal
      });
    } else {
      onBukaFormLengkap();
    }
  };

  // Handler swipe seragam untuk handle ringkas maupun header detail
  const propsSeretHeader = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      // Jangan cegat klik tombol di dalam header
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      mulaiSeret(e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (seretAwalRef.current) lakukanSeret(e.clientY);
    },
    onPointerUp: () => selesaikanSeret(),
    onPointerCancel: () => selesaikanSeret(),
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (e.touches[0]) mulaiSeret(e.touches[0].clientY);
    },
    onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
      if (seretAwalRef.current && e.touches[0]) lakukanSeret(e.touches[0].clientY);
    },
    onTouchEnd: () => selesaikanSeret()
  };

  const handleBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (tahap === "ringkas") {
      if (e.touches[0]) mulaiSeret(e.touches[0].clientY);
      return;
    }
    // Saat di mode detail dan scroll berada di paling atas, izinkan swipe ke bawah untuk kembali ke mode ringkas
    if (bodyRef.current && bodyRef.current.scrollTop <= 2 && e.touches[0]) {
      mulaiSeret(e.touches[0].clientY);
    }
  };

  const handleBodyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!seretAwalRef.current || !e.touches[0]) return;
    const dy = e.touches[0].clientY - seretAwalRef.current.y;
    // Pada mode detail, hanya tarik sheet ke bawah jika user menggeser ke bawah di posisi paling atas scroll
    if (tahap !== "ringkas" && dy < 0) {
      seretAwalRef.current = null;
      setSedangSeret(false);
      if (sheetRef.current) sheetRef.current.style.transform = "";
      return;
    }
    lakukanSeret(e.touches[0].clientY);
  };

  const handleBodyTouchEnd = () => {
    if (seretAwalRef.current) selesaikanSeret();
  };

  return (
    <section
      ref={sheetRef}
      className={`avz-peek-card tahap-${tahap} ${sedangSeret ? "sedang-seret" : ""} ${mode === "objek_terpilih" ? "field-inspector-sheet" : ""}`}
      role="dialog"
      aria-label={judulRingkas}
      data-tahap={tahap}
    >
      {/* Kepala Mode Detail (Swipe ke bawah atau tekan chevron untuk kembali ke mode sederhana) */}
      {tahap !== "ringkas" ? (
        <header
          className="avz-peek-full-header"
          {...propsSeretHeader}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="avz-peek-btn-kembali"
            aria-label="Ciutkan kartu ke mode ringkas"
            onClick={() => gantiTahap("ringkas")}
          >
            <ChevronDown size={24} color="#0d7344" />
          </button>
          <h2 className="avz-peek-header-title">{judulTipe}</h2>
          <button
            type="button"
            className="avz-peek-btn-centang"
            aria-label={mode === "draft_pin" ? "Simpan pin tanda tempat" : "Simpan perubahan objek"}
            onClick={handleSimpanAksi}
          >
            <Check size={24} color="#0d7344" />
          </button>
        </header>
      ) : (
        /* Handle Pegangan Ringkas Bersih (Swipe ke atas untuk detail, swipe ke bawah untuk tutup) */
        <div
          className="avz-peek-handle"
          tabIndex={0}
          role="button"
          aria-label={`Tahap panel ${tahap}. Geser ke atas untuk detail, geser ke bawah untuk menutup.`}
          {...propsSeretHeader}
          onClick={(e) => {
            if (Math.abs(totalGeserRef.current) < 10) {
              e.stopPropagation();
              gantiTahap("penuh");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              gantiTahap("penuh");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onTutup();
            }
          }}
        >
          <span className="avz-peek-grip-bar" aria-hidden="true" />
        </div>
      )}

      {/* Bagian Isi Utama */}
      <div
        ref={bodyRef}
        className="avz-peek-body"
        onTouchStart={handleBodyTouchStart}
        onTouchMove={handleBodyTouchMove}
        onTouchEnd={handleBodyTouchEnd}
        onClick={() => {
          if (tahap === "ringkas" && Math.abs(totalGeserRef.current) < 10) {
            gantiTahap("penuh");
          }
        }}
      >
        {/* MODE RINGKAS SEDERHANA (Sesuai Screenshot Area, Pin, dan Trek) */}
        {tahap === "ringkas" && (
          <div className="avz-peek-header-summary">
            <h2 className="avz-peek-title">{judulRingkas}</h2>

            {jenisGeo === "polygon" ? (
              <div className="avz-peek-meta-row avz-peek-meta-dual">
                <span className="avz-peek-meta-item">
                  <IkonAreaBerarsir size={18} />
                  <span className="tabular-nums">{teksArea}</span>
                </span>
                <span className="avz-peek-meta-item">
                  <IkonPerimeterKotak size={18} />
                  <span className="tabular-nums">{teksPerimeter}</span>
                </span>
              </div>
            ) : (
              <div className="avz-peek-meta-row">
                {jenisGeo === "point" ? (
                  <MapPin size={18} color="#475569" aria-hidden="true" />
                ) : (
                  <Route size={18} color="#475569" aria-hidden="true" />
                )}
                <span className="tabular-nums">{ukuranTeks}</span>
              </div>
            )}

            <div className="avz-peek-meta-row">
              <Layers size={18} color="#475569" aria-hidden="true" />
              <span>{namaLapisan}</span>
            </div>
          </div>
        )}

        {/* MODE DETAIL LENGKAP SAAT DISWAP KE ATAS (Sesuai Screenshot Detail Area/Titik/Jalur) */}
        {tahap !== "ringkas" && (
          <div className="avz-peek-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="avz-peek-detail-grid">
              {/* 1. Baris Nama */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Nama</strong>
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    onClick={() => {
                      if (sedangEditNama) {
                        simpanEditNama();
                      } else {
                        setSedangEditNama(true);
                      }
                    }}
                  >
                    Edit
                  </button>
                </div>
                {sedangEditNama ? (
                  <div className="avz-inline-edit-row">
                    <input
                      type="text"
                      className="form-input avz-input-bersih"
                      value={namaInput}
                      onChange={(e) => {
                        setNamaInput(e.target.value);
                        if (mode === "draft_pin") onUbahNamaDraft?.(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          simpanEditNama();
                        } else if (e.key === "Escape") {
                          setSedangEditNama(false);
                        }
                      }}
                      placeholder="Tanda tempat 1"
                      aria-label="Edit nama"
                      autoFocus
                    />
                    <button type="button" className="avz-aksi-hijau" onClick={simpanEditNama}>
                      Selesai
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="avz-isian-nilai-edit"
                    onClick={() => setSedangEditNama(true)}
                    aria-label={`Edit nama ${teksNamaTampil}`}
                  >
                    {teksNamaTampil}
                  </button>
                )}
              </div>

              {/* 2. Metrik Geometri (Koordinat / Jarak / Area + Perimeter) */}
              {jenisGeo === "point" && (
                <div className="avz-isian-baris">
                  <div className="avz-isian-kepala">
                    <strong>Koordinat</strong>
                    <button
                      type="button"
                      className="avz-aksi-hijau"
                      onClick={() => {
                        if (sedangEditKoord) {
                          simpanEditKoordinat();
                        } else {
                          mulaiEditKoordinat();
                        }
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  {sedangEditKoord ? (
                    <div className="avz-inline-edit-col">
                      <div className="avz-inline-edit-row">
                        <input
                          type="text"
                          className="form-input avz-input-bersih tabular-nums"
                          value={koordInput}
                          onChange={(e) => {
                            setKoordInput(e.target.value);
                            if (galatKoord) setGalatKoord("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              simpanEditKoordinat();
                            } else if (e.key === "Escape") {
                              setSedangEditKoord(false);
                              setGalatKoord("");
                            }
                          }}
                          placeholder="Contoh: -6.200000, 106.816666"
                          aria-label="Edit titik koordinat"
                          autoFocus
                        />
                        <button type="button" className="avz-aksi-hijau" onClick={simpanEditKoordinat}>
                          Selesai
                        </button>
                      </div>
                      {galatKoord && (
                        <span className="field-error" role="alert">
                          {galatKoord}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="avz-isian-nilai-edit tabular-nums"
                      onClick={mulaiEditKoordinat}
                      aria-label="Edit titik koordinat"
                    >
                      {teksKoordinat}
                    </button>
                  )}
                </div>
              )}

              {jenisGeo === "line" && (
                <div className="avz-isian-baris">
                  <div className="avz-isian-kepala">
                    <strong>Jarak</strong>
                  </div>
                  <div className="avz-isian-nilai-panah">
                    <span className="tabular-nums">{teksJarak}</span>
                    <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                  </div>
                </div>
              )}

              {jenisGeo === "polygon" && (
                <>
                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Area</strong>
                    </div>
                    <div className="avz-isian-nilai-panah">
                      <span className="tabular-nums">{teksArea}</span>
                      <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Perimeter</strong>
                    </div>
                    <div className="avz-isian-nilai-panah">
                      <span className="tabular-nums">{teksPerimeter}</span>
                      <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                    </div>
                  </div>
                </>
              )}

              {/* 3. Baris Lapisan saat ini */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Lapisan saat ini</strong>
                </div>
                <button
                  type="button"
                  className="avz-isian-nilai-panah avz-corak-btn"
                  onClick={() => {
                    if (lapisanList.length > 0 && (onPilihLapisanAktif || onPerbaruiObjek)) {
                      setBukaEditLapisan((v) => !v);
                    } else if (onBukaHalamanLapisan) {
                      onBukaHalamanLapisan();
                    } else {
                      onPesan?.("Buka menu Lapisan untuk mengelola lapisan peta");
                    }
                  }}
                >
                  <span>{namaLapisan}</span>
                  <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="avz-tombol-garis"
                  onClick={() => {
                    if (lapisanList.length > 0 && (onPilihLapisanAktif || onPerbaruiObjek)) {
                      setBukaEditLapisan((v) => !v);
                    } else if (onBukaHalamanLapisan) {
                      onBukaHalamanLapisan();
                    } else {
                      onPesan?.("Buka menu Lapisan untuk mengelola lapisan peta");
                    }
                  }}
                >
                  Edit Lapisan
                </button>
                {bukaEditLapisan && lapisanList.length > 0 && (onPilihLapisanAktif || onPerbaruiObjek) && (
                  <select
                    className="form-input avz-input-bersih"
                    style={{ marginTop: 8 }}
                    value={mode === "draft_pin" ? lapisanAktif?.id ?? "" : objekTerpilih?.lapisanId ?? ""}
                    onChange={(e) => {
                      const idBaru = e.target.value || null;
                      if (mode === "draft_pin") {
                        onPilihLapisanAktif?.(idBaru);
                      } else if (objekTerpilih && onPerbaruiObjek) {
                        const cocok = lapisanList.find((l) => l.id === idBaru);
                        onPerbaruiObjek({
                          ...objekTerpilih,
                          lapisanId: cocok?.id,
                          lapisanNama: cocok?.nama || "Lapisan 1"
                        });
                      } else {
                        onPilihLapisanAktif?.(idBaru);
                      }
                      setBukaEditLapisan(false);
                    }}
                  >
                    <option value="">Lapisan 1 (Bawaan)</option>
                    {lapisanList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nama}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 4. Baris Foto */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Foto</strong>
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    {fotoTampil ? "Edit" : "Tambah"}
                  </button>
                </div>
                {fotoTampil ? (
                  <button
                    type="button"
                    className="avz-isian-nilai-edit"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    <img
                      className="avz-isian-foto"
                      src={fotoTampil}
                      alt={`Foto ${teksNamaTampil}`}
                      style={{ marginTop: 4, maxHeight: 160, objectFit: "cover", borderRadius: 8 }}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="avz-isian-nilai-edit avz-isian-kosong"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    Ketuk untuk menambah foto...
                  </button>
                )}
              </div>

              {/* 5. Baris Deskripsi */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Deskripsi</strong>
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    onClick={() => {
                      if (sedangEditDeskripsi) {
                        simpanEditDeskripsi();
                      } else {
                        setSedangEditDeskripsi(true);
                      }
                    }}
                  >
                    {deskripsiInput.trim() ? "Edit" : "Tambah"}
                  </button>
                </div>
                {sedangEditDeskripsi ? (
                  <div className="avz-inline-edit-col">
                    <textarea
                      rows={3}
                      className="form-input avz-input-bersih"
                      value={deskripsiInput}
                      onChange={(e) => {
                        setDeskripsiInput(e.target.value);
                        if (mode === "draft_pin") onUbahDeskripsiDraft?.(e.target.value);
                      }}
                      placeholder="Catatan atau deskripsi objek..."
                      aria-label="Edit deskripsi"
                      autoFocus
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className="avz-aksi-hijau" onClick={simpanEditDeskripsi}>
                        Selesai
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`avz-isian-nilai-edit ${deskripsiInput.trim() ? "" : "avz-isian-kosong"}`}
                    onClick={() => setSedangEditDeskripsi(true)}
                  >
                    {deskripsiInput.trim() || "Ketuk untuk menambah deskripsi..."}
                  </button>
                )}
              </div>

              {/* 6. Baris Corak */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Corak</strong>
                  <button type="button" className="avz-aksi-hijau" onClick={() => setBukaPilihCorak((v) => !v)}>
                    Edit
                  </button>
                </div>
                <button
                  type="button"
                  className="avz-isian-nilai-panah avz-corak-btn"
                  onClick={() => setBukaPilihCorak((v) => !v)}
                >
                  <span>{corakTerpilih.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {jenisGeo === "polygon" ? (
                      <IkonCorakAreaJingga warna={corakTerpilih.warna} />
                    ) : jenisGeo === "line" ? (
                      <span
                        className="avz-corak-trek-badge"
                        style={{ color: corakTerpilih.warna, borderColor: corakTerpilih.warna }}
                        aria-label={`Simbol trek ${corakTerpilih.label}`}
                      >
                        S
                      </span>
                    ) : (
                      <MapPin size={20} color={corakTerpilih.warna} fill={corakTerpilih.warna} />
                    )}
                    <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                  </div>
                </button>
                {bukaPilihCorak && (
                  <div className="avz-corak-chips" style={{ marginTop: 8 }}>
                    {PILIHAN_WARNA_CORAK.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className={`avz-corak-chip ${corakTerpilih.id === c.id ? "aktif" : ""}`}
                        onClick={() => {
                          setCorakTerpilih(c);
                          setBukaPilihCorak(false);
                          if (mode === "draft_pin") {
                            onUbahCorakDraft?.(c.label, c.warna);
                          } else if (objekTerpilih && onPerbaruiObjek) {
                            onPerbaruiObjek({ ...objekTerpilih, simbol: c.label, warna: c.warna });
                          }
                        }}
                      >
                        <span className="avz-corak-dot" style={{ background: c.warna }} aria-hidden="true" />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 7. Baris Elevasi (untuk Titik dan Jalur) */}
              {jenisGeo !== "polygon" && (
                <div className="avz-isian-baris">
                  <div className="avz-isian-kepala">
                    <strong>{jenisGeo === "point" ? "Elevasi" : "Perolehan elevasi total"}</strong>
                    <button
                      type="button"
                      className="avz-aksi-hijau"
                      onClick={() => {
                        if (sedangEditElevasi) {
                          simpanEditElevasi();
                        } else {
                          setElevasiInput(elevasiVal !== undefined && elevasiVal !== null ? String(elevasiVal) : "");
                          setSedangEditElevasi(true);
                        }
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  {sedangEditElevasi ? (
                    <div className="avz-inline-edit-row">
                      <input
                        type="number"
                        step="any"
                        className="form-input avz-input-bersih tabular-nums"
                        value={elevasiInput}
                        onChange={(e) => {
                          setElevasiInput(e.target.value);
                          if (mode === "draft_pin") onUbahElevasiDraft?.(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            simpanEditElevasi();
                          } else if (e.key === "Escape") {
                            setSedangEditElevasi(false);
                          }
                        }}
                        placeholder="Elevasi (meter)"
                        aria-label="Edit elevasi"
                        autoFocus
                      />
                      <button type="button" className="avz-aksi-hijau" onClick={simpanEditElevasi}>
                        Selesai
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="avz-isian-nilai-edit tabular-nums"
                      onClick={() => {
                        setElevasiInput(elevasiVal !== undefined && elevasiVal !== null ? String(elevasiVal) : "");
                        setSedangEditElevasi(true);
                      }}
                    >
                      {elevasiVal !== undefined && elevasiVal !== null
                        ? `${Number(elevasiVal).toFixed(2).replace(".", ",")} m`
                        : "- - -"}
                    </button>
                  )}
                  {onAmbilElevasiGps && (
                    <button
                      type="button"
                      className="avz-tombol-garis"
                      disabled={sedangUkurGps}
                      onClick={onAmbilElevasiGps}
                    >
                      {sedangUkurGps ? "Mengukur..." : "Ambil elevasi"}
                    </button>
                  )}
                </div>
              )}

              {/* 8. Baris Dibuat (tampil untuk semua jenis: Point, Line, dan Area) */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Dibuat</strong>
                </div>
                <span className="tabular-nums">{formatTgl}</span>
              </div>

              {/* 9. Baris Skema Atribut (tampil untuk semua jenis: Point, Line, dan Area) */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Skema atribut</strong>
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    Edit
                  </button>
                </div>
                {atributEntries.length > 0 ? (
                  <button
                    type="button"
                    className="avz-isian-nilai-edit"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    <div className="avz-atribut-daftar">
                      {atributEntries.map(([kunci, nilai]) => (
                        <div key={kunci} className="avz-atribut-baris">
                          <span className="avz-atribut-kunci">{kunci}</span>
                          <span className="avz-atribut-nilai">{String(nilai)}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="avz-isian-nilai-edit avz-isian-kecil"
                    onClick={() => (mode === "draft_pin" ? onBukaFormLengkap() : onBukaDetailLengkap())}
                  >
                    Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
                  </button>
                )}
              </div>

              {/* 10. Khusus Jalur (Line): Operasi Konversi ke Area */}
              {jenisGeo === "line" && onKonversiKeArea && (
                <div className="avz-isian-baris">
                  <div className="avz-isian-kepala">
                    <strong>Operasi</strong>
                    <span className="avz-lock-yellow" aria-hidden="true">
                      <Lock size={13} color="#ffffff" />
                    </span>
                  </div>
                  <button type="button" className="avz-tombol-garis" onClick={onKonversiKeArea}>
                    Konversikan ke Area
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bilah Tombol Aksi Bawah (Sesuai Screenshot Area, Pin, dan Trek) */}
      <div className="avz-peek-actions" onClick={(e) => e.stopPropagation()}>
        {jenisGeo !== "polygon" && titikUtama && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={() => {
              onGoTo({ lat: titikUtama.lat, lng: titikUtama.lng, judul: judulRingkas });
              onTutup();
            }}
          >
            Navigasi
          </button>
        )}

        <button
          type="button"
          className="avz-pill-outline-btn"
          onClick={() => {
            const teks =
              jenisGeo === "polygon"
                ? `${judulRingkas} — Area ${teksArea}, Perimeter ${teksPerimeter} (${teksKoordinat})`
                : `${judulRingkas} — ${teksKoordinat}`;
            onBagikan(teks);
          }}
        >
          {jenisGeo === "point" ? "Bagikan" : "Beri tahu"}
        </button>

        {mode === "draft_pin" && tahap === "ringkas" && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={handleSimpanAksi}
          >
            Simpan
          </button>
        )}

        {mode === "objek_terpilih" && onHapus && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={() => onHapus(objekTerpilih?.id || "")}
          >
            Hapus
          </button>
        )}
      </div>
    </section>
  );
};
