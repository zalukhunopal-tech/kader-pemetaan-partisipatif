import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Leaf, PawPrint, Droplets, Flag, Flame, Trees, Landmark, House, MapPin } from "lucide-react";
import {
  BuktiFotoLapangan,
  DataSpasialItem,
  HasilRataRataGps,
  JenisGeometri,
  KategoriSurvei,
  KoordinatTitik,
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
import {
  susunAtributPolygonPrmAid,
  susunAtributLinePrmAid,
  susunAtributPointPrmAid
} from "../../lib/atributPrmAid";
import { BottomSheet } from "./BottomSheet";
import { PerekamMemoSuara } from "./PerekamMemoSuara";
import { KartuLokasiTitik } from "./KartuLokasiTitik";
import { bacaSistemKoordinat, simpanSistemKoordinat, SistemKoordinat } from "../../lib/sistemKoordinat";

export const KATEGORI_VISUAL: { kategori: KategoriSurvei; judul: string; contoh: string; Ikon: typeof Leaf }[] = [
  { kategori: "Tanda Batas", judul: "Batas desa / adat", contoh: "Patok, batas alam", Ikon: Flag },
  { kategori: "Wilayah Adat / Lahan", judul: "Lahan", contoh: "Hutan, kebun, ulayat", Ikon: Trees },
  { kategori: "Flora", judul: "Tumbuhan", contoh: "Pohon, anggrek", Ikon: Leaf },
  { kategori: "Fauna", judul: "Satwa", contoh: "Satwa, sarang, tapak", Ikon: PawPrint },
  { kategori: "Mata Air", judul: "Sumber air", contoh: "Mata air, aliran", Ikon: Droplets },
  { kategori: "Ancaman / Temuan", judul: "Ancaman", contoh: "Kebakaran, pembalakan", Ikon: Flame },
  { kategori: "Sarana Desa", judul: "Sarana desa", contoh: "Jalan, bangunan", Ikon: House },
  { kategori: "Situs Budaya", judul: "Situs budaya", contoh: "Sejarah, toponimi", Ikon: Landmark }
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
  const susunItem = (profil: ProfilKader, jenis: JenisGeometri, titik: KoordinatTitik[], kompas?: number): DataSpasialItem => {
    const waktu = new Date().toISOString();
    const item: DataSpasialItem = {
      id: buatId("SPS"),
      idKader: profil.idKader,
      namaKader: profil.nama,
      desaWilayah: profil.desaWilayah,
      ...capWilayah(profil.idKader),
      jenisGeometri: jenis,
      kategori: isian.kategori,
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
  onUbahKoordinat
}: FormSurveiModalProps) {
  const [sistemAktif, setSistemAktif] = useState<SistemKoordinat>(() => sistemKoordinat || bacaSistemKoordinat());
  useEffect(() => {
    if (sistemKoordinat) setSistemAktif(sistemKoordinat);
  }, [sistemKoordinat]);
  const [detail, setDetail] = useState(Boolean(form.isian.judul)),
    [stamp, setStamp] = useState(true),
    [memoSibuk, setMemoSibuk] = useState(false),
    [gpsSibuk, setGpsSibuk] = useState(false),
    [sampel, setSampel] = useState(0),
    [galatGps, setGalatGps] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const { isian, ubah } = form;
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
  return (
    <BottomSheet
      judul={
        modeRekam === "point"
          ? "Simpan Titik Lokasi"
          : modeRekam === "line"
            ? `Simpan Jalur · ${panjangDraftKm} km`
            : `Simpan Poligon · ${luasDraftHa} Ha`
      }
      onTutup={onTutup}
      awal={55}
      className="field-survey-sheet"
    >
      <p className="draft-status" role="status">
        Draf otomatis disimpan pada akun ini.
      </p>
      {!detail ? (
        <>
          <h4>Apa yang Anda temukan?</h4>
          <p className="field-help">Pilih kategori, lalu ceritakan temuan Anda.</p>
          <div className="visual-category-grid">
            {KATEGORI_VISUAL.map(({ kategori, judul, contoh, Ikon }) => (
              <button
                type="button"
                key={kategori}
                onClick={() => {
                  ubah("kategori", kategori);
                  setDetail(true);
                }}
              >
                <Ikon size={30} />
                <strong>{judul}</strong>
                <small>{contoh}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          className="modal-form field-survey-form"
          onSubmit={(e) => {
            if (gpsSibuk || memoSibuk || form.memprosesFoto) {
              e.preventDefault();
              return;
            }
            onSimpan(e);
          }}
        >
          <button type="button" className="field-category-selected" onClick={() => setDetail(false)}>
            {isian.kategori}
            <span>Ganti kategori</span>
          </button>
          {galatGeometri && (
            <p role="alert" className="field-error">
              {galatGeometri}
            </p>
          )}
          {field("judul", "Nama Objek *", true)}
          {modeRekam === "point" && (
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
          )}
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
            Catatan Lapangan
            <textarea
              rows={3}
              className="form-input"
              maxLength={10000}
              placeholder="Cerita tempat, kondisi, atau kesepakatan..."
              value={isian.deskripsi}
              onChange={(e) => ubah("deskripsi", e.target.value)}
            />
          </label>
          {(isian.kategori === "Tanda Batas" || isian.kategori === "Wilayah Adat / Lahan") && (
            <label>
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
          <div className="form-photo-box">
            <label className="btn-upload-photo">
              <Camera size={18} /> Lampirkan Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={form.memprosesFoto}
                onChange={(e) =>
                  form.handlePilihFoto(
                    e,
                    koordinat[0]
                      ? {
                          posisi: koordinat[0],
                          idKader: profil.idKader,
                          desa: profil.desaWilayah,
                          diambilPada: new Date().toISOString(),
                          stampVisual: stamp
                        }
                      : undefined
                  )
                }
              />
            </label>
            <label className="field-checkbox">
              <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} /> Tambahkan stamp lokasi survei pada foto
              berikutnya
            </label>
            <small>Stamp visual memakai lokasi survei, bukan EXIF asli kamera.</small>
            {form.memprosesFoto && <span role="status">Memproses foto…</span>}
            {isian.foto && (
              <>
                <img className="survey-photo-preview" src={isian.foto} alt="Bukti foto survei" />
                <span>Foto siap · {Math.round(perkiraBytesDataUrl(isian.foto) / 1024)} KB</span>
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => {
                    ubah("foto", "");
                    ubah("buktiFoto", undefined);
                  }}
                >
                  Hapus foto
                </button>
              </>
            )}
            {form.galatFoto && <p role="alert">{form.galatFoto}</p>}
          </div>
          <PerekamMemoSuara
            memo={isian.memo}
            onTambah={form.tambahMemo}
            onHapus={(id) =>
              ubah(
                "memo",
                isian.memo.filter((m) => m.id !== id)
              )
            }
            onSibuk={setMemoSibuk}
          />
          <footer className="modal-footer">
            <button type="button" className="btn-outline-sm" onClick={onTutup}>
              Tutup, simpan draf
            </button>
            <button type="submit" className="btn-primary" disabled={gpsSibuk || memoSibuk || form.memprosesFoto || Boolean(galatGeometri)}>
              Simpan Lokasi
            </button>
          </footer>
        </form>
      )}
    </BottomSheet>
  );
}
