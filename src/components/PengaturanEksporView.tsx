import React, { useMemo, useState } from "react";
import { AreaPetaOffline, DataSpasialItem, JenisGeometri, LapisanSpasial } from "../types";
import {
  eksporGeoJsonDenganOpsi,
  eksporKmlDenganOpsi,
  filterDataUntukEkspor,
  KonteksEkspor
} from "../lib/eksporFilter";
import { buatArsipZip, eksporPaketShapefile } from "../lib/shapefile";
import {
  ArrowLeft,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  FileText,
  HardDrive,
  Mail,
  MessageCircle,
  Send,
  Share,
  Share2,
  X
} from "lucide-react";
import { useTombolEsc } from "../lib/useTombolEsc";

export type FormatEksporSederhana = "kml" | "geojson" | "shp_zip";
export type PilihanGeometriEkspor = "semua" | JenisGeometri;

const OPSI_GEOMETRI_EKSPOR: { id: PilihanGeometriEkspor; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "point", label: "Point" },
  { id: "line", label: "Line" },
  { id: "polygon", label: "Polygon" }
];

interface PengaturanEksporViewProps {
  dataSpasial: DataSpasialItem[];
  lapisanList?: LapisanSpasial[];
  areaOffline?: AreaPetaOffline[];
  konteksEkspor?: KonteksEkspor | null;
  onTutup: () => void;
}

interface PaketSiapBagikan {
  namaBerkas: string;
  mimeType: string;
  blob: Blob;
  ringkasTeks: string;
  isiTeks?: string;
  ukuranKb: number;
  jumlahObjek: number;
}

const OPSI_FORMAT: { id: FormatEksporSederhana; label: string; ekstensi: string }[] = [
  { id: "kml", label: "KML", ekstensi: ".kml" },
  { id: "geojson", label: "GeoJSON", ekstensi: ".geojson" },
  { id: "shp_zip", label: "SHP (.zip)", ekstensi: ".zip" }
];

