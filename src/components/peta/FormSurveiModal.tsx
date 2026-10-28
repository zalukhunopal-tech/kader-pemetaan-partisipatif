import React, { useState } from "react";
import { Camera, X } from "lucide-react";
import { DataSpasialItem, JenisGeometri, KategoriSurvei, KoordinatTitik, ProfilKader } from "../../types";
import { hitungLuasPoligonHa, hitungPanjangGarisKm } from "../../lib/geoUtils";
import { buatId } from "../../lib/id";
import { kompresFoto, perkiraBytesDataUrl } from "../../lib/foto";

/**
 * Isian form atribut survei. Dipegang oleh peta supaya isian tetap ada bila form ditutup lalu dibuka
 * lagi (mis. saat merekam jalur) dan kategori bisa diatur sebelum form tampil.
 */
export function useFormSurvei() {
  const [kategoriInput, setKategoriInput] = useState<KategoriSurvei>("Flora");
  const [judulInput, setJudulInput] = useState<string>("");
  const [namaLokalInput, setNamaLokalInput] = useState<string>("");
  const [namaIlmiahInput, setNamaIlmiahInput] = useState<string>("");
  const [jumlahIndividuInput, setJumlahIndividuInput] = useState<string>("1");
  const [manfaatInput, setManfaatInput] = useState<string>("");
  const [kondisiInput, setKondisiInput] = useState<string>("");
  const [deskripsiInput, setDeskripsiInput] = useState<string>("");
  const [fotoInput, setFotoInput] = useState<string>("");
  const [galatFoto, setGalatFoto] = useState<string | null>(null);
  const [memprosesFoto, setMemprosesFoto] = useState<boolean>(false);

  const handlePilihFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setGalatFoto(null);
    setMemprosesFoto(true);
    // Foto dikecilkan dulu: foto kamera mentah (beberapa MB) akan memenuhi kuota penyimpanan perangkat
    kompresFoto(file)
      .then((dataUrl) => setFotoInput(dataUrl))
      .catch((err: unknown) => {
        setFotoInput("");
        setGalatFoto(err instanceof Error ? err.message : "Foto tidak dapat diproses.");
      })
      .finally(() => {
        setMemprosesFoto(false);
        input.value = "";
      });
  };

  /** Menyusun objek data spasial baru dari isian form dan titik yang direkam */
  const susunItem = (
    profil: ProfilKader,
    modeRekam: JenisGeometri,
    titikDraft: KoordinatTitik[],
    kompasDerajat: number | undefined
  ): DataSpasialItem => {
    const panjangKm = modeRekam === "point" ? 0 : hitungPanjangGarisKm(titikDraft);
    const luasHa = modeRekam === "polygon" ? hitungLuasPoligonHa(titikDraft) : 0;

    const itemBaru: DataSpasialItem = {
      id: buatId("SPS"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      jenisGeometri: modeRekam,
      kategori: kategoriInput,
      judul: judulInput.trim() || `${kategoriInput} - ${namaLokalInput || new Date().toLocaleDateString("id-ID")}`,
      namaLokal: namaLokalInput.trim() || undefined,
      namaIlmiah: namaIlmiahInput.trim() || undefined,
      jumlahIndividu: Number(jumlahIndividuInput) || 1,
      manfaatMasyarakat: manfaatInput.trim() || undefined,
      kondisiAncaman: kondisiInput.trim() || undefined,
      deskripsi: deskripsiInput.trim() || "Direkam langsung di lapangan.",
      koordinat: titikDraft,
      panjangKm,
      luasHa,
      kompasDerajat,
      fotoBase64: fotoInput || undefined,
      namaFileFoto: `${kategoriInput.toUpperCase().replace(/\W+/g, "_")}_${profil.idKader}_${Date.now()}.jpg`,
      statusSinkron: "lokal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      riwayatPembaruan: []
    };
    return itemBaru;
  };

  /** Setelah tersimpan: isian dikosongkan, kategori dan jumlah dibiarkan untuk objek berikutnya */
  const kosongkan = () => {
    setJudulInput("");
    setNamaLokalInput("");
    setNamaIlmiahInput("");
    setManfaatInput("");
    setKondisiInput("");
    setDeskripsiInput("");
    setFotoInput("");
    setGalatFoto(null);
  };

  return {
    kategoriInput,
    setKategoriInput,
    judulInput,
    setJudulInput,
    namaLokalInput,
    setNamaLokalInput,
    namaIlmiahInput,
    setNamaIlmiahInput,
    jumlahIndividuInput,
    setJumlahIndividuInput,
    manfaatInput,
    setManfaatInput,
    kondisiInput,
    setKondisiInput,
    deskripsiInput,
    setDeskripsiInput,
    fotoInput,
    galatFoto,
    memprosesFoto,
    handlePilihFoto,
    susunItem,
    kosongkan
  };
}

