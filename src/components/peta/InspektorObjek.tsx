import { sanitasiAtributKustom, sanitasiTeksInput } from "../../lib/geoUtils";
import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check, Lock, MapPin, Route, Hexagon, Plus, Trash2 } from "lucide-react";
import { DataSpasialItem, LapisanSpasial } from "../../types";
import { JEDA_PEMBARUAN_JAM } from "../../lib/rewardEngine";
import { useTombolEsc } from "../../lib/useTombolEsc";
import { uraikanTeksKoordinat } from "../../lib/sistemKoordinat";
import { kompresFoto, SISI_MAKS_FOTO, TARGET_BYTE_FOTO } from "../../lib/foto";

const PILIHAN_CORAK_INSPEKTOR = [
  { id: "merah", warna: "#ef4444", label: "Merah" },
  { id: "jingga", warna: "#f26101", label: "Jingga" },
  { id: "hijau", warna: "#0d7344", label: "Hijau" },
  { id: "biru", warna: "#0284c7", label: "Biru" },
  { id: "kuning", warna: "#eab308", label: "Kuning" },
  { id: "ungu", warna: "#7c3aed", label: "Ungu" }
] as const;

interface InspektorObjekProps {
  objek: DataSpasialItem;
  /** Isian kondisi terbaru; dipegang peta supaya tidak hilang saat panel ditutup lalu dibuka lagi */
  kondisiUpdateInput: string;
  setKondisiUpdateInput: (nilai: string) => void;
  onTambahPembaruanObjek: (idData: string, kondisiTerbaru: string, catatan: string) => boolean;
  onPerbaruiObjek?: (dataDiubah: DataSpasialItem) => void;
  lapisanList?: LapisanSpasial[];
  elevasiGpsMeter?: number;
  onAmbilElevasiGps?: () => void;
  onKonversiKeArea?: () => void;
  onBukaHalamanLapisan?: () => void;
  onGoTo: (target: { lat: number; lng: number; judul: string }) => void;
  onTutup: () => void;
  onHapus?: (idData: string) => void;
  /** Pesan singkat di peta (mis. "Koordinat diperbarui") */
  onPesan?: (pesan: string) => void;
}

/**
 * Halaman detail objek yang diketuk di peta (Pin dijatuhkan / Trek / Area),
 * mengikuti struktur bersih Avenza Maps tanpa kategori bawaan lama.
 */
