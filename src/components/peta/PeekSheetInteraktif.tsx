import React, { useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MapPin,
  Route,
  Hexagon,
  Layers,
  Trash2,
  Navigation,
  Share2,
  Lock,
  Check,
  Edit3
} from "lucide-react";
import { DataSpasialItem, KoordinatTitik, LapisanSpasial } from "../../types";

export type TahapPeek = "ringkas" | "sedang" | "penuh";

const PILIHAN_WARNA_CORAK = [
  { id: "merah", warna: "#ef4444", label: "Pin Merah" },
  { id: "biru", warna: "#0284c7", label: "Pin Biru" },
  { id: "zamrud", warna: "#0d7344", label: "Pin Hijau" },
  { id: "jingga", warna: "#f26101", label: "Jingga jejak" },
  { id: "kuning", warna: "#eab308", label: "Pin Kuning" },
  { id: "ungu", warna: "#a855f7", label: "Pin Ungu" }
];

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

/**
 * Komponen Peek Card interaktif bawah peta (ala Avenza Maps)
 * dengan fitur swap ke atas bertahap (ringkas -> sedang -> penuh)
 * yang halus di mode HP maupun PC dan memenuhi layar interaktif pada PC.
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
  const [corakTerpilih, setCorakTerpilih] = useState(
    mode === "objek_terpilih" && objekTerpilih?.jenisGeometri === "line"
      ? PILIHAN_WARNA_CORAK[3]
      : PILIHAN_WARNA_CORAK[0]
  );

  const sheetRef = useRef<HTMLElement | null>(null);
  const seretAwalRef = useRef<{ y: number; time: number; tinggiAwal: number } | null>(null);
  const totalGeserRef = useRef(0);

  useEffect(() => {
    onTahapChange?.(tahap);
  }, [tahap, onTahapChange]);

  const gantiTahap = (tahapBaru: TahapPeek) => {
    setTahap(tahapBaru);
    if (tahapBaru === "penuh") {
      if (mode === "draft_pin") {
        onBukaFormLengkap();
      } else {
        onBukaDetailLengkap();
      }
    }
  };

  // Handler Drag halus Touch dan Pointer (berlaku di HP dan PC)
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

    // Batasi translasi agar tidak melompat liar
    const clampedDy = Math.max(-360, Math.min(180, dy));
    sheetRef.current.style.transform = `translateY(${clampedDy}px)`;
  };

  const selesaikanSeret = () => {
    if (!seretAwalRef.current || !sheetRef.current) return;
    const dy = totalGeserRef.current;
    const dt = Math.max(20, Date.now() - seretAwalRef.current.time);
    const v = dy / dt; // negatif = naik, positif = turun

    // Bersihkan inline style transform dengan transisi halus
    sheetRef.current.style.transform = "";
    setSedangSeret(false);
    seretAwalRef.current = null;

    // Ambang gestur swipe naik atau turun
    const naik = dy < -30 || v < -0.38;
    const turun = dy > 30 || v > 0.38;

    if (naik) {
      if (tahap === "ringkas") {
        gantiTahap("sedang");
      } else if (tahap === "sedang") {
        gantiTahap("penuh");
      }
    } else if (turun) {
      if (tahap === "sedang") {
        gantiTahap("ringkas");
      } else if (tahap === "ringkas" && dy > 80) {
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
  const judulTipe = jenisGeo === "point" ? "Pin dijatuhkan" : jenisGeo === "line" ? "Trek" : "Area";
  const judulRingkas = mode === "draft_pin" ? "Pin dijatuhkan" : objekTerpilih?.judul || "Objek Peta";

  const ukuranTeks =
    jenisGeo === "point"
      ? teksKoordinat
      : jenisGeo === "line"
        ? `${(objekTerpilih?.panjangKm || 120.17).toFixed(2).replace(".", ",")} km`
        : `${(objekTerpilih?.luasHa || 0).toFixed(2).replace(".", ",")} Ha`;

  const elevasiVal =
    mode === "draft_pin"
      ? (elevasiMeter ?? titikUtama?.elevasi ?? 640.23)
      : (objekTerpilih?.elevasi ?? titikUtama?.elevasi);

  const tglDibuat = objekTerpilih?.createdAt ? new Date(objekTerpilih.createdAt) : new Date();
  const formatTgl = `${String(tglDibuat.getDate()).padStart(2, "0")}/${String(tglDibuat.getMonth() + 1).padStart(2, "0")}/${String(tglDibuat.getFullYear()).slice(-2)} pada ${String(tglDibuat.getHours()).padStart(2, "0")}.${String(tglDibuat.getMinutes()).padStart(2, "0")}`;

  const handleSimpanAksi = () => {
    if (onSimpanLangsung) {
      onSimpanLangsung(namaInput, corakTerpilih.label, corakTerpilih.warna);
    } else {
      onBukaFormLengkap();
    }
  };

  return (
    <section
      ref={sheetRef}
      className={`avz-peek-card tahap-${tahap} ${sedangSeret ? "sedang-seret" : ""} ${mode === "objek_terpilih" ? "field-inspector-sheet" : ""}`}
      role="dialog"
      aria-label={judulRingkas}
    >
      {/* Tampilan Kepala Mode Detail (Sedang atau Penuh) */}
      {tahap !== "ringkas" ? (
        <header className="avz-peek-full-header" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="avz-peek-btn-kembali"
            aria-label="Ciutkan kartu ke mode ringkas"
            onClick={() => gantiTahap("ringkas")}
          >
            <ChevronDown size={26} color="#1e293b" />
          </button>
          <h2 className="avz-peek-header-title">{judulTipe}</h2>
          {mode === "draft_pin" || jenisGeo === "point" ? (
            <button
              type="button"
              className="avz-peek-btn-centang"
              aria-label="Simpan pin tanda tempat"
              onClick={handleSimpanAksi}
            >
              <Check size={26} color="#0d7344" />
            </button>
          ) : (
            <div style={{ width: 36 }} aria-hidden="true" />
          )}
        </header>
      ) : (
        /* Handle Pegangan dengan Gestur Swipe Ke Atas / Bawah pada Mode Ringkas */
        <div
          className="avz-peek-handle"
          tabIndex={0}
          role="button"
          aria-label={`Tahap panel ${tahap}. Geser ke atas untuk detail, geser ke bawah untuk menutup.`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            mulaiSeret(e.clientY);
          }}
          onPointerMove={(e) => {
            if (seretAwalRef.current) lakukanSeret(e.clientY);
          }}
          onPointerUp={() => selesaikanSeret()}
          onPointerCancel={() => selesaikanSeret()}
          onTouchStart={(e) => {
            if (e.touches[0]) mulaiSeret(e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) lakukanSeret(e.touches[0].clientY);
          }}
          onTouchEnd={() => selesaikanSeret()}
          onClick={(e) => {
            if (Math.abs(totalGeserRef.current) < 10) {
              e.stopPropagation();
              gantiTahap("sedang");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              gantiTahap("sedang");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onTutup();
            }
          }}
        >
          <span className="avz-peek-grip-bar" aria-hidden="true" />
          <div className="avz-peek-hint-row">
            <span className="avz-peek-hint-text">
              <ChevronUp size={14} aria-hidden="true" /> Geser ke atas untuk keterangan lainnya
            </span>
            <div className="avz-peek-dots" aria-hidden="true">
              <span className="dot aktif" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        </div>
      )}

      {/* Bagian Isi Utama */}
      <div
        className="avz-peek-body"
        onClick={() => {
          if (tahap === "ringkas") gantiTahap("sedang");
        }}
      >
        {/* Ringkasan Mode Ringkas (Sesuai Screenshot 2 dan 4) */}
        {tahap === "ringkas" && (
          <div className="avz-peek-header-summary">
            <h2 className="avz-peek-title">{judulRingkas}</h2>

            <div className="avz-peek-meta-row">
              {jenisGeo === "point" ? (
                <MapPin size={18} color="#5f6368" aria-hidden="true" />
              ) : jenisGeo === "line" ? (
                <Route size={18} color="#5f6368" aria-hidden="true" />
              ) : (
                <Hexagon size={18} color="#5f6368" aria-hidden="true" />
              )}
              <span className="tabular-nums">{ukuranTeks}</span>
            </div>

            <div className="avz-peek-meta-row">
              <Layers size={18} color="#5f6368" aria-hidden="true" />
              <span>{namaLapisan}</span>
            </div>
          </div>
        )}

        {/* Keterangan Lainnya Lengkap (Sesuai Screenshot 1 dan 3 saat Diswap ke Atas) */}
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

              {/* 2. Baris Koordinat (Titik) atau Jarak (Trek) */}
              {jenisGeo === "point" ? (
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
                      Edit
                    </button>
                  </div>
                  <span className="tabular-nums">{teksKoordinat}</span>
                </div>
              ) : (
                <div className="avz-isian-baris">
                  <div className="avz-isian-kepala">
                    <strong>Jarak</strong>
                  </div>
                  <div className="avz-isian-nilai-panah">
                    <span className="tabular-nums">{ukuranTeks}</span>
                    <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                  </div>
                </div>
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
                    {jenisGeo === "line"
                      ? "Jingga jejak"
                      : corakTerpilih.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {jenisGeo === "line" ? (
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

              {/* 7. Baris Elevasi / Perolehan elevasi total */}
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>{jenisGeo === "point" ? "Elevasi" : "Perolehan elevasi total"}</strong>
                  {jenisGeo === "point" && (
                    <button
                      type="button"
                      className="avz-aksi-hijau"
                      onClick={() => onAmbilElevasiGps?.()}
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
                <button
                  type="button"
                  className="avz-tombol-garis"
                  disabled={sedangUkurGps}
                  onClick={onAmbilElevasiGps}
                >
                  {sedangUkurGps ? "Mengukur..." : "Ambil elevasi"}
                </button>
              </div>

              {/* 8. Khusus Titik: Baris Dibuat dan Skema Atribut */}
              {jenisGeo === "point" && (
                <>
                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Dibuat</strong>
                    </div>
                    <span className="tabular-nums">{formatTgl}</span>
                  </div>

                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Skema atribut</strong>
                      <button
                        type="button"
                        className="avz-aksi-hijau"
                        onClick={() => onBukaFormLengkap()}
                      >
                        Edit
                      </button>
                    </div>
                    <span className="avz-isian-kecil">
                      Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
                    </span>
                  </div>
                </>
              )}

              {/* 9. Khusus Trek: Tampilkan Grafik dan Operasi Konversi */}
              {jenisGeo === "line" && (
                <>
                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Tampilkan Grafik</strong>
                    </div>
                    <div className="avz-isian-nilai-panah">
                      <span className="tabular-nums">Dist: {ukuranTeks} | 00:39:59</span>
                      <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="avz-isian-baris">
                    <div className="avz-isian-kepala">
                      <strong>Operasi</strong>
                      <span className="avz-lock-yellow" aria-label="Fitur terkunci">
                        <Lock size={13} color="#ffffff" aria-hidden="true" />
                      </span>
                    </div>
                    {onKonversiKeArea && (
                      <button type="button" className="avz-tombol-garis" onClick={onKonversiKeArea}>
                        Konversikan ke Area
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bilah Tombol Aksi Kaki (Sesuai Screenshot 1, 2, 3, dan 4) */}
      <div className="avz-peek-actions" onClick={(e) => e.stopPropagation()}>
        {titikUtama && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={() => {
              onGoTo({ lat: titikUtama.lat, lng: titikUtama.lng, judul: judulRingkas });
              onTutup();
            }}
          >
            <Navigation size={15} style={{ marginRight: 4 }} />
            Navigasi
          </button>
        )}

        <button
          type="button"
          className="avz-pill-outline-btn"
          onClick={() => {
            const teks = `${judulRingkas} — ${teksKoordinat}`;
            onBagikan(teks);
          }}
        >
          <Share2 size={15} style={{ marginRight: 4 }} />
          {jenisGeo === "line" ? "Beri tahu" : "Bagikan"}
        </button>

        {/* Di mode ringkas pin: Navigasi, Bagikan, Simpan. Di mode detail pin: hanya Navigasi dan Bagikan */}
        {tahap === "ringkas" && mode === "draft_pin" && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={handleSimpanAksi}
          >
            Simpan
          </button>
        )}

        {/* Pada Trek: tombol Hapus jika callback tersedia */}
        {jenisGeo === "line" && onHapus && (
          <button
            type="button"
            className="avz-pill-outline-btn"
            onClick={() => onHapus(objekTerpilih?.id || "")}
          >
            <Trash2 size={15} style={{ marginRight: 4 }} />
            Hapus
          </button>
        )}
      </div>
    </section>
  );
};
