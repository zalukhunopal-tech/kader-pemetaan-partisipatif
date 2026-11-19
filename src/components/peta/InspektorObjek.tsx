import { sanitasiTeksInput } from "../../lib/geoUtils";
import React, { useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check, Lock, MapPin, Route, Hexagon } from "lucide-react";
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

  const simpanNama = () => {
    const bersih = sanitasiTeksInput(namaInput.trim());
    setSedangEditNama(false);
    if (!bersih) {
      setNamaInput(objek.judul);
      return;
    }
    setNamaInput(bersih);
    if (bersih !== objek.judul) {
      onPerbaruiObjek?.({ ...objek, judul: bersih });
    }
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
  };

  const simpanElevasi = () => {
    const bersih = elevasiInput.trim();
    setSedangEditElevasi(false);
    const angka = Number(bersih.replace(",", "."));
    onPerbaruiObjek?.({
      ...objek,
      elevasi: bersih !== "" && Number.isFinite(angka) ? angka : undefined
    });
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
        {objek.jenisGeometri === "point" && (
          <button type="button" className="avenza-head-btn avz-centang" aria-label="Simpan" onClick={onTutup}>
            <Check size={26} />
          </button>
        )}
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
            onClick={() => onPesan?.("Elevasi terkini: " + (elevasiVal !== undefined ? `${elevasiVal.toFixed(2)} m` : "otomatis GPS"))}
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
              <span className="avz-isian-nilai-panah tabular-nums">
                Dist: {(objek.panjangKm || 0).toFixed(2).replace(".", ",")} km | 00:39:59{" "}
                <ChevronRight size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Operasi</strong>
                <span className="avz-lock-yellow">
                  <Lock size={13} aria-hidden="true" />
                </span>
              </div>
              <button type="button" className="avz-tombol-garis" onClick={() => onPesan?.("Tersimpan sebagai trek")}>
                Konversikan ke Area
              </button>
            </div>
          </>
        )}

        {objek.jenisGeometri === "point" && (
          <>
            <div className="avz-isian-baris">
              <div className="avz-isian-kepala">
                <strong>Dibuat</strong>
              </div>
              <span className="tabular-nums">{dibuatTeks}</span>
            </div>

            {objek.atributKustom && Object.keys(objek.atributKustom).length > 0 ? (
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Skema atribut tugas</strong>
                </div>
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
              </div>
            ) : (
              <div className="avz-isian-baris">
                <div className="avz-isian-kepala">
                  <strong>Skema atribut</strong>
                  <button type="button" className="avz-aksi-hijau" onClick={() => onPesan?.("Skema atribut mengikuti lapisan aktif")}>
                    Edit
                  </button>
                </div>
                <button
                  type="button"
                  className="avz-isian-nilai-edit avz-isian-kecil"
                  onClick={() => onPesan?.("Skema atribut mengikuti lapisan aktif")}
                >
                  Kumpulkan data menggunakan atribut yang sudah dibuat sebelumnya. Edit lapisan aktif untuk mengubah skema atau buat yang baru.
                </button>
              </div>
            )}
          </>
        )}

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
