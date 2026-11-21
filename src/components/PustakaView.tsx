import React, { useCallback, useMemo, useState } from "react";
import { AreaPetaOffline, DataSpasialItem, JenisGeometri, LapisanSpasial } from "../types";
import { AkunSesi } from "../lib/auth";
import { buatId } from "../lib/id";
import { LatarPetaDasar } from "./LatarPetaDasar";
import {
  LayoutGrid,
  List,
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  FileUp,
  Filter,
  Layers,
  Loader2,
  Map as MapIcon,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  X
} from "lucide-react";
import { HasilMetadataPeta, bacaMetadataBerkasPeta, hitungJarakReferensiKm, formatAngkaKoma } from "../lib/metaPeta";
import { bacaPosisiPeta, POSISI_AWAL_PETA } from "../lib/posisiPeta";
import { simpanArsipPeta } from "../lib/penyimpananPetaLuring";
import { daftarkanSumberPmtiles } from "../lib/pmtilesProtocol";
import { daftarkanSumberMbtiles } from "../lib/mbtilesProtocol";
import { singkatkanLabelPeta, ringkasLabelCrs } from "../lib/labelPeta";
import { objekCocokLapisan } from "../lib/tematik";
import { hitungRingkasSkema } from "../lib/skemaTugas";
import { useTombolEsc } from "../lib/useTombolEsc";
import { KonteksEkspor } from "../lib/eksporFilter";
import { HasilParse, OpsiImporBerkas, parseBerkas } from "../lib/impor";

interface PustakaViewProps {
  areaOffline: AreaPetaOffline[];
  lapisanList: LapisanSpasial[];
  dataSpasial: DataSpasialItem[];
  sesiPengguna?: AkunSesi | null;
  modePilihAktif: boolean;
  onMatikanModePilih: () => void;
  onBukaPetaDasar: () => void;
  onBukaLapisanDiPeta?: (lapisan: LapisanSpasial) => void;
  onBukaAreaPeta: (area: AreaPetaOffline) => void;
  onTambahAreaOffline: (area: AreaPetaOffline) => void;
  onHapusAreaOffline: (id: string) => void;
  onTambahLapisan?: (lapisan: LapisanSpasial) => void;
  onHapusLapisan: (id: string) => void;
  onImporBerkas?: (namaBerkas: string, isi: string, opsi?: OpsiImporBerkas) => boolean;
  onBukaPengaturanEkspor: (konteks?: KonteksEkspor) => void;
}

/**
 * Komponen thumbnail netral dokumen peta georeferensi.
 */
export const ThumbnailDokumenPeta: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "8px",
      background: "#f1f5f9",
      border: "1px solid #cbd5e1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#059669",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      flexShrink: 0
    }}
    aria-label="Dokumen Lembar Peta"
  >
    <MapIcon size={Math.round(size * 0.46)} />
  </div>
);


function ambilUrlGambarThumbnail(item: { thumbnailUrl?: string; thumbnailDataUrl?: string; petaKustomDataUrl?: string; petaKustomUrl?: string }): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.thumbnailDataUrl) return item.thumbnailDataUrl;
  if (item.petaKustomDataUrl) return item.petaKustomDataUrl;
  if (item.petaKustomUrl && !item.petaKustomUrl.startsWith("pmtiles://") && !item.petaKustomUrl.startsWith("mbtiles://")) {
    return item.petaKustomUrl;
  }
  return null;
}