function unduhDariBlob(namaFile: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Halaman ekspor sederhana dengan 3 pilihan format standar WebGIS: KML, GeoJSON, dan SHP (.zip). */
export const PengaturanEksporView: React.FC<PengaturanEksporViewProps> = ({
  dataSpasial,
  lapisanList = [],
  konteksEkspor = null,
  onTutup
}) => {
  const [paketBagikan, setPaketBagikan] = useState<PaketSiapBagikan | null>(null);
  useTombolEsc(true, () => {
    if (paketBagikan) setPaketBagikan(null);
    else onTutup();
  });

  const [namaFile, setNamaFile] = useState(
    () =>
      konteksEkspor?.lapisanDipilih?.[0]?.nama ||
      konteksEkspor?.petaDipilih?.[0]?.namaArea ||
      "Lapisan 1"
  );
  const adaKonteksTerpilih = Boolean(
    konteksEkspor?.petaDipilih?.length || konteksEkspor?.lapisanDipilih?.length || konteksEkspor?.fiturTerpilihIds?.length
  );
  const [formatFile, setFormatFile] = useState<FormatEksporSederhana>("geojson");
  const [filterGeometri, setFilterGeometri] = useState<PilihanGeometriEkspor>("semua");
  const [filterLapisan, setFilterLapisan] = useState<string>("");
  const [statusEkspor, setStatusEkspor] = useState<string>("");
  const [pesanBagikan, setPesanBagikan] = useState<string>("");

  const opsiLapisan = useMemo(() => {
    const setNama = new Set<string>();
    lapisanList.forEach((l) => {
      if (l.nama?.trim() && l.nama.trim() !== "Lapisan 1") setNama.add(l.nama.trim());
    });
    dataSpasial.forEach((d) => {
      if (d.tematik?.trim()) setNama.add(d.tematik.trim());
      if (d.lapisanNama?.trim() && d.lapisanNama.trim() !== "Lapisan 1") {
        setNama.add(d.lapisanNama.trim());
      }
    });
    return [...setNama].sort((a, b) => a.localeCompare(b, "id"));
  }, [dataSpasial, lapisanList]);

  const dataSebelumGeometri = useMemo(
    () =>
      filterDataUntukEkspor(dataSpasial, {
        jenisData: adaKonteksTerpilih ? "Semua fitur terpilih" : "Hanya lapisan",
        konteks: konteksEkspor ?? undefined,
        sertakanFoto: true,
        sertakanMemo: true,
        sertakanTematik: true,
        filterTematik: filterLapisan
      }),
    [dataSpasial, adaKonteksTerpilih, konteksEkspor, filterLapisan]
  );

  const jumlahPerGeometri = useMemo(() => {
    let point = 0;
    let line = 0;
    let polygon = 0;
    for (const item of dataSebelumGeometri) {
      if (item.jenisGeometri === "point") point += 1;
      else if (item.jenisGeometri === "line") line += 1;
      else if (item.jenisGeometri === "polygon") polygon += 1;
    }
    return { semua: dataSebelumGeometri.length, point, line, polygon };
  }, [dataSebelumGeometri]);

  const dataTersaring = useMemo(
    () =>
      filterGeometri === "semua"
        ? dataSebelumGeometri
        : dataSebelumGeometri.filter((item) => item.jenisGeometri === filterGeometri),
    [dataSebelumGeometri, filterGeometri]
  );

  const handleEksporSekarang = () => {
    const namaBersih = (namaFile.trim() || "Lapisan_1").replace(/\s+/g, "_");
    if (dataTersaring.length === 0) {
      setStatusEkspor("Belum ada data untuk diekspor.");
      return;
    }

    let namaBerkas: string;
    let mimeType: string;
    let blob: Blob;
    let isiTeks: string | undefined;

    if (formatFile === "kml") {
      namaBerkas = `${namaBersih}.kml`;
      mimeType = "application/vnd.google-earth.kml+xml";
      isiTeks = eksporKmlDenganOpsi(dataTersaring, [], false);
      blob = new Blob([isiTeks], { type: mimeType });
    } else if (formatFile === "geojson") {
      namaBerkas = `${namaBersih}.geojson`;
      mimeType = "application/geo+json";
      isiTeks = eksporGeoJsonDenganOpsi(dataTersaring, [], false);
      blob = new Blob([isiTeks], { type: mimeType });
    } else {
      const berkasPaket = eksporPaketShapefile(dataTersaring, namaBersih, [], false);
      const arsipZip = buatArsipZip(berkasPaket);
      namaBerkas = `${namaBersih}_shp.zip`;
      mimeType = "application/zip";
      blob = new Blob([new Uint8Array(arsipZip)], { type: mimeType });
    }

    unduhDariBlob(namaBerkas, blob);
    setStatusEkspor(`Berhasil mengekspor ${dataTersaring.length} objek ke ${namaBerkas}`);
    setPesanBagikan("");
    setPaketBagikan({
      namaBerkas,
      mimeType,
      blob,
      isiTeks,
      ukuranKb: Math.max(1, Math.round(blob.size / 1024)),
      jumlahObjek: dataTersaring.length,
      ringkasTeks: `Data survei Titik Tapak: ${namaBerkas} (${dataTersaring.length} objek)`
    });
  };

  const bagikanViaSistem = async () => {
    if (!paketBagikan) return;
    try {
      const file = new File([paketBagikan.blob], paketBagikan.namaBerkas, { type: paketBagikan.mimeType });
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: paketBagikan.namaBerkas,
            text: paketBagikan.ringkasTeks
          });
          setPesanBagikan("Berkas berhasil dibagikan.");
          return;
        }
        await navigator.share({
          title: paketBagikan.namaBerkas,
          text: paketBagikan.ringkasTeks
        });
        setPesanBagikan("Informasi dibagikan. Berkas sudah tersimpan di folder Unduhan.");
        return;
      }
      setPesanBagikan("Gunakan pilihan aplikasi di bawah atau berkas yang baru diunduh.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setPesanBagikan("Gagal membuka dialog bagikan. Berkas sudah tersimpan di perangkat Anda.");
      }
    }
  };

  const bukaPlatformSosial = (url: string, namaPlatform: string) => {
    if (!paketBagikan) return;
    unduhDariBlob(paketBagikan.namaBerkas, paketBagikan.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setPesanBagikan(`${paketBagikan.namaBerkas} siap dilampirkan ke ${namaPlatform}.`);
  };

  const salinRingkasanAtauIsi = async () => {
    if (!paketBagikan) return;
    try {
      await navigator.clipboard.writeText(paketBagikan.isiTeks || paketBagikan.ringkasTeks);
      setPesanBagikan("Data disalin ke papan klip.");
    } catch {
      setPesanBagikan("Gagal menyalin ke papan klip.");
    }
  };

  return (
    <div className="avenza-fullpage-overlay">
      <header className="avenza-subpage-header">
        <div className="avenza-subpage-left">
          <button type="button" className="avenza-back-btn" onClick={onTutup} title="Kembali">
            <ArrowLeft size={24} />
          </button>
          <h2>Ekspor Data</h2>
        </div>
      </header>

      <div className="avenza-export-body">
        <section className="avenza-export-section">
          <div className="avenza-section-title">Nama file</div>
          <div className="avenza-outlined-field ekspor-nama-field">
            <span className="avenza-floating-label">Nama</span>
            <input type="text" value={namaFile} onChange={(e) => setNamaFile(e.target.value)} placeholder="Lapisan 1" />
          </div>
        </section>

        {!adaKonteksTerpilih && opsiLapisan.length > 0 && (
          <section className="avenza-export-section">
            <div className="avenza-outlined-field select-field ekspor-nama-field">
              <span className="avenza-floating-label">Lapisan</span>
              <select
                aria-label="Pilih lapisan ekspor"
                value={filterLapisan}
                onChange={(e) => {
                  setFilterLapisan(e.target.value);
                  setStatusEkspor("");
                }}
              >
                <option value="">Semua data ({dataSpasial.length})</option>
                {opsiLapisan.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="avenza-select-arrow" />
            </div>
          </section>
        )}

        <section className="avenza-export-section">
          <div className="avenza-section-title">Tipe data</div>
          <div className="avenza-format-chips ekspor-geometri-chips" role="group" aria-label="Pilih tipe data ekspor">
            {OPSI_GEOMETRI_EKSPOR.map((opsi) => (
              <button
                key={opsi.id}
                type="button"
                aria-pressed={filterGeometri === opsi.id}
                className={`avenza-format-chip ${filterGeometri === opsi.id ? "active" : ""}`}
                onClick={() => {
                  setFilterGeometri(opsi.id);
                  setStatusEkspor("");
                }}
              >
                <span>{opsi.label}</span>
                <span className="ekspor-chip-count">{jumlahPerGeometri[opsi.id]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="avenza-export-section">
          <div className="avenza-section-title">Format data</div>
          <div className="avenza-format-chips ekspor-format-sederhana" role="group" aria-label="Pilih format ekspor">
            {OPSI_FORMAT.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                aria-pressed={formatFile === fmt.id}
                className={`avenza-format-chip ${formatFile === fmt.id ? "active" : ""}`}
                onClick={() => {
                  setFormatFile(fmt.id);
                  setStatusEkspor("");
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
          <div className="avenza-field-helper">
            {dataTersaring.length} objek siap diekspor
            {filterGeometri !== "semua" ? ` (${OPSI_GEOMETRI_EKSPOR.find((o) => o.id === filterGeometri)?.label})` : ""}
          </div>
        </section>

        <section className="avenza-export-section">
          <button
            type="button"
            className="btn-primary ekspor-btn-utama"
            onClick={handleEksporSekarang}
            disabled={dataTersaring.length === 0}
          >
            <Download size={18} /> Ekspor {OPSI_FORMAT.find((f) => f.id === formatFile)?.label}
          </button>

          {statusEkspor && (
            <div className="avenza-export-sub" role="status" style={{ padding: "8px 4px", fontWeight: 700, color: "#0d7344" }}>
              {statusEkspor}
            </div>
          )}
        </section>
      </div>

      <button type="button" className="avenza-fab-orange export-fab" onClick={handleEksporSekarang} title="Ekspor sekarang">
        <Share size={24} />
      </button>

      {paketBagikan && (
        <div className="modal-backdrop avz-share-backdrop" onClick={() => setPaketBagikan(null)}>
          <div
            className="avz-share-sheet"
            role="dialog"
            aria-label="Bagikan Data Ekspor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="avz-share-head">
              <strong>Siap dibagikan</strong>
              <button type="button" className="btn-icon-close" aria-label="Tutup bagikan" onClick={() => setPaketBagikan(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="avz-share-file-card">
              <div className="avz-share-file-icon">
                <FileText size={20} />
              </div>
              <div className="avz-share-file-meta">
                <strong>{paketBagikan.namaBerkas}</strong>
                <span>
                  {paketBagikan.ukuranKb} KB · {paketBagikan.jumlahObjek} objek
                </span>
              </div>
            </div>

            <button type="button" className="btn-primary avz-share-native-btn" onClick={() => void bagikanViaSistem()}>
              <Share2 size={18} /> Bagikan via Aplikasi Perangkat
            </button>

            <div className="avz-share-grid" role="group" aria-label="Bagikan ke platform">
              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(`https://wa.me/?text=${encodeURIComponent(paketBagikan.ringkasTeks)}`, "WhatsApp")
                }
              >
                <span className="avz-share-app-ico wa">
                  <MessageCircle size={20} />
                </span>
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() => bukaPlatformSosial("https://drive.google.com/drive/my-drive", "Google Drive")}
              >
                <span className="avz-share-app-ico drive">
                  <HardDrive size={20} />
                </span>
                <span>Drive</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(
                    `mailto:?subject=${encodeURIComponent(`Data Spasial: ${paketBagikan.namaBerkas}`)}&body=${encodeURIComponent(
                      paketBagikan.ringkasTeks
                    )}`,
                    "Gmail"
                  )
                }
              >
                <span className="avz-share-app-ico mail">
                  <Mail size={20} />
                </span>
                <span>Gmail</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() =>
                  bukaPlatformSosial(
                    `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(
                      paketBagikan.ringkasTeks
                    )}`,
                    "Telegram"
                  )
                }
              >
                <span className="avz-share-app-ico tg">
                  <Send size={20} />
                </span>
                <span>Telegram</span>
              </button>

              <button
                type="button"
                className="avz-share-app"
                onClick={() => bukaPlatformSosial("https://onedrive.live.com/", "OneDrive")}
              >
                <span className="avz-share-app-ico cloud">
                  <Cloud size={20} />
                </span>
                <span>OneDrive</span>
              </button>

              <button type="button" className="avz-share-app" onClick={() => unduhDariBlob(paketBagikan.namaBerkas, paketBagikan.blob)}>
                <span className="avz-share-app-ico dl">
                  <Download size={20} />
                </span>
                <span>Simpan</span>
              </button>

              <button type="button" className="avz-share-app" onClick={() => void salinRingkasanAtauIsi()}>
                <span className="avz-share-app-ico cp">
                  <Copy size={20} />
                </span>
                <span>Salin</span>
              </button>
            </div>

            {pesanBagikan && (
              <p className="avz-share-msg" role="status">
                {pesanBagikan}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