export const InspektorObjek: React.FC<InspektorObjekProps> = ({
  objek,
  kondisiUpdateInput,
  setKondisiUpdateInput,
  onTambahPembaruanObjek,
  onPerbaruiObjek,
  lapisanList = [],
  elevasiGpsMeter,
  onAmbilElevasiGps,
  onKonversiKeArea,
  onBukaHalamanLapisan,
  onGoTo,
  onTutup,
  onHapus,
  onPesan
}) => {
  useTombolEsc(true, onTutup);
  const [sedangEditNama, setSedangEditNama] = useState(false);
  const [namaInput, setNamaInput] = useState(objek.judul);
  const [sedangEditKoord, setSedangEditKoord] = useState(false);
  const [koordInput, setKoordInput] = useState("");
  const [galatKoord, setGalatKoord] = useState("");
  const [bukaEditLapisan, setBukaEditLapisan] = useState(false);
  const [sedangEditDeskripsi, setSedangEditDeskripsi] = useState(false);
  const [deskripsiInput, setDeskripsiInput] = useState(objek.deskripsi || "");
  const [bukaPilihCorak, setBukaPilihCorak] = useState(false);
  const [sedangEditElevasi, setSedangEditElevasi] = useState(false);
  const [elevasiInput, setElevasiInput] = useState(
    objek.elevasi !== undefined ? String(objek.elevasi) : ""
  );
  const [bukaGrafikTrek, setBukaGrafikTrek] = useState(false);
  const [sedangEditAtribut, setSedangEditAtribut] = useState(false);
  const [atributDraft, setAtributDraft] = useState<Record<string, string>>(() => ({
    ...(objek.atributKustom ?? {})
  }));
  const [kunciAtributBaru, setKunciAtributBaru] = useState("");
  const [nilaiAtributBaru, setNilaiAtributBaru] = useState("");
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  const koordUtama = objek.koordinat[0];
  const teksKoordinat = koordUtama ? `${koordUtama.lat.toFixed(6)}, ${koordUtama.lng.toFixed(6)}` : "-";
  const ukuran =
    objek.jenisGeometri === "point"
      ? koordUtama?.akurasi
        ? `Akurasi ±${Math.round(koordUtama.akurasi)} m`
        : "1 titik"
      : objek.jenisGeometri === "line"
        ? `${(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km`
        : `${(objek.luasHa || 0).toFixed(2).replace(".", ",")} Ha`;

  const judulTipe = objek.jenisGeometri === "point" ? "Pin dijatuhkan" : objek.jenisGeometri === "line" ? "Trek" : "Area";
  const warnaCorak =
    objek.warna || (objek.jenisGeometri === "line" ? "#f26101" : objek.jenisGeometri === "polygon" ? "#0d7344" : "#ef4444");
  const labelCorakMentah =
    objek.simbol || (objek.jenisGeometri === "line" ? "Jingga" : objek.jenisGeometri === "polygon" ? "Hijau" : "Merah");
  const labelCorak = /merah/i.test(labelCorakMentah)
    ? "Merah"
    : /jingga|oren/i.test(labelCorakMentah)
      ? "Jingga"
      : /hijau/i.test(labelCorakMentah)
        ? "Hijau"
        : /biru/i.test(labelCorakMentah)
          ? "Biru"
          : /kuning/i.test(labelCorakMentah)
            ? "Kuning"
            : /ungu/i.test(labelCorakMentah)
              ? "Ungu"
              : labelCorakMentah;

  const tgl = objek.createdAt ? new Date(objek.createdAt) : new Date();
  const dibuatTeks = Number.isNaN(tgl.getTime())
    ? objek.createdAt
    : `${String(tgl.getDate()).padStart(2, "0")}/${String(tgl.getMonth() + 1).padStart(2, "0")}/${String(tgl.getFullYear()).slice(-2)} pada ${String(tgl.getHours()).padStart(2, "0")}.${String(tgl.getMinutes()).padStart(2, "0")}`;

  const salin = (teks: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard
      .writeText(teks)
      .then(() => onPesan?.("Disalin: " + teks))
      .catch(() => onPesan?.("Gagal menyalin"));
  };

  const bagikan = () => {
    const teks = `${objek.judul} — ${teksKoordinat}`;
    if (typeof navigator.share === "function") {
      void navigator.share({ title: objek.judul, text: teks }).catch(() => undefined);
    } else salin(teks);
  };

  const elevasiVal = objek.elevasi ?? koordUtama?.elevasi;

  const durasiTrekTeks = useMemo(() => {
    const k = objek.koordinat;
    if (k.length < 2 || !k[0]?.timestamp || !k[k.length - 1]?.timestamp) return "00:00:00";
    const t0 = Date.parse(k[0].timestamp!);
    const t1 = Date.parse(k[k.length - 1].timestamp!);
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return "00:00:00";
    const totalDetik = Math.floor((t1 - t0) / 1000);
    const jam = String(Math.floor(totalDetik / 3600)).padStart(2, "0");
    const mnt = String(Math.floor((totalDetik % 3600) / 60)).padStart(2, "0");
    const dtk = String(totalDetik % 60).padStart(2, "0");
    return `${jam}:${mnt}:${dtk}`;
  }, [objek.koordinat]);

  const simpanNama = () => {
    const bersih = sanitasiTeksInput(namaInput.trim());
    setSedangEditNama(false);
    if (!bersih) {
      setNamaInput(objek.judul);
      return objek.judul;
    }
    setNamaInput(bersih);
    if (bersih !== objek.judul) {
      onPerbaruiObjek?.({ ...objek, judul: bersih });
    }
    return bersih;
  };

  const mulaiEditKoordinat = () => {
    setKoordInput(teksKoordinat === "-" ? "" : teksKoordinat);
    setGalatKoord("");
    setSedangEditKoord(true);
  };

  const simpanKoordinat = () => {
    const hasil = uraikanTeksKoordinat(koordInput);
    if (!hasil) {
      setGalatKoord("Format koordinat tidak dikenali. Contoh: -6.200000, 106.816666");
      return;
    }
    setGalatKoord("");
    const titikBaru = {
      ...(koordUtama ?? { lat: hasil.lat, lng: hasil.lng }),
      lat: hasil.lat,
      lng: hasil.lng,
      akurasi: undefined
    };
    onPerbaruiObjek?.({ ...objek, koordinat: [titikBaru, ...objek.koordinat.slice(1)] });
    setSedangEditKoord(false);
    onPesan?.("Koordinat titik diperbarui");
  };

  const simpanDeskripsi = () => {
    const bersih = sanitasiTeksInput(deskripsiInput.trim());
    setSedangEditDeskripsi(false);
    setDeskripsiInput(bersih);
    if (bersih !== (objek.deskripsi || "")) {
      onPerbaruiObjek?.({ ...objek, deskripsi: bersih });
    }
    return bersih;
  };

  const simpanElevasi = () => {
    const bersih = elevasiInput.trim();
    setSedangEditElevasi(false);
    const angka = Number(bersih.replace(",", "."));
    const elevBaru = bersih !== "" && Number.isFinite(angka) ? angka : undefined;
    onPerbaruiObjek?.({
      ...objek,
      elevasi: elevBaru
    });
    return elevBaru;
  };

  const simpanAtributKustom = () => {
    const gabungan: Record<string, string> = { ...atributDraft };
    if (kunciAtributBaru.trim() && nilaiAtributBaru.trim()) {
      gabungan[kunciAtributBaru.trim()] = nilaiAtributBaru.trim();
    }
    const bersih = sanitasiAtributKustom(gabungan);
    setAtributDraft(bersih);
    setKunciAtributBaru("");
    setNilaiAtributBaru("");
    setSedangEditAtribut(false);
    onPerbaruiObjek?.({
      ...objek,
      atributKustom: Object.keys(bersih).length > 0 ? bersih : undefined
    });
    onPesan?.("Atribut objek diperbarui");
    return bersih;
  };

  const handleAmbilElevasiAktif = () => {
    if (elevasiGpsMeter !== undefined && Number.isFinite(elevasiGpsMeter)) {
      const dibulatkan = Number(elevasiGpsMeter.toFixed(2));
      setElevasiInput(String(dibulatkan));
      onPerbaruiObjek?.({ ...objek, elevasi: dibulatkan });
      onPesan?.(`Elevasi diperbarui dari GPS: ${dibulatkan.toFixed(2).replace(".", ",")} m`);
      return;
    }
    if (onAmbilElevasiGps) {
      onAmbilElevasiGps();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos.coords.altitude !== null && Number.isFinite(pos.coords.altitude)) {
            const dibulatkan = Number(pos.coords.altitude.toFixed(2));
            setElevasiInput(String(dibulatkan));
            onPerbaruiObjek?.({ ...objek, elevasi: dibulatkan });
            onPesan?.(`Elevasi diperbarui dari GPS: ${dibulatkan.toFixed(2).replace(".", ",")} m`);
          } else {
            onPesan?.("Sensor GPS perangkat belum melaporkan data ketinggian (altitude).");
          }
        },
        () => {
          onPesan?.("Elevasi terkini: " + (elevasiVal !== undefined ? `${elevasiVal.toFixed(2)} m` : "otomatis GPS"));
        }
      );
      return;
    }
    onPesan?.("Elevasi terkini: " + (elevasiVal !== undefined ? `${elevasiVal.toFixed(2)} m` : "otomatis GPS"));
  };

  const handleSimpanSemuaDanTutup = () => {
    let terubah: DataSpasialItem = { ...objek };
    let adaPerubahan = false;

    if (sedangEditNama) {
      const bersih = sanitasiTeksInput(namaInput.trim());
      if (bersih && bersih !== objek.judul) {
        terubah = { ...terubah, judul: bersih };
        adaPerubahan = true;
      }
      setSedangEditNama(false);
    }
    if (sedangEditKoord) {
      const hasil = uraikanTeksKoordinat(koordInput);
      if (hasil) {
        const titikBaru = {
          ...(koordUtama ?? { lat: hasil.lat, lng: hasil.lng }),
          lat: hasil.lat,
          lng: hasil.lng,
          akurasi: undefined
        };
        terubah = { ...terubah, koordinat: [titikBaru, ...terubah.koordinat.slice(1)] };
        adaPerubahan = true;
        setSedangEditKoord(false);
      }
    }
    if (sedangEditDeskripsi) {
      const bersih = sanitasiTeksInput(deskripsiInput.trim());
      if (bersih !== (objek.deskripsi || "")) {
        terubah = { ...terubah, deskripsi: bersih };
        adaPerubahan = true;
      }
      setSedangEditDeskripsi(false);
    }
    if (sedangEditElevasi) {
      const bersih = elevasiInput.trim();
      const angka = Number(bersih.replace(",", "."));
      const elevBaru = bersih !== "" && Number.isFinite(angka) ? angka : undefined;
      if (elevBaru !== objek.elevasi) {
        terubah = { ...terubah, elevasi: elevBaru };
        adaPerubahan = true;
      }
      setSedangEditElevasi(false);
    }
    if (sedangEditAtribut) {
      const gabungan: Record<string, string> = { ...atributDraft };
      if (kunciAtributBaru.trim() && nilaiAtributBaru.trim()) {
        gabungan[kunciAtributBaru.trim()] = nilaiAtributBaru.trim();
      }
      const bersih = sanitasiAtributKustom(gabungan);
      terubah = { ...terubah, atributKustom: Object.keys(bersih).length > 0 ? bersih : undefined };
      adaPerubahan = true;
      setSedangEditAtribut(false);
    }
    if (adaPerubahan) {
      onPerbaruiObjek?.(terubah);
    }
    if (kondisiUpdateInput.trim()) {
      const diterima = onTambahPembaruanObjek(objek.id, sanitasiTeksInput(kondisiUpdateInput.trim()), "");
      if (diterima) setKondisiUpdateInput("");
    }
    onTutup();
  };

  const handleUbahFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void kompresFoto(file, SISI_MAKS_FOTO, TARGET_BYTE_FOTO)
      .then((url) => {
        onPerbaruiObjek?.({ ...objek, fotoBase64: url });
        onPesan?.("Foto objek diperbarui");
      })
      .catch(() => onPesan?.("Foto tidak dapat diproses"));
    e.target.value = "";
  };

  return (
    <section className="avz-halaman avz-detail-objek field-inspector-sheet" role="dialog" aria-label={objek.judul}>
      <header className="avz-halaman-kepala">
        <button type="button" className="avenza-head-btn btn-icon-close" aria-label="Tutup" onClick={onTutup}>
          <ChevronDown size={26} />
        </button>
        <h2>{judulTipe}</h2>
        <button
          type="button"
          className="avenza-head-btn avz-centang"
          aria-label="Simpan"
          onClick={handleSimpanSemuaDanTutup}
        >
          <Check size={26} />
        </button>
      </header>

      <div className="avz-halaman-isi avz-isian">
        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Nama</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => {
                if (sedangEditNama) {
                  simpanNama();
                } else {
                  setNamaInput(objek.judul);
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
                className="avz-input avz-input-bersih"
                value={namaInput}
                onChange={(e) => setNamaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    simpanNama();
                  } else if (e.key === "Escape") {
                    setSedangEditNama(false);
                  }
                }}
                aria-label="Edit nama objek"
                autoFocus
              />
              <button type="button" className="avz-aksi-hijau" onClick={simpanNama}>
                Selesai
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="avz-isian-nilai-edit"
              onClick={() => {
                setNamaInput(objek.judul);
                setSedangEditNama(true);
              }}
            >
              {objek.judul}
            </button>
          )}
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{objek.jenisGeometri === "point" ? "Koordinat" : objek.jenisGeometri === "line" ? "Jarak" : "Luas"}</strong>
            {objek.jenisGeometri === "point" ? (
              <button
                type="button"
                className="avz-aksi-hijau"
                onClick={() => {
                  if (sedangEditKoord) {
                    simpanKoordinat();
                  } else {
                    mulaiEditKoordinat();
                  }
                }}
              >
                Edit
              </button>
            ) : (
              <ChevronRight size={20} color="#5f6368" aria-hidden="true" />
            )}
          </div>
          {objek.jenisGeometri === "point" ? (
            sedangEditKoord ? (
              <div className="avz-inline-edit-col">
                <div className="avz-inline-edit-row">
                  <input
                    type="text"
                    className="avz-input avz-input-bersih tabular-nums"
                    value={koordInput}
                    onChange={(e) => {
                      setKoordInput(e.target.value);
                      if (galatKoord) setGalatKoord("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        simpanKoordinat();
                      } else if (e.key === "Escape") {
                        setSedangEditKoord(false);
                        setGalatKoord("");
                      }
                    }}
                    placeholder="Contoh: -6.200000, 106.816666"
                    aria-label="Edit titik koordinat"
                    autoFocus
                  />
                  <button type="button" className="avz-aksi-hijau" onClick={simpanKoordinat}>
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
            )
          ) : (
            <>
              <span className="tabular-nums">{ukuran}</span>
              <small className="avz-isian-kecil">{teksKoordinat}</small>
            </>
          )}
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Lapisan saat ini</strong>
          </div>
          <button
            type="button"
            className="avz-isian-nilai-panah avz-corak-btn"
            onClick={() => {
              if (lapisanList.length > 0 && onPerbaruiObjek) {
                setBukaEditLapisan((v) => !v);
              } else if (onBukaHalamanLapisan) {
                onBukaHalamanLapisan();
              } else {
                onPesan?.("Buka menu Lapisan untuk mengelola lapisan");
              }
            }}
          >
            <span>{objek.lapisanNama || objek.tematik || "Lapisan 1"}</span>
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            className="avz-tombol-garis"
            onClick={() => {
              if (lapisanList.length > 0 && onPerbaruiObjek) {
                setBukaEditLapisan((v) => !v);
              } else if (onBukaHalamanLapisan) {
                onBukaHalamanLapisan();
              } else {
                onPesan?.("Buka menu Lapisan untuk mengelola lapisan");
              }
            }}
          >
            Edit Lapisan
          </button>
          {bukaEditLapisan && lapisanList.length > 0 && onPerbaruiObjek && (
            <select
              className="avz-input avz-input-bersih"
              value={objek.lapisanId ?? ""}
              onChange={(e) => {
                const idBaru = e.target.value || undefined;
                const cocok = lapisanList.find((l) => l.id === idBaru);
                onPerbaruiObjek({
                  ...objek,
                  lapisanId: cocok?.id,
                  lapisanNama: cocok?.nama || "Lapisan 1"
                });
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

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Foto</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => fotoInputRef.current?.click()}
            >
              {objek.fotoBase64 ? "Edit" : "Tambah"}
            </button>
          </div>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleUbahFoto}
          />
          {objek.fotoBase64 ? (
            <button
              type="button"
              className="avz-isian-nilai-edit"
              onClick={() => fotoInputRef.current?.click()}
            >
              <img className="avz-isian-foto" src={objek.fotoBase64} alt={`Foto ${objek.judul}`} />
            </button>
          ) : (
            <button
              type="button"
              className="avz-isian-nilai-edit avz-isian-kosong"
              onClick={() => fotoInputRef.current?.click()}
            >
              Ketuk untuk menambah foto...
            </button>
          )}
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Deskripsi</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => {
                if (sedangEditDeskripsi) {
                  simpanDeskripsi();
                } else {
                  setDeskripsiInput(objek.deskripsi || "");
                  setSedangEditDeskripsi(true);
                }
              }}
            >
              {objek.deskripsi ? "Edit" : "Tambah"}
            </button>
          </div>
          {sedangEditDeskripsi ? (
            <div className="avz-inline-edit-col">
              <textarea
                rows={3}
                className="avz-input avz-input-bersih avz-textarea-bersih"
                value={deskripsiInput}
                onChange={(e) => setDeskripsiInput(e.target.value)}
                placeholder="Catatan atau deskripsi objek..."
                aria-label="Edit deskripsi objek"
                autoFocus
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="avz-aksi-hijau" onClick={simpanDeskripsi}>
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`avz-isian-nilai-edit ${objek.deskripsi ? "" : "avz-isian-kosong"}`}
              onClick={() => {
                setDeskripsiInput(objek.deskripsi || "");
                setSedangEditDeskripsi(true);
              }}
            >
              {objek.deskripsi || "Ketuk untuk menambah deskripsi..."}
            </button>
          )}
          <small className="avz-isian-kecil">
            {objek.namaKader} · {objek.desaWilayah}
          </small>
        </div>

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
            <span>{labelCorak}</span>
            <span className="avz-corak-preview">
              {objek.jenisGeometri === "point" ? (
                <MapPin size={18} color={warnaCorak} fill={warnaCorak} aria-hidden="true" />
              ) : objek.jenisGeometri === "line" ? (
                <Route size={18} color={warnaCorak} aria-hidden="true" />
              ) : (
                <Hexagon size={18} color={warnaCorak} aria-hidden="true" />
              )}
              <ChevronRight size={18} aria-hidden="true" />
            </span>
          </button>
          {bukaPilihCorak && (
            <div className="avz-corak-chips">
              {PILIHAN_CORAK_INSPEKTOR.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`avz-corak-chip ${labelCorak.toLowerCase() === c.label.toLowerCase() ? "aktif" : ""}`}
                  onClick={() => {
                    onPerbaruiObjek?.({ ...objek, simbol: c.label, warna: c.warna });
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

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{objek.jenisGeometri === "point" ? "Elevasi" : "Perolehan elevasi total"}</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => {
                if (sedangEditElevasi) {
                  simpanElevasi();
                } else {
                  setElevasiInput(elevasiVal !== undefined ? String(elevasiVal) : "");
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
                className="avz-input avz-input-bersih tabular-nums"
                value={elevasiInput}
                onChange={(e) => setElevasiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    simpanElevasi();
                  } else if (e.key === "Escape") {
                    setSedangEditElevasi(false);
                  }
                }}
                placeholder="Elevasi (meter)"
                aria-label="Edit elevasi objek"
                autoFocus
              />
              <button type="button" className="avz-aksi-hijau" onClick={simpanElevasi}>
                Selesai
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="avz-isian-nilai-edit tabular-nums"
              onClick={() => {
                setElevasiInput(elevasiVal !== undefined ? String(elevasiVal) : "");
                setSedangEditElevasi(true);
              }}
            >
              {elevasiVal !== undefined ? `${elevasiVal.toFixed(2).replace(".", ",")} m` : "- - -"}
            </button>
          )}
          <button
            type="button"
            className="avz-tombol-garis"
            onClick={handleAmbilElevasiAktif}
          >
            Ambil elevasi
          </button>
        </div>

        {objek.jenisGeometri === "line" && (
          <>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Tampilkan Grafik</strong>
              </div>
              <button
                type="button"
                className="avz-isian-nilai-panah avz-corak-btn tabular-nums"
                onClick={() => setBukaGrafikTrek((v) => !v)}
              >
                <span>
                  Dist: {(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km | {durasiTrekTeks}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              {bukaGrafikTrek && (
                <div className="avz-grafik-ringkas">
                  <span>Panjang lintasan: {(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km</span>
                  <span>Durasi rekaman: {durasiTrekTeks}</span>
                  <span>Jumlah simpul: {objek.koordinat.length} titik GPS</span>
                </div>
              )}
            </div>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Operasi</strong>
                <span className="avz-lock-yellow">
                  <Lock size={13} aria-hidden="true" />
                </span>
              </div>
              <button
                type="button"
                className="avz-tombol-garis"
                disabled={objek.koordinat.length < 3 && Boolean(onKonversiKeArea)}
                onClick={() => {
                  if (onKonversiKeArea && objek.koordinat.length >= 3) {
                    onKonversiKeArea();
                  } else if (objek.koordinat.length < 3) {
                    onPesan?.("Butuh minimal 3 titik jalur untuk dikonversi menjadi Area.");
                  } else {
                    onPesan?.("Tersimpan sebagai trek");
                  }
                }}
              >
                Konversikan ke Area
              </button>
            </div>
          </>
        )}

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>Dibuat</strong>
          </div>
          <span className="tabular-nums">{dibuatTeks}</span>
        </div>

        <div className="avz-isian-baris">
          <div className="avz-isian-kepala">
            <strong>{objek.atributKustom && Object.keys(objek.atributKustom).length > 0 ? "Skema atribut tugas" : "Skema atribut"}</strong>
            <button
              type="button"
              className="avz-aksi-hijau"
              onClick={() => {
                if (sedangEditAtribut) {
                  simpanAtributKustom();
                } else {
                  setAtributDraft({ ...(objek.atributKustom ?? {}) });
                  setSedangEditAtribut(true);
                }
              }}
            >
              Edit
            </button>
          </div>
          {sedangEditAtribut ? (
            <div className="avz-inline-edit-col">
              {Object.entries(atributDraft).map(([kunci, nilai]) => (
                <div key={kunci} className="avz-inline-edit-row">
                  <span className="text-muted" style={{ minWidth: 90, fontSize: "0.85rem", fontWeight: 600 }}>
                    {kunci}
                  </span>
                  {typeof nilai === "string" && nilai.startsWith("data:image/") ? (
                    <img src={nilai} alt={kunci} className="avz-isian-foto" style={{ maxHeight: 72 }} />
                  ) : (
                    <input
                      type="text"
                      className="avz-input avz-input-bersih"
                      aria-label={`Edit atribut ${kunci}`}
                      value={nilai}
                      onChange={(e) => setAtributDraft((lama) => ({ ...lama, [kunci]: e.target.value }))}
                    />
                  )}
                  <button
                    type="button"
                    className="avz-aksi-hijau"
                    aria-label={`Hapus atribut ${kunci}`}
                    onClick={() =>
                      setAtributDraft((lama) => {
                        const salinan = { ...lama };
                        delete salinan[kunci];
                        return salinan;
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="avz-inline-edit-row">
                <input
                  type="text"
                  className="avz-input avz-input-bersih"
                  placeholder="Nama atribut baru..."
                  aria-label="Nama atribut baru"
                  value={kunciAtributBaru}
                  onChange={(e) => setKunciAtributBaru(e.target.value)}
                />
                <input
                  type="text"
                  className="avz-input avz-input-bersih"
                  placeholder="Nilai..."
                  aria-label="Nilai atribut baru"
                  value={nilaiAtributBaru}
                  onChange={(e) => setNilaiAtributBaru(e.target.value)}
                />
                <button
                  type="button"
                  className="avz-aksi-hijau"
                  aria-label="Tambah atribut"
                  onClick={() => {
                    const k = sanitasiTeksInput(kunciAtributBaru);
                    const v = sanitasiTeksInput(nilaiAtributBaru);
                    if (!k || !v) return;
                    setAtributDraft((lama) => ({ ...lama, [k]: v }));
                    setKunciAtributBaru("");
                    setNilaiAtributBaru("");
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="avz-aksi-hijau" onClick={simpanAtributKustom}>
                  Selesai
                </button>
              </div>
            </div>
          ) : objek.atributKustom && Object.keys(objek.atributKustom).length > 0 ? (
            <button
              type="button"
              className="avz-isian-nilai-edit"
              onClick={() => {
                setAtributDraft({ ...(objek.atributKustom ?? {}) });
                setSedangEditAtribut(true);
              }}
            >
              <div className="avz-atribut-kustom-list">
                {Object.entries(objek.atributKustom).map(([kunci, nilai]) => (
                  <div key={kunci} className="avz-atribut-kustom-row">
                    <span className="text-muted">{kunci}</span>
                    <span>
                      {typeof nilai === "string" && nilai.startsWith("data:image/") ? (
                        <img src={nilai} alt={kunci} className="avz-isian-foto" style={{ maxHeight: 90 }} />
                      ) : (
                        nilai || "-"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="avz-isian-nilai-edit avz-isian-kecil"
              onClick={() => {
                setAtributDraft({});
                setSedangEditAtribut(true);
              }}
            >
              Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
            </button>
          )}
        </div>

        <div className="avz-isian-baris inspector-update-box">
          <div className="avz-isian-kepala">
            <strong>Perbarui kondisi</strong>
          </div>
          {objek.riwayatPembaruan && objek.riwayatPembaruan.length > 0 && (
            <ul className="avz-riwayat">
              {objek.riwayatPembaruan.slice(-2).map((r) => (
                <li key={r.id}>{r.kondisiTerbaru}</li>
              ))}
            </ul>
          )}
          <input
            type="text"
            className="avz-input avz-input-bersih"
            placeholder="Kondisi terbaru..."
            value={kondisiUpdateInput}
            onChange={(e) => setKondisiUpdateInput(e.target.value)}
          />
          <small className="avz-isian-kecil">Satu pembaruan per objek setiap {JEDA_PEMBARUAN_JAM} jam.</small>
          <button
            type="button"
            className="avz-tombol-garis"
            onClick={() => {
              if (!kondisiUpdateInput.trim()) return;
              const diterima = onTambahPembaruanObjek(objek.id, sanitasiTeksInput(kondisiUpdateInput.trim()), "");
              if (diterima) setKondisiUpdateInput("");
            }}
          >
            Simpan pembaruan
          </button>
        </div>
      </div>

      <footer className="avz-halaman-kaki avz-footer-pills">
        {koordUtama && (
          <button
            type="button"
            className="avz-pill-outline-btn inspector-goto-btn"
            onClick={() => onGoTo({ lat: koordUtama.lat, lng: koordUtama.lng, judul: objek.judul })}
          >
            Navigasi
          </button>
        )}
        <button type="button" className="avz-pill-outline-btn" onClick={bagikan}>
          {objek.jenisGeometri === "line" ? "Beri tahu" : "Bagikan"}
        </button>
        {onHapus && (
          <button type="button" className="avz-pill-outline-btn" onClick={() => onHapus(objek.id)}>
            Hapus
          </button>
        )}
      </footer>
    </section>
  );
};