function buatPratinjauRasterGeotiff(meta: HasilMetadataPeta): { dataUrl: string; thumbnailDataUrl: string } | undefined {
  try {
    if (typeof document === "undefined") return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const grad = ctx.createLinearGradient(0, 0, 320, 240);
    grad.addColorStop(0, "#14532d");
    grad.addColorStop(0.5, "#166534");
    grad.addColorStop(1, "#064e3b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let x = 40; x < 320; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 240);
      ctx.stroke();
    }
    for (let y = 40; y < 240; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(320, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(meta.crs || "GeoTIFF Raster", 16, 30);
    const url = canvas.toDataURL("image/jpeg", 0.8);
    return { dataUrl: url, thumbnailDataUrl: url };
  } catch {
    return undefined;
  }
}

export const PustakaView: React.FC<PustakaViewProps> = ({
  areaOffline,
  lapisanList,
  dataSpasial,
  sesiPengguna,
  modePilihAktif,
  onMatikanModePilih,
  onBukaPetaDasar,
  onBukaLapisanDiPeta,
  onBukaAreaPeta,
  onTambahAreaOffline,
  onHapusAreaOffline,
  onTambahLapisan,
  onHapusLapisan,
  onImporBerkas,
  onBukaPengaturanEkspor
}) => {
  const [subTab, setSubTab] = useState<"peta" | "lapisan">("peta");
  const [urutPeta, setUrutPeta] = useState<"baru_dilihat" | "nama" | "ukuran">("baru_dilihat");
  const [urutLapisan, setUrutLapisan] = useState<"terbaru" | "nama">("terbaru");
  const [filterItem, setFilterItem] = useState<"semua" | "geopdf" | "tiles">("semua");
  const [filterLapisan, setFilterLapisan] = useState<"semua" | "tugas" | "umum">("semua");
  const [cariTerbuka, setCariTerbuka] = useState(true);
  const [tampilanKisi, setTampilanKisi] = useState(false);
  const [riwayat, setRiwayat] = useState<Record<string, number>>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("pustaka-terakhir-dibuka") || "{}");
      return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "number" && Number.isFinite(v))) as Record<
        string,
        number
      >;
    } catch {
      return {};
    }
  });
  const bukaPeta = useCallback(
    (item: AreaPetaOffline) => {
      const next = { ...riwayat, [item.id]: Date.now() };
      setRiwayat(next);
      try {
        localStorage.setItem("pustaka-terakhir-dibuka", JSON.stringify(next));
      } catch {
        /* Peta tetap dapat dibuka. */
      }
      onBukaAreaPeta(item);
    },
    [riwayat, onBukaAreaPeta]
  );
  const [kataKunci, setKataKunci] = useState("");
  const [idTerpilih, setIdTerpilih] = useState<string[]>([]);
  const [menuItemTerbuka, setMenuItemTerbuka] = useState<string | null>(null);
  const [menuArahAtas, setMenuArahAtas] = useState(false);

  // Modal Tambah Peta Baru (tanpa nilai contoh)
  const [bukaModalPetaBaru, setBukaModalPetaBaru] = useState(false);
  const [namaPetaBaru, setNamaPetaBaru] = useState("");
  const [metadataPetaBaru, setMetadataPetaBaru] = useState<HasilMetadataPeta | null>(null);
  const [berkasPetaMentah, setBerkasPetaMentah] = useState<File | null>(null);
  const [petaKustomDataUrlBaru, setPetaKustomDataUrlBaru] = useState<string | undefined>(undefined);
  const [sedangMemprosesBerkas, setSedangMemprosesBerkas] = useState(false);
  const [sedangMenyimpanBerkas, setSedangMenyimpanBerkas] = useState(false);
  const [statusProsesBerkas, setStatusProsesBerkas] = useState("");

  const [galatImpor, setGalatImpor] = useState("");
  const [rasterGeoreferensi, setRasterGeoreferensi] = useState(false);
  const [thumbnailDataUrlBaru, setThumbnailDataUrlBaru] = useState<string | undefined>(undefined);
  const [perluKalibrasiManual, setPerluKalibrasiManual] = useState(false);
  const [kalibLatAtas, setKalibLatAtas] = useState("");
  const [kalibLngBarat, setKalibLngBarat] = useState("");
  const [kalibLatBawah, setKalibLatBawah] = useState("");
  const [kalibLngTimur, setKalibLngTimur] = useState("");

  // Modal Tambah Lapisan Baru oleh akun User/Admin
  const [bukaModalLapisanBaru, setBukaModalLapisanBaru] = useState(false);
  const [namaLapisanBaru, setNamaLapisanBaru] = useState("");
  const [deskripsiLapisanBaru, setDeskripsiLapisanBaru] = useState("");
  const [galatLapisanBaru, setGalatLapisanBaru] = useState("");

  // Modal Impor Lapisan Peta oleh akun User/Admin (pilih Point, Line, Polygon, atau Sekaligus)
  const [bukaModalImporLapisan, setBukaModalImporLapisan] = useState(false);
  const [sedangBacaImporLapisan, setSedangBacaImporLapisan] = useState(false);
  const [namaBerkasImporLapisan, setNamaBerkasImporLapisan] = useState("");
  const [isiBerkasImporLapisan, setIsiBerkasImporLapisan] = useState("");
  const [hasilImporLapisan, setHasilImporLapisan] = useState<HasilParse | null>(null);
  const [namaLapisanImpor, setNamaLapisanImpor] = useState("");
  const [pilihanGeometriImpor, setPilihanGeometriImpor] = useState<"semua" | JenisGeometri>("semua");
  const [galatImporLapisan, setGalatImporLapisan] = useState("");

  useTombolEsc(bukaModalPetaBaru && !sedangMenyimpanBerkas, () => setBukaModalPetaBaru(false));
  useTombolEsc(bukaModalLapisanBaru, () => setBukaModalLapisanBaru(false));
  useTombolEsc(bukaModalImporLapisan, () => setBukaModalImporLapisan(false));
  const [petaPratinjauAktif, setPetaPratinjauAktif] = useState<AreaPetaOffline | null>(null);
  useTombolEsc(petaPratinjauAktif !== null, () => setPetaPratinjauAktif(null));

  const ringkasGeometriImpor = useMemo(() => {
    const fitur = hasilImporLapisan?.fitur ?? [];
    let point = 0;
    let line = 0;
    let polygon = 0;
    for (const f of fitur) {
      if (f.jenisGeometri === "point") point += 1;
      else if (f.jenisGeometri === "line") line += 1;
      else if (f.jenisGeometri === "polygon") polygon += 1;
    }
    return { semua: fitur.length, point, line, polygon };
  }, [hasilImporLapisan]);

  const resetFormImporLapisan = () => {
    setNamaBerkasImporLapisan("");
    setIsiBerkasImporLapisan("");
    setHasilImporLapisan(null);
    setNamaLapisanImpor("");
    setPilihanGeometriImpor("semua");
    setGalatImporLapisan("");
    setSedangBacaImporLapisan(false);
  };

  const handleSimpanLapisanBaru = (e: React.FormEvent) => {
    e.preventDefault();
    const namaBersih = namaLapisanBaru.trim();
    if (!namaBersih || !onTambahLapisan) return;
    if (lapisanList.some((l) => l.nama.trim().toLowerCase() === namaBersih.toLowerCase())) {
      setGalatLapisanBaru("Lapisan dengan nama ini sudah ada.");
      return;
    }
    const lapisanBaru: LapisanSpasial = {
      id: buatId("LAP"),
      nama: namaBersih,
      jumlahPeta: 0,
      ...(deskripsiLapisanBaru.trim() ? { deskripsi: deskripsiLapisanBaru.trim() } : {}),
      createdAt: new Date().toISOString()
    };
    onTambahLapisan(lapisanBaru);
    setNamaLapisanBaru("");
    setDeskripsiLapisanBaru("");
    setGalatLapisanBaru("");
    setBukaModalLapisanBaru(false);
  };

  const handlePilihBerkasImporLapisan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setSedangBacaImporLapisan(true);
    setGalatImporLapisan("");
    setHasilImporLapisan(null);
    try {
      const isi = await file.text();
      const hasil = parseBerkas(file.name, isi);
      if (hasil.fitur.length === 0) {
        throw new Error("Tidak ada fitur valid yang dapat diimpor dari berkas ini.");
      }
      setNamaBerkasImporLapisan(file.name);
      setIsiBerkasImporLapisan(isi);
      setHasilImporLapisan(hasil);
      const namaDasar = file.name.replace(/\.[^.]+$/, "").trim();
      setNamaLapisanImpor(namaDasar || "Lapisan Impor");
      setPilihanGeometriImpor("semua");
    } catch (err) {
      setGalatImporLapisan(err instanceof Error ? err.message : "Berkas lapisan tidak dapat dibaca.");
    } finally {
      setSedangBacaImporLapisan(false);
      input.value = "";
    }
  };

  const handleSubmitImporLapisan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onImporBerkas || !hasilImporLapisan || !isiBerkasImporLapisan) return;
    if (ringkasGeometriImpor[pilihanGeometriImpor] === 0) {
      setGalatImporLapisan("Tidak ada fitur dengan tipe geometri yang dipilih.");
      return;
    }
    const sukses = onImporBerkas(namaBerkasImporLapisan, isiBerkasImporLapisan, {
      filterGeometri: pilihanGeometriImpor,
      namaLapisan: namaLapisanImpor.trim() || namaBerkasImporLapisan.replace(/\.[^.]+$/, "")
    });
    if (sukses) {
      resetFormImporLapisan();
      setBukaModalImporLapisan(false);
    }
  };

  const hitungObjekLapisan = (lapisan: LapisanSpasial): number => {
    return dataSpasial.filter((d) => objekCocokLapisan(d, lapisan)).length;
  };

  const daftarPetaTampil = areaOffline
    .filter((a) => {
      if (kataKunci.trim() && !a.namaArea.toLowerCase().includes(kataKunci.toLowerCase())) {
        return false;
      }
      if (filterItem === "geopdf") return a.jenisFile === "GeoPDF / GeoTIFF";
      if (filterItem === "tiles") return a.jenisFile === "XYZ Tiles" || a.jenisFile === "MBTiles / KMZ" || a.jenisFile === "PMTiles";
      return true;
    })
    .sort((a, b) => {
      if (urutPeta === "nama") return a.namaArea.localeCompare(b.namaArea);
      if (urutPeta === "ukuran") return b.ukuranMb - a.ukuranMb;
      return (riwayat[b.id] || new Date(b.diunduhPada).getTime()) - (riwayat[a.id] || new Date(a.diunduhPada).getTime());
    });

  const daftarLapisanTampil = lapisanList
    .filter((l) => {
      if (kataKunci.trim() && !l.nama.toLowerCase().includes(kataKunci.toLowerCase())) return false;
      if (filterLapisan === "tugas" && !l.tugasId) return false;
      if (filterLapisan === "umum" && Boolean(l.tugasId)) return false;
      if (sesiPengguna && sesiPengguna.peran === "kader") {
        if (!l.tugasId) return true;
        if (!l.targetKader || l.targetKader.length === 0 || l.targetKader.includes("*")) return true;
        const id = sesiPengguna.idKader?.toLowerCase();
        const email = sesiPengguna.email?.toLowerCase();
        const nama = sesiPengguna.nama?.toLowerCase();
        return l.targetKader.some((k) => {
          const target = k.toLowerCase().trim();
          return (id && target === id) || (email && target === email) || (nama && target === nama);
        });
      }
      return true;
    })
    .sort((a, b) => {
      if (urutLapisan === "nama") return a.nama.localeCompare(b.nama);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const togglePilihId = (id: string) => {
    setIdTerpilih((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePilihBerkasPeta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setSedangMemprosesBerkas(true);
    setStatusProsesBerkas("Memeriksa berkas peta...");

    setGalatImpor("");
    setMetadataPetaBaru(null);
    setBerkasPetaMentah(null);
    setPetaKustomDataUrlBaru(undefined);
    setThumbnailDataUrlBaru(undefined);
    setPerluKalibrasiManual(false);
    setRasterGeoreferensi(false);
    try {
      const namaKecil = file.name.toLowerCase();
      if (/\.pmtiles$/i.test(namaKecil)) {
        setStatusProsesBerkas("Membaca metadata PMTiles...");
        const meta = await bacaMetadataBerkasPeta(file);
        setBerkasPetaMentah(file);
        setMetadataPetaBaru(meta);
        setThumbnailDataUrlBaru(meta.thumbnailDataUrl);
        setNamaPetaBaru(singkatkanLabelPeta(meta.namaArea, 40));
        setRasterGeoreferensi(false);
      } else if (/\.mbtiles$/i.test(namaKecil)) {
        setStatusProsesBerkas("Membaca metadata MBTiles...");
        const meta = await bacaMetadataBerkasPeta(file);
        setBerkasPetaMentah(file);
        setMetadataPetaBaru(meta);
        setThumbnailDataUrlBaru(meta.thumbnailDataUrl);
        setNamaPetaBaru(singkatkanLabelPeta(meta.namaArea, 40));
        setRasterGeoreferensi(false);
      } else if (/\.(pdf|geopdf)$/i.test(namaKecil)) {
        setBerkasPetaMentah(file);
        setStatusProsesBerkas("Mengekstrak georeferensi dan merender GeoPDF...");
        const { imporGeoPdf, renderHalamanPdfBiasa } = await import("../lib/geoPdf");
        const ukuranMb = Math.max(0.1, Number((file.size / (1024 * 1024)).toFixed(1)));
        const posisiRef = (typeof window !== "undefined" ? bacaPosisiPeta() : null) || POSISI_AWAL_PETA;
        try {
          const hasil = await imporGeoPdf(file);
          const jarakKm = hitungJarakReferensiKm(posisiRef, {
            minLat: hasil.minLat,
            maxLat: hasil.maxLat,
            minLng: hasil.minLng,
            maxLng: hasil.maxLng
          });
          const jarakKmTeks = formatAngkaKoma(jarakKm, 1);
          const meta: HasilMetadataPeta = {
            ...hasil,
            namaArea: file.name,
            ukuranMb,
            ukuranMbTeks: formatAngkaKoma(ukuranMb, 1),
            jarakKm,
            jarakKmTeks,
            jenisFile: "GeoPDF / GeoTIFF",
            thumbnailType: "geopdf_sheet",
            thumbnailDataUrl: hasil.thumbnailDataUrl,
            sumberDeteksi: "geopdf",
            crs: hasil.crs || "EPSG:4326 (WGS 84)",
            crsDeskripsi: hasil.crsDeskripsi,
            lebarPixel: hasil.width,
            tinggiPixel: hasil.height,
            formatGeoref: hasil.formatGeoref ?? "iso32000",
            metodeTransformasi: hasil.metodeTransformasi,
            sisaMeter: hasil.sisaMeter,
            indeksHalaman: hasil.indeksHalaman,
            empatSudut: hasil.empatSudut
          };
          setMetadataPetaBaru(meta);
          setNamaPetaBaru(singkatkanLabelPeta(meta.namaArea, 40));
          setPetaKustomDataUrlBaru(hasil.dataUrl);
          setThumbnailDataUrlBaru(hasil.thumbnailDataUrl);
          setRasterGeoreferensi(true);
        } catch (errGeoPdf) {
          try {
            setStatusProsesBerkas("Merender halaman PDF untuk kalibrasi manual...");
            // Fallback: PDF biasa tanpa georeferensi -> render halaman 1 & buka form kalibrasi manual 2 titik (Barat Laut & Tenggara)
            const hasilBiasa = await renderHalamanPdfBiasa(file);
            const defLatAtas = Number((posisiRef.lat + 0.015).toFixed(5));
            const defLngBarat = Number((posisiRef.lng - 0.015).toFixed(5));
            const defLatBawah = Number((posisiRef.lat - 0.015).toFixed(5));
            const defLngTimur = Number((posisiRef.lng + 0.015).toFixed(5));
            setKalibLatAtas(String(defLatAtas));
            setKalibLngBarat(String(defLngBarat));
            setKalibLatBawah(String(defLatBawah));
            setKalibLngTimur(String(defLngTimur));
            setPerluKalibrasiManual(true);
            const metaManual: HasilMetadataPeta = {
              namaArea: file.name,
              ukuranMb,
              ukuranMbTeks: formatAngkaKoma(ukuranMb, 1),
              jarakKm: 0,
              jarakKmTeks: "0",
              jenisFile: "GeoPDF / GeoTIFF",
              thumbnailType: "geopdf_sheet",
              thumbnailDataUrl: hasilBiasa.thumbnailDataUrl,
              sumberDeteksi: "bawaan",
              crs: "EPSG:4326 (Kalibrasi Manual 2 Titik)",
              crsDeskripsi: errGeoPdf instanceof Error ? errGeoPdf.message : "Kalibrasi manual sudut Barat Laut dan Tenggara",
              minLat: defLatBawah,
              maxLat: defLatAtas,
              minLng: defLngBarat,
              maxLng: defLngTimur,
              pusatLat: posisiRef.lat,
              pusatLng: posisiRef.lng,
              lebarPixel: hasilBiasa.width,
              tinggiPixel: hasilBiasa.height,
              formatGeoref: "manual",
              metodeTransformasi: "afin-geografis",
              sisaMeter: 0,
              indeksHalaman: 0
            };
            setMetadataPetaBaru(metaManual);
            setNamaPetaBaru(singkatkanLabelPeta(file.name, 40));
            setPetaKustomDataUrlBaru(hasilBiasa.dataUrl);
            setThumbnailDataUrlBaru(hasilBiasa.thumbnailDataUrl);
            setRasterGeoreferensi(true);
          } catch (errFallback) {
            throw new Error("Berkas PDF tidak dapat diproses: " + (errFallback instanceof Error ? errFallback.message : "format tidak valid"));
          }
        }
      } else if (/\.(tif|tiff|geotiff)$/i.test(namaKecil)) {
        setStatusProsesBerkas("Membaca georeferensi GeoTIFF...");
        const meta = await bacaMetadataBerkasPeta(file);
        const pratinjau = buatPratinjauRasterGeotiff(meta);
        setBerkasPetaMentah(file);
        setMetadataPetaBaru(meta);
        if (pratinjau) {
          setPetaKustomDataUrlBaru(pratinjau.dataUrl);
          setThumbnailDataUrlBaru(pratinjau.thumbnailDataUrl);
        }
        setNamaPetaBaru(singkatkanLabelPeta(meta.namaArea, 40));
        setRasterGeoreferensi(true);
      } else {
        throw new Error(
          "Format berkas belum didukung. Gunakan .pmtiles, .mbtiles, .geopdf, atau .geotiff."
        );
      }
    } catch (err) {
      setGalatImpor(err instanceof Error ? err.message : "Berkas peta gagal dibaca.");
    } finally {
      setSedangMemprosesBerkas(false);
      setStatusProsesBerkas("");
      input.value = "";
    }
  };

  const handleSimpanPetaBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !namaPetaBaru.trim() ||
      !metadataPetaBaru ||
      (!petaKustomDataUrlBaru && !berkasPetaMentah) ||
      sedangMemprosesBerkas ||
      sedangMenyimpanBerkas ||
      galatImpor
    ) {
      return;
    }

    setSedangMenyimpanBerkas(true);
    setStatusProsesBerkas("Menyimpan arsip peta ke perangkat...");
    try {
      const id = buatId("MAP-OFF");
      let petaKustomUrl: string | undefined = undefined;

      if (berkasPetaMentah) {
        const namaKecil = berkasPetaMentah.name.toLowerCase();
        const isPm = /\.pmtiles$/i.test(namaKecil);
        const isMb = /\.mbtiles$/i.test(namaKecil);
        const isPdf = /\.(pdf|geopdf)$/i.test(namaKecil);
        const tipeArsip = isPm ? "pmtiles" : isMb ? "mbtiles" : isPdf ? "geopdf" : "geotiff";

        try {
          await simpanArsipPeta(id, berkasPetaMentah, {
            namaArea: namaPetaBaru.trim(),
            tipe: tipeArsip,
            ukuranMb: metadataPetaBaru.ukuranMb
          });

          if (isPm) {
            setStatusProsesBerkas("Menyiapkan sumber PMTiles...");
            daftarkanSumberPmtiles(id, berkasPetaMentah);
            petaKustomUrl = `pmtiles://${id}/{z}/{x}/{y}`;
          } else if (isMb) {
            setStatusProsesBerkas("Menyiapkan sumber tile MBTiles...");
            await daftarkanSumberMbtiles(id, berkasPetaMentah);
            petaKustomUrl = `mbtiles://${id}/{z}/{x}/{y}`;
          }
        } catch (err) {
          console.warn("Gagal menyimpan arsip biner ke IndexedDB:", err);
        }
      }

      let minLatFinal = metadataPetaBaru.minLat;
      let maxLatFinal = metadataPetaBaru.maxLat;
      let minLngFinal = metadataPetaBaru.minLng;
      let maxLngFinal = metadataPetaBaru.maxLng;
      if (perluKalibrasiManual) {
        const laAtas = parseFloat(kalibLatAtas.replace(",", "."));
        const loBarat = parseFloat(kalibLngBarat.replace(",", "."));
        const laBawah = parseFloat(kalibLatBawah.replace(",", "."));
        const loTimur = parseFloat(kalibLngTimur.replace(",", "."));
        if ([laAtas, loBarat, laBawah, loTimur].every(Number.isFinite)) {
          minLatFinal = Math.min(laAtas, laBawah);
          maxLatFinal = Math.max(laAtas, laBawah);
          minLngFinal = Math.min(loBarat, loTimur);
          maxLngFinal = Math.max(loBarat, loTimur);
        }
      }

      const itemBaru: AreaPetaOffline = {
        id,
        namaArea: namaPetaBaru.trim(),
        basemapId: "topo",
        minLat: minLatFinal,
        maxLat: maxLatFinal,
        minLng: minLngFinal,
        maxLng: maxLngFinal,
        zoomMin: metadataPetaBaru.zoomMin ?? 11,
        zoomMax: metadataPetaBaru.zoomMax ?? 18,
        jumlahTile: 0,
        rasterGeoreferensi,
        ukuranMb: metadataPetaBaru.ukuranMb,
        jarakKm: metadataPetaBaru.jarakKm ?? 0,
        thumbnailType: metadataPetaBaru?.thumbnailType ?? "geopdf_sheet",
        thumbnailDataUrl: thumbnailDataUrlBaru ?? metadataPetaBaru?.thumbnailDataUrl,
        petaKustomDataUrl: petaKustomDataUrlBaru,
        petaKustomUrl,
        diunduhPada: new Date().toISOString(),
        jenisFile: metadataPetaBaru?.jenisFile ?? "GeoPDF / GeoTIFF",
        crs: metadataPetaBaru.crs,
        crsDeskripsi: metadataPetaBaru?.crsDeskripsi,
        pusatLat: (minLatFinal + maxLatFinal) / 2,
        pusatLng: (minLngFinal + maxLngFinal) / 2,
        lebarPixel: metadataPetaBaru?.lebarPixel,
        tinggiPixel: metadataPetaBaru?.tinggiPixel,
        resolusiMeter: metadataPetaBaru?.resolusiMeter,
        formatGeoref: metadataPetaBaru?.formatGeoref,
        metodeTransformasi: metadataPetaBaru?.metodeTransformasi,
        sisaMeter: metadataPetaBaru?.sisaMeter,
        indeksHalaman: metadataPetaBaru?.indeksHalaman,
        empatSudut: metadataPetaBaru?.empatSudut,
        unduhanNyata: true,
        statusTeks: "Pada peta"
      };
      onTambahAreaOffline(itemBaru);
      setNamaPetaBaru("");
      setPetaKustomDataUrlBaru(undefined);
      setBerkasPetaMentah(null);
      setMetadataPetaBaru(null);
      setBukaModalPetaBaru(false);
      // Tampilkan pratinjau peta setelah berhasil di-upload ke aplikasi
      setPetaPratinjauAktif(itemBaru);
    } finally {
      setSedangMenyimpanBerkas(false);
      setStatusProsesBerkas("");
    }
  };

  const formatAngkaIndo = (num: number) => num.toString().replace(".", ",");

  return (
    <div className="avenza-pustaka-container pustaka-field">
      {/* SEGMENTED PILL TABS: PETA | LAPISAN */}
      <div className="avenza-segmented-wrap">
        <div className="avenza-segmented-control" role="tablist" aria-label="Pilihan Pustaka">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "peta"}
            className={`avenza-segment-btn ${subTab === "peta" ? "active" : ""}`}
            onClick={() => setSubTab("peta")}
          >
            <MapIcon size={16} className="segment-icon" />
            <span>Peta</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === "lapisan"}
            className={`avenza-segment-btn ${subTab === "lapisan" ? "active" : ""}`}
            onClick={() => setSubTab("lapisan")}
          >
            <Layers size={16} className="segment-icon" />
            <span>Lapisan</span>
          </button>
        </div>
      </div>

      {/* BARIS FILTER, SORT & PENCARIAN */}
      <div className="avenza-filter-row">
        <div className="avenza-pills-left">
          {subTab === "peta" ? (
            <div className="avenza-pill-select-wrap">
              <ArrowUpDown size={15} className="avenza-pill-icon" />
              <select className="avenza-pill-select" value={urutPeta} onChange={(e) => setUrutPeta(e.target.value as typeof urutPeta)}>
                <option value="baru_dilihat">Terakhir dibuka</option>
                <option value="nama">Nama (A-Z)</option>
                <option value="ukuran">Ukuran File</option>
              </select>
              <ChevronDown size={15} className="avenza-pill-caret" />
            </div>
          ) : (
            <div className="avenza-pill-select-wrap">
              <ArrowUpDown size={15} className="avenza-pill-icon" />
              <select
                className="avenza-pill-select"
                value={urutLapisan}
                onChange={(e) => setUrutLapisan(e.target.value as typeof urutLapisan)}
              >
                <option value="terbaru">Terbaru</option>
                <option value="nama">Nama (A-Z)</option>
              </select>
              <ChevronDown size={15} className="avenza-pill-caret" />
            </div>
          )}

          <div className="avenza-pill-select-wrap">
            <Filter size={15} className="avenza-pill-icon" />
            {subTab === "peta" ? (
              <select className="avenza-pill-select" value={filterItem} onChange={(e) => setFilterItem(e.target.value as typeof filterItem)}>
                <option value="semua">Semua item</option>
                <option value="geopdf">GeoPDF / Peta</option>
                <option value="tiles">Tile offline</option>
              </select>
            ) : (
              <select
                className="avenza-pill-select"
                value={filterLapisan}
                onChange={(e) => setFilterLapisan(e.target.value as typeof filterLapisan)}
              >
                <option value="semua">Semua lapisan</option>
                <option value="tugas">Tugas lapangan</option>
                <option value="umum">Lapisan umum</option>
              </select>
            )}
            <ChevronDown size={15} className="avenza-pill-caret" />
          </div>
        </div>

        <button type="button" className="avenza-search-icon-btn" onClick={() => setCariTerbuka((v) => !v)} title="Cari Peta atau Lapisan">
          <Search size={21} />
        </button>
      </div>

      {/* KOTAK PENCARIAN JIKA DIAKTIFKAN */}
      {cariTerbuka && (
        <div className="avenza-search-bar" role="search">
          <Search size={16} />
          <input
            type="text"
            aria-label="Cari peta atau lapisan"
            placeholder={subTab === "peta" ? "Cari nama peta..." : "Cari nama lapisan..."}
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
          />
          {kataKunci && (
            <button type="button" onClick={() => setKataKunci("")}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* BAR MODE PILIH */}
      {modePilihAktif && (
        <div className="avenza-selection-banner">
          <span>{idTerpilih.length} item dipilih</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                const petaDipilih = areaOffline.filter((a) => idTerpilih.includes(a.id));
                const lapisanDipilih = lapisanList.filter((l) => idTerpilih.includes(l.id));
                onBukaPengaturanEkspor(
                  petaDipilih.length || lapisanDipilih.length
                    ? {
                        petaDipilih,
                        lapisanDipilih,
                        sumberLabel: `${idTerpilih.length} item dipilih dari Pustaka`
                      }
                    : undefined
                );
              }}
            >
              Pengaturan Ekspor
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => {
                setIdTerpilih([]);
                onMatikanModePilih();
              }}
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* KONTEN TAB 1: PETA */}
      {subTab === "peta" && (
        <div className="avenza-peta-content">
          <div className="avenza-basemap-banner-wrap">
            <div className="avenza-basemap-banner" onClick={onBukaPetaDasar}>
              <LatarPetaDasar />

              <button
                type="button"
                className="avenza-buka-peta-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onBukaPetaDasar();
                }}
              >
                <MapIcon size={17} aria-hidden="true" /> Buka peta dasar
              </button>
            </div>
          </div>

          <div className="pustaka-list-heading">
            <span>
              Peta saya <b>{daftarPetaTampil.length}</b>
            </span>
            <div>
              <button type="button" aria-label="Tampilan daftar" aria-pressed={!tampilanKisi} onClick={() => setTampilanKisi(false)}>
                <List size={18} />
              </button>
              <button type="button" aria-label="Tampilan kisi" aria-pressed={tampilanKisi} onClick={() => setTampilanKisi(true)}>
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
          <div className={`avenza-map-list ${tampilanKisi ? "pustaka-grid" : ""}`}>
            {daftarPetaTampil.map((item) => (
              <div
                key={item.id}
                className="avenza-map-row"
                tabIndex={0}
                role="button"
                aria-label={`Buka peta ${item.namaArea}`}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    if (modePilihAktif) togglePilihId(item.id);
                    else bukaPeta(item);
                  }
                }}
                onClick={() => {
                  if (modePilihAktif) {
                    togglePilihId(item.id);
                  } else {
                    bukaPeta(item);
                  }
                }}
              >
                {modePilihAktif && (
                  <input
                    type="checkbox"
                    checked={idTerpilih.includes(item.id)}
                    onChange={() => togglePilihId(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="avenza-row-checkbox"
                  />
                )}

                <div
                  className="avenza-map-thumb-wrap"
                  onClick={(e) => {
                    if (!modePilihAktif) {
                      e.stopPropagation();
                      setPetaPratinjauAktif(item);
                    }
                  }}
                  title="Lihat Pratinjau Lembar Peta"
                >
                  {ambilUrlGambarThumbnail(item) ? (
                    <img
                      src={ambilUrlGambarThumbnail(item)!}
                      alt={item.namaArea}
                      className="avenza-real-thumb-img"
                      width={52}
                      height={52}
                      loading="lazy"
                    />
                  ) : (
                    <ThumbnailDokumenPeta size={52} />
                  )}
                </div>

                <div className="avenza-map-info">
                  <div className="avenza-map-title" title={item.namaArea}>
                    {singkatkanLabelPeta(item.namaArea, 40)}
                  </div>
                  <div className="avenza-map-meta">
                    {formatAngkaIndo(item.ukuranMb)} MB <span className="dot-sep">•</span>{" "}
                    <span className="text-emerald" style={{ fontWeight: 600 }}>
                      {item.statusTeks || (item.unduhanNyata ? "Pada peta" : "Catatan saja")}
                    </span>
                    {item.jarakKm !== undefined && item.jarakKm > 0 ? (
                      <>
                        {" "}
                        <span className="dot-sep">•</span> {formatAngkaIndo(item.jarakKm)} km
                      </>
                    ) : (
                      <>
                        {" "}
                        <span className="dot-sep">•</span>{" "}
                        <span className="text-emerald" style={{ fontWeight: 600 }}>
                          Anda di area peta ini
                        </span>
                      </>
                    )}
                    {item.crs && (
                      <>
                        {" "}
                        <span className="dot-sep">•</span>{" "}
                        <span className="avenza-crs-badge" title={item.crsDeskripsi || item.crs}>
                          {ringkasLabelCrs(item.crs, 24)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="avenza-map-more-wrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menuItemTerbuka === item.id) {
                      setMenuItemTerbuka(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const sisaBawah = (typeof window !== "undefined" ? window.innerHeight : 800) - rect.bottom;
                      setMenuArahAtas(sisaBawah < 260 && rect.top > 160);
                      setMenuItemTerbuka(item.id);
                    }
                  }}
                >
                  <button type="button" className="avenza-more-dots-btn" title="Opsi Peta" aria-expanded={menuItemTerbuka === item.id}>
                    <MoreHorizontal size={20} />
                  </button>

                  {menuItemTerbuka === item.id && (
                    <div className={`avenza-row-dropdown ${menuArahAtas ? "buka-atas" : ""}`} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          setPetaPratinjauAktif(item);
                        }}
                      >
                        Pratinjau Lembar Peta
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          bukaPeta(item);
                        }}
                      >
                        Buka di Peta Survei
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          onBukaPengaturanEkspor({
                            petaDipilih: [item],
                            sumberLabel: `Peta: ${item.namaArea}`
                          });
                        }}
                      >
                        Ekspor Peta / Lapisan
                      </button>
                      <button
                        type="button"
                        className="danger-text"
                        onClick={() => {
                          setMenuItemTerbuka(null);
                          onHapusAreaOffline(item.id);
                        }}
                      >
                        Hapus dari Pustaka
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {daftarPetaTampil.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 20px 80px", color: "#64748b" }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "#e8f5ee",
                    color: "#0d7344",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10
                  }}
                >
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                  {kataKunci || filterItem !== "semua" ? "Tidak ada peta yang cocok" : "Peta Anda, siap dibawa ke lapangan"}
                </h4>
                <p style={{ margin: "0 auto 14px", fontSize: "0.84rem", color: "#64748b", maxWidth: 320 }}>
                  Ketuk tombol (+) di kanan bawah untuk mengimpor peta kerja atau buka peta dasar.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="avenza-fab-orange single-fab"
            onClick={() => setBukaModalPetaBaru(true)}
            title="Tambah / Impor Peta Kerja Baru"
          >
            <Plus size={28} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {/* KONTEN TAB 2: LAPISAN */}
      {subTab === "lapisan" && (
        <div className="avenza-lapisan-content">
          {(onTambahLapisan || onImporBerkas) && (
            <div className="pustaka-lapisan-aksi-bar">
              {onTambahLapisan && (
                <button
                  type="button"
                  className="pustaka-lapisan-aksi-btn primary"
                  onClick={() => {
                    setNamaLapisanBaru("");
                    setDeskripsiLapisanBaru("");
                    setGalatLapisanBaru("");
                    setBukaModalLapisanBaru(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Tambah Lapisan</span>
                </button>
              )}
              {onImporBerkas && (
                <button
                  type="button"
                  className="pustaka-lapisan-aksi-btn"
                  onClick={() => {
                    resetFormImporLapisan();
                    setBukaModalImporLapisan(true);
                  }}
                >
                  <Upload size={15} />
                  <span>Impor Lapisan</span>
                </button>
              )}
            </div>
          )}

          <div className="avenza-layer-list">
            {daftarLapisanTampil.map((lapisan) => {
              const jmlObjek = hitungObjekLapisan(lapisan);
              const dipilih = idTerpilih.includes(lapisan.id);
              const ringkasSkema = hitungRingkasSkema(lapisan.skemaGeometri);
              const bukaLapisan = () => (onBukaLapisanDiPeta ? onBukaLapisanDiPeta(lapisan) : onBukaPetaDasar());
              return (
                <div
                  key={lapisan.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Buka lapisan ${lapisan.nama} di peta interaktif`}
                  className={`avenza-layer-row ${modePilihAktif && dipilih ? "selected" : ""}`}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      if (modePilihAktif) togglePilihId(lapisan.id);
                      else bukaLapisan();
                    }
                  }}
                  onClick={() => (modePilihAktif ? togglePilihId(lapisan.id) : bukaLapisan())}
                >
                  {modePilihAktif && (
                    <input
                      type="checkbox"
                      checked={dipilih}
                      onChange={() => togglePilihId(lapisan.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Pilih ${lapisan.nama}`}
                      className="avenza-checkbox"
                    />
                  )}
                  <div className="avenza-layer-icon-box">
                    <Layers size={24} />
                  </div>

                  <div className="avenza-layer-info">
                    <div className="avenza-layer-title">
                      {lapisan.nama}
                      {lapisan.tugasId && (
                        <>
                          <span className="avenza-layer-badge-tugas">Tugas Lapangan</span>
                          {lapisan.targetKader && !lapisan.targetKader.includes("*") && lapisan.targetKader.length > 0 && (
                            <span className="avenza-badge-kader-khusus">Khusus Anda</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="avenza-layer-meta">
                      {lapisan.tugasId
                        ? (lapisan.fields && lapisan.fields.length > 0)
                          ? `${lapisan.fields.length} isian data: ${lapisan.fields.map((f) => f.nama).slice(0, 3).join(", ")}${lapisan.fields.length > 3 ? "..." : ""}`
                          : ringkasSkema.total > 0 || ringkasSkema.totalTabel > 0
                            ? `Point ${ringkasSkema.tabelPoint}T (${ringkasSkema.point}) · Line ${ringkasSkema.tabelLine}T (${ringkasSkema.line}) · Polygon ${ringkasSkema.tabelPolygon}T (${ringkasSkema.polygon})`
                            : "Format Lapisan"
                        : `${lapisan.jumlahPeta} Peta`}
                      {jmlObjek > 0 ? (
                        <>
                          {" "}
                          <span className="dot-sep">•</span> Objek {jmlObjek}
                        </>
                      ) : (
                        <>
                          {" "}
                          <span className="dot-sep">•</span>{" "}
                          <span className="text-emerald" style={{ fontWeight: 600 }}>
                            Belum diisi · Buka peta
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="avenza-map-more-wrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuItemTerbuka === lapisan.id) {
                        setMenuItemTerbuka(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const sisaBawah = (typeof window !== "undefined" ? window.innerHeight : 800) - rect.bottom;
                        setMenuArahAtas(sisaBawah < 240 && rect.top > 160);
                        setMenuItemTerbuka(lapisan.id);
                      }
                    }}
                  >
                    <button type="button" className="avenza-more-dots-btn" title="Opsi Lapisan" aria-expanded={menuItemTerbuka === lapisan.id}>
                      <MoreHorizontal size={20} />
                    </button>

                    {menuItemTerbuka === lapisan.id && (
                      <div className={`avenza-row-dropdown ${menuArahAtas ? "buka-atas" : ""}`} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            bukaLapisan();
                          }}
                        >
                          Buka dan Isi di Peta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            onBukaPengaturanEkspor({
                              lapisanDipilih: [lapisan],
                              sumberLabel: `Lapisan: ${lapisan.nama}`
                            });
                          }}
                        >
                          Pengaturan Ekspor (.kml / .geojson)
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => {
                            setMenuItemTerbuka(null);
                            onHapusLapisan(lapisan.id);
                          }}
                        >
                          Hapus Lapisan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {daftarLapisanTampil.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "#e8f5ee",
                    color: "#0d7344",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10
                  }}
                >
                  <Layers size={28} />
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Belum Ada Lapisan</h4>
                <p style={{ margin: "0 auto", fontSize: "0.84rem", color: "#64748b", maxWidth: 300 }}>
                  Buat lapisan baru atau impor berkas GeoJSON, KML, dan GPX di atas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PETA KERJA BARU (MINIMALIS DAN ESTETIK) */}
      {bukaModalPetaBaru && (
        <div className="modal-backdrop" onClick={() => !sedangMenyimpanBerkas && setBukaModalPetaBaru(false)}>
          <div className="modal-card modal-minimalis" role="dialog" aria-modal="true" aria-label="Tambah Peta" onClick={(e) => e.stopPropagation()}>
            <div className="modal-minimalis-head">
              <h3>Tambah Peta</h3>
              <button
                type="button"
                className="btn-icon-close"
                disabled={sedangMenyimpanBerkas}
                onClick={() => setBukaModalPetaBaru(false)}
                aria-label="Tutup dialog tambah peta"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanPetaBaru} className="modal-minimalis-form">
              <label className={`peta-dropzone-minimalis ${sedangMemprosesBerkas || sedangMenyimpanBerkas ? "sibuk" : ""}`} htmlFor="upload-peta-input">
                <input
                  id="upload-peta-input"
                  type="file"
                  accept=".pmtiles,.mbtiles,.pdf,.geopdf,.tif,.tiff"
                  style={{ display: "none" }}
                  disabled={sedangMemprosesBerkas || sedangMenyimpanBerkas}
                  onChange={handlePilihBerkasPeta}
                />
                <span className="peta-dropzone-ikon">
                  {sedangMemprosesBerkas ? <Loader2 size={20} className="putar-segarkan" /> : <FileUp size={20} />}
                </span>
                <span className="peta-dropzone-teks">
                  <strong>{metadataPetaBaru ? "Ganti berkas peta" : "Pilih berkas peta"}</strong>
                  <small>GeoPDF · MBTiles · PMTiles · GeoTIFF</small>
                </span>
              </label>

              {(sedangMemprosesBerkas || sedangMenyimpanBerkas) && (
                <div className="peta-loading-box" role="status" aria-live="polite">
                  <div className="peta-loading-row">
                    <Loader2 size={15} className="putar-segarkan" />
                    <span>{statusProsesBerkas || "Memproses berkas peta..."}</span>
                  </div>
                  <div className="peta-progress-track" aria-hidden="true">
                    <div className="peta-progress-bar" />
                  </div>
                </div>
              )}

              {!sedangMemprosesBerkas && !sedangMenyimpanBerkas && metadataPetaBaru && (
                <div className="peta-meta-ringkas">
                  <span className="peta-meta-check">
                    <Check size={13} />
                  </span>
                  <div className="peta-meta-ringkas-info">
                    <strong title={metadataPetaBaru.namaArea}>
                      {singkatkanLabelPeta(metadataPetaBaru.namaArea, 34)}
                    </strong>
                    <span>
                      {metadataPetaBaru.ukuranMbTeks} MB · {ringkasLabelCrs(metadataPetaBaru.crs || "EPSG:4326", 26)}
                    </span>
                  </div>
                </div>
              )}

              {galatImpor && (
                <p className="peta-galat-ringkas" role="alert">
                  {galatImpor}
                </p>
              )}

              {metadataPetaBaru && metadataPetaBaru.ukuranMb > 50 && (
                <div className={`peta-peringatan-ringkas ${metadataPetaBaru.ukuranMb > 100 ? "bahaya" : "hati"}`}>
                  {metadataPetaBaru.ukuranMb > 100 ? <AlertOctagon size={15} /> : <AlertTriangle size={15} />}
                  <span>
                    Berkas {metadataPetaBaru.ukuranMbTeks} MB
                    {metadataPetaBaru.ukuranMb > 100 ? " · disarankan memakai format terkompresi" : ""}
                  </span>
                </div>
              )}

              {perluKalibrasiManual && (
                <div className="peta-kalibrasi-ringkas">
                  <span className="peta-kalibrasi-label">Kalibrasi Manual (Barat Laut · Tenggara)</span>
                  <div className="form-row-2">
                    <input type="text" className="form-input" placeholder="Lintang Utara" value={kalibLatAtas} onChange={(e) => setKalibLatAtas(e.target.value)} />
                    <input type="text" className="form-input" placeholder="Bujur Barat" value={kalibLngBarat} onChange={(e) => setKalibLngBarat(e.target.value)} />
                  </div>
                  <div className="form-row-2">
                    <input type="text" className="form-input" placeholder="Lintang Selatan" value={kalibLatBawah} onChange={(e) => setKalibLatBawah(e.target.value)} />
                    <input type="text" className="form-input" placeholder="Bujur Timur" value={kalibLngTimur} onChange={(e) => setKalibLngTimur(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="modal-minimalis-field">
                <label htmlFor="input-nama-peta-baru">Nama peta</label>
                <input
                  id="input-nama-peta-baru"
                  type="text"
                  required
                  disabled={sedangMenyimpanBerkas}
                  className="form-input"
                  placeholder="Nama peta"
                  value={namaPetaBaru}
                  onChange={(e) => setNamaPetaBaru(e.target.value)}
                />
              </div>

              <div className="modal-minimalis-footer">
                <button
                  type="button"
                  className="btn-outline-sm"
                  disabled={sedangMenyimpanBerkas}
                  onClick={() => setBukaModalPetaBaru(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    !namaPetaBaru.trim() ||
                    !metadataPetaBaru ||
                    (!petaKustomDataUrlBaru && !berkasPetaMentah) ||
                    sedangMemprosesBerkas ||
                    sedangMenyimpanBerkas ||
                    !!galatImpor
                  }
                >
                  {sedangMenyimpanBerkas ? (
                    <>
                      <Loader2 size={15} className="putar-segarkan" /> Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH LAPISAN BARU (AKUN USER / ADMIN) */}
      {bukaModalLapisanBaru && (
        <div className="modal-backdrop" onClick={() => setBukaModalLapisanBaru(false)}>
          <div className="modal-card modal-minimalis" role="dialog" aria-modal="true" aria-label="Tambah Lapisan Baru" onClick={(e) => e.stopPropagation()}>
            <div className="modal-minimalis-head">
              <h3>Lapisan Baru</h3>
              <button type="button" className="btn-icon-close" onClick={() => setBukaModalLapisanBaru(false)} aria-label="Tutup dialog lapisan baru">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanLapisanBaru} className="modal-minimalis-form">
              <div className="modal-minimalis-field">
                <label htmlFor="input-nama-lapisan-baru">Nama lapisan</label>
                <input
                  id="input-nama-lapisan-baru"
                  type="text"
                  required
                  className="form-input"
                  placeholder="Mis. Sebaran Sumber Air"
                  value={namaLapisanBaru}
                  onChange={(e) => {
                    setNamaLapisanBaru(e.target.value);
                    setGalatLapisanBaru("");
                  }}
                />
              </div>
              {galatLapisanBaru && (
                <p className="peta-galat-ringkas" role="alert">
                  {galatLapisanBaru}
                </p>
              )}
              <div className="modal-minimalis-field">
                <label htmlFor="input-deskripsi-lapisan-baru">Catatan (opsional)</label>
                <input
                  id="input-deskripsi-lapisan-baru"
                  type="text"
                  className="form-input"
                  placeholder="Keterangan singkat lapisan"
                  value={deskripsiLapisanBaru}
                  onChange={(e) => setDeskripsiLapisanBaru(e.target.value)}
                />
              </div>
              <div className="modal-minimalis-footer">
                <button type="button" className="btn-outline-sm" onClick={() => setBukaModalLapisanBaru(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={!namaLapisanBaru.trim()}>
                  Buat Lapisan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPOR LAPISAN PETA (PILIH POINT, LINE, POLYGON, ATAU SEKALIGUS) */}
      {bukaModalImporLapisan && (
        <div className="modal-backdrop" onClick={() => setBukaModalImporLapisan(false)}>
          <div className="modal-card modal-minimalis" role="dialog" aria-modal="true" aria-label="Impor Lapisan Peta" onClick={(e) => e.stopPropagation()}>
            <div className="modal-minimalis-head">
              <h3>Impor Lapisan</h3>
              <button type="button" className="btn-icon-close" onClick={() => setBukaModalImporLapisan(false)} aria-label="Tutup dialog impor lapisan">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitImporLapisan} className="modal-minimalis-form">
              <label className={`peta-dropzone-minimalis ${sedangBacaImporLapisan ? "sibuk" : ""}`} htmlFor="upload-impor-lapisan-input">
                <input
                  id="upload-impor-lapisan-input"
                  type="file"
                  accept=".geojson,.json,.kml,.gpx"
                  style={{ display: "none" }}
                  disabled={sedangBacaImporLapisan}
                  onChange={handlePilihBerkasImporLapisan}
                />
                <span className="peta-dropzone-ikon">
                  {sedangBacaImporLapisan ? <Loader2 size={20} className="putar-segarkan" /> : <Upload size={20} />}
                </span>
                <span className="peta-dropzone-teks">
                  <strong>{hasilImporLapisan ? "Ganti berkas lapisan" : "Pilih berkas lapisan"}</strong>
                  <small>GeoJSON · KML · GPX</small>
                </span>
              </label>

              {sedangBacaImporLapisan && (
                <div className="peta-loading-box" role="status" aria-live="polite">
                  <div className="peta-loading-row">
                    <Loader2 size={15} className="putar-segarkan" />
                    <span>Membaca berkas lapisan...</span>
                  </div>
                  <div className="peta-progress-track" aria-hidden="true">
                    <div className="peta-progress-bar" />
                  </div>
                </div>
              )}

              {galatImporLapisan && (
                <p className="peta-galat-ringkas" role="alert">
                  {galatImporLapisan}
                </p>
              )}

              {hasilImporLapisan && (
                <>
                  <div className="peta-meta-ringkas">
                    <span className="peta-meta-check">
                      <Check size={13} />
                    </span>
                    <div className="peta-meta-ringkas-info">
                      <strong title={namaBerkasImporLapisan}>{singkatkanLabelPeta(namaBerkasImporLapisan, 34)}</strong>
                      <span>
                        {hasilImporLapisan.format} · {ringkasGeometriImpor.semua} fitur terdeteksi
                      </span>
                    </div>
                  </div>

                  <div className="modal-minimalis-field">
                    <label htmlFor="input-nama-lapisan-impor">Nama lapisan</label>
                    <input
                      id="input-nama-lapisan-impor"
                      type="text"
                      required
                      className="form-input"
                      placeholder="Nama lapisan"
                      value={namaLapisanImpor}
                      onChange={(e) => setNamaLapisanImpor(e.target.value)}
                    />
                  </div>

                  <div className="modal-minimalis-field">
                    <label>Data yang diimpor</label>
                    <div className="impor-geometri-chips" role="group" aria-label="Pilih tipe data impor lapisan">
                      {(
                        [
                          { id: "semua" as const, label: "Sekaligus" },
                          { id: "point" as const, label: "Point" },
                          { id: "line" as const, label: "Line" },
                          { id: "polygon" as const, label: "Polygon" }
                        ]
                      ).map((opsi) => (
                        <button
                          key={opsi.id}
                          type="button"
                          aria-pressed={pilihanGeometriImpor === opsi.id}
                          className={`avenza-format-chip ${pilihanGeometriImpor === opsi.id ? "active" : ""}`}
                          onClick={() => {
                            setPilihanGeometriImpor(opsi.id);
                            setGalatImporLapisan("");
                          }}
                        >
                          <span>{opsi.label}</span>
                          <span className="ekspor-chip-count">{ringkasGeometriImpor[opsi.id]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="modal-minimalis-footer">
                <button type="button" className="btn-outline-sm" onClick={() => setBukaModalImporLapisan(false)}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    !hasilImporLapisan ||
                    !namaLapisanImpor.trim() ||
                    ringkasGeometriImpor[pilihanGeometriImpor] === 0
                  }
                >
                  Impor ({ringkasGeometriImpor[pilihanGeometriImpor]})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU PETA (MINIMALIS DAN ESTETIK) */}
      {petaPratinjauAktif && (
        <div className="modal-backdrop" onClick={() => setPetaPratinjauAktif(null)}>
          <div className="modal-card modal-minimalis peta-preview-minimalis" role="dialog" aria-modal="true" aria-label="Pratinjau Peta" onClick={(e) => e.stopPropagation()}>
            <div className="modal-minimalis-head">
              <h3 title={petaPratinjauAktif.namaArea}>{singkatkanLabelPeta(petaPratinjauAktif.namaArea, 34)}</h3>
              <button type="button" className="btn-icon-close" onClick={() => setPetaPratinjauAktif(null)} title="Tutup">
                <X size={18} />
              </button>
            </div>

            <div className="peta-preview-body">
              <div className="peta-preview-frame">
                {ambilUrlGambarThumbnail(petaPratinjauAktif) ? (
                  <img
                    src={ambilUrlGambarThumbnail(petaPratinjauAktif)!}
                    alt={petaPratinjauAktif.namaArea}
                    className="peta-preview-img"
                  />
                ) : (
                  <div className="peta-preview-kosong">
                    <MapIcon size={40} />
                    <span>{petaPratinjauAktif.jenisFile || "Lembar Peta"}</span>
                  </div>
                )}
              </div>

              <div className="peta-preview-pills">
                <span>{formatAngkaIndo(petaPratinjauAktif.ukuranMb)} MB</span>
                <span>{ringkasLabelCrs(petaPratinjauAktif.crs || "EPSG:4326", 24)}</span>
                <span>
                  {petaPratinjauAktif.jarakKm !== undefined && petaPratinjauAktif.jarakKm > 0
                    ? `${formatAngkaIndo(petaPratinjauAktif.jarakKm)} km`
                    : "Area saat ini"}
                </span>
              </div>
            </div>

            <div className="modal-minimalis-footer">
              <button type="button" className="btn-outline-sm" onClick={() => setPetaPratinjauAktif(null)}>
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const target = petaPratinjauAktif;
                  setPetaPratinjauAktif(null);
                  bukaPeta(target);
                }}
              >
                <MapIcon size={15} /> Buka di Peta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
