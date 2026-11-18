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
import { hitungJarakMeter, hitungLuasPoligonHa, hitungPanjangGarisKm } from "../../lib/geoUtils";

export type TahapPeek = "ringkas" | "sedang" | "penuh";

const PILIHAN_WARNA_CORAK = [
  { id: "merah", warna: "#ef4444", label: "Pin Merah" },
  { id: "biru", warna: "#0284c7", label: "Pin Biru" },
  { id: "zamrud", warna: "#0d7344", label: "Pin Hijau" },
  { id: "jingga", warna: "#f26101", label: "Jingga jejak" },
  { id: "jingga_area", warna: "#f26101", label: "Jingga area" },
  { id: "kuning", warna: "#eab308", label: "Pin Kuning" },
  { id: "ungu", warna: "#a855f7", label: "Pin Ungu" }
];

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
  onSimpanLangsung?: (nama: string, simbol?: string, warna?: string) => void;
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
  onSimpanLangsung
}) => {
  const [tahap, setTahap] = useState<TahapPeek>(tahapAwal);
  const [sedangSeret, setSedangSeret] = useState(false);
  const [namaInput, setNamaInput] = useState(mode === "draft_pin" ? "Tanda tempat 1" : objekTerpilih?.judul || "");
  const [sedangEditNama, setSedangEditNama] = useState(false);
  const [bukaEditLapisan, setBukaEditLapisan] = useState(false);
  const [bukaPilihCorak, setBukaPilihCorak] = useState(false);
  const [corakTerpilih, setCorakTerpilih] = useState(() => {
    if (mode === "objek_terpilih" && objekTerpilih?.jenisGeometri === "polygon") {
      return PILIHAN_WARNA_CORAK[4];
    }
    if (mode === "objek_terpilih" && objekTerpilih?.jenisGeometri === "line") {
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
    mode === "draft_pin"
      ? (elevasiMeter ?? titikUtama?.elevasi)
      : (objekTerpilih?.elevasi ?? titikUtama?.elevasi);

  const tglDibuat = objekTerpilih?.createdAt ? new Date(objekTerpilih.createdAt) : new Date();
  const formatTgl = `${String(tglDibuat.getDate()).padStart(2, "0")}/${String(tglDibuat.getMonth() + 1).padStart(2, "0")}/${String(tglDibuat.getFullYear()).slice(-2)} pada ${String(tglDibuat.getHours()).padStart(2, "0")}.${String(tglDibuat.getMinutes()).padStart(2, "0")}`;

  const atributEntries = Object.entries(objekTerpilih?.atributKustom ?? {}).filter(([, val]) => String(val ?? "").trim() !== "");

  const handleSimpanAksi = () => {
    if (onSimpanLangsung) {
      onSimpanLangsung(namaInput, corakTerpilih.label, corakTerpilih.warna);
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
          {mode === "draft_pin" ? (
            <button
              type="button"
              className="avz-peek-btn-centang"
              aria-label="Simpan pin tanda tempat"
              onClick={handleSimpanAksi}
            >
              <Check size={24} color="#0d7344" />
            </button>
          ) : (
            <div style={{ width: 36 }} aria-hidden="true" />
          )}
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
                      if (mode === "draft_pin") {
                        setSedangEditNama((v) => !v);
                      } else {
                        onBukaDetailLengkap();
                      }
                    }}
                  >
                    Edit
                  </button>
                </div>
                {sedangEditNama ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <input
                      type="text"
                      className="form-input avz-input-bersih"
                      value={namaInput}
                      onChange={(e) => setNamaInput(e.target.value)}
                      placeholder="Nama tanda tempat..."
                      autoFocus
                    />
                    <button
                      type="button"
                      className="avz-aksi-hijau"
                      onClick={() => setSedangEditNama(false)}
                    >
                      Selesai
                    </button>
                  </div>
                ) : (
                  <span>{namaInput || (mode === "draft_pin" ? "Tanda tempat 1" : objekTerpilih?.judul)}</span>
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
                        void navigator.clipboard?.writeText(teksKoordinat);
                        onPesan?.("Koordinat disalin: " + teksKoordinat);
                      }}
                    >
                      Salin
                    </button>
                  </div>
                  <span className="tabular-nums">{teksKoordinat}</span>
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
                <div className="avz-isian-nilai-panah">
                  <span>{namaLapisan}</span>
                  <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  className="avz-tombol-garis"
                  onClick={() => {
                    if (lapisanList.length > 0 && onPilihLapisanAktif) {
                      setBukaEditLapisan((v) => !v);
                    } else {
                      onPesan?.("Buka menu Lapisan untuk mengelola lapisan peta");
                    }
                  }}
                >
                  Edit Lapisan
                </button>
                {bukaEditLapisan && lapisanList.length > 0 && onPilihLapisanAktif && (
                  <select
                    className="form-input"
                    style={{ marginTop: 8 }}
                    value={lapisanAktif?.id ?? ""}
                    onChange={(e) => {
                      onPilihLapisanAktif(e.target.value || null);
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
                    onClick={() => onBukaFormLengkap()}
                  >
                    Tambah
                  </button>
                </div>
                {objekTerpilih?.fotoBase64 && (
                  <img
                    className="avz-isian-foto"
                    src={objekTerpilih.fotoBase64}
                    alt={`Foto ${namaInput}`}
                    style={{ marginTop: 6, maxHeight: 160, objectFit: "cover", borderRadius: 8 }}
                  />
                )}
              </div>

              {/* 5. Baris Deskripsi */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Deskripsi</strong>
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    onClick={() => onBukaFormLengkap()}
                  >
                    Tambah
                  </button>
                </div>
                {objekTerpilih?.deskripsi ? (
                  <span>{objekTerpilih.deskripsi}</span>
                ) : null}
              </div>

              {/* 6. Baris Corak */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Corak</strong>
                </div>
                <div
                  className="avz-isian-nilai-panah"
                  style={{ cursor: "pointer" }}
                  onClick={() => setBukaPilihCorak((v) => !v)}
                >
                  <span>
                    {jenisGeo === "polygon"
                      ? objekTerpilih?.simbol || "Jingga area"
                      : jenisGeo === "line"
                        ? objekTerpilih?.simbol || "Jingga jejak"
                        : corakTerpilih.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {jenisGeo === "polygon" ? (
                      <IkonCorakAreaJingga warna={objekTerpilih?.warna || corakTerpilih.warna} />
                    ) : jenisGeo === "line" ? (
                      <span className="avz-corak-trek-badge" aria-label="Simbol trek jingga">
                        S
                      </span>
                    ) : (
                      <MapPin size={20} color={corakTerpilih.warna} fill={corakTerpilih.warna} />
                    )}
                    <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                  </div>
                </div>
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
                    {jenisGeo === "point" && onAmbilElevasiGps && (
                      <button
                        type="button"
                        className="avz-aksi-hijau"
                        onClick={() => onAmbilElevasiGps()}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <span className="tabular-nums">
                    {elevasiVal !== undefined && elevasiVal !== null
                      ? `${Number(elevasiVal).toFixed(2).replace(".", ",")} m`
                      : "- - -"}
                  </span>
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
                  <div className="avz-atribut-daftar">
                    {atributEntries.map(([kunci, nilai]) => (
                      <div key={kunci} className="avz-atribut-baris">
                        <span className="avz-atribut-kunci">{kunci}</span>
                        <span className="avz-atribut-nilai">{String(nilai)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="avz-isian-kecil">
                    Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
                  </span>
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