interface FormSurveiModalProps {
  form: ReturnType<typeof useFormSurvei>;
  modeRekam: JenisGeometri | null;
  panjangDraftKm: number;
  luasDraftHa: number;
  onSimpan: (e: React.FormEvent) => void;
  onTutup: () => void;
}

/** Modal form atribut survei lapangan untuk titik, jalur, atau poligon yang baru direkam */
export const FormSurveiModal: React.FC<FormSurveiModalProps> = ({ form, modeRekam, panjangDraftKm, luasDraftHa, onSimpan, onTutup }) => {
  const {
    kategoriInput,
    setKategoriInput,
    judulInput,
    setJudulInput,
    namaLokalInput,
    setNamaLokalInput,
    namaIlmiahInput,
    setNamaIlmiahInput,
    jumlahIndividuInput,
    setJumlahIndividuInput,
    manfaatInput,
    setManfaatInput,
    kondisiInput,
    setKondisiInput,
    deskripsiInput,
    setDeskripsiInput,
    fotoInput,
    galatFoto,
    memprosesFoto,
    handlePilihFoto
  } = form;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>
            {modeRekam === "point"
              ? "📍 Simpan Titik Lokasi"
              : modeRekam === "line"
                ? `〰️ Simpan Jalur (${panjangDraftKm} km)`
                : `⬢ Simpan Poligon (${luasDraftHa} Ha)`}
          </h3>
          <button type="button" className="btn-icon-close" onClick={onTutup}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSimpan} className="modal-form">
          <div className="form-row-2">
            <div>
              <label>Kategori Survei</label>
              <select className="form-input" value={kategoriInput} onChange={(e) => setKategoriInput(e.target.value as KategoriSurvei)}>
                <option value="Flora">🌿 Flora</option>
                <option value="Fauna">🐾 Fauna</option>
                <option value="Mata Air">💧 Mata Air</option>
                <option value="Tanda Batas">🪧 Tanda Batas</option>
                <option value="Wilayah Adat / Lahan">⬢ Wilayah Adat / Lahan</option>
                <option value="Ancaman / Temuan">⚠️ Ancaman / Temuan</option>
              </select>
            </div>
            <div>
              <label>Nama Objek *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Masukkan nama objek"
                value={judulInput}
                onChange={(e) => setJudulInput(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-3">
            <div>
              <label>Nama Lokal</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nama lokal"
                value={namaLokalInput}
                onChange={(e) => setNamaLokalInput(e.target.value)}
              />
            </div>
            <div>
              <label>Nama Ilmiah</label>
              <input
                type="text"
                className="form-input"
                placeholder="Opsional"
                value={namaIlmiahInput}
                onChange={(e) => setNamaIlmiahInput(e.target.value)}
              />
            </div>
            <div>
              <label>Jumlah</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={jumlahIndividuInput}
                onChange={(e) => setJumlahIndividuInput(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label>Manfaat</label>
              <input
                type="text"
                className="form-input"
                placeholder="Manfaat bagi masyarakat"
                value={manfaatInput}
                onChange={(e) => setManfaatInput(e.target.value)}
              />
            </div>
            <div>
              <label>Kondisi</label>
              <input
                type="text"
                className="form-input"
                placeholder="Kondisi saat ini"
                value={kondisiInput}
                onChange={(e) => setKondisiInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>Catatan Lapangan</label>
            <textarea
              rows={2}
              className="form-input"
              placeholder="Catatan tambahan..."
              value={deskripsiInput}
              onChange={(e) => setDeskripsiInput(e.target.value)}
            />
          </div>

          <div className="form-photo-box">
            <label className="btn-upload-photo">
              <Camera size={16} /> Lampirkan Foto
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePilihFoto} />
            </label>
            {memprosesFoto && <span className="photo-ready-badge">Memproses foto…</span>}
            {!memprosesFoto && fotoInput && (
              <span className="photo-ready-badge">✓ Foto siap ({Math.round(perkiraBytesDataUrl(fotoInput) / 1024)} KB)</span>
            )}
            {galatFoto && (
              <span role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>
                {galatFoto}
              </span>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline-sm" onClick={onTutup}>
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan Lokasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
