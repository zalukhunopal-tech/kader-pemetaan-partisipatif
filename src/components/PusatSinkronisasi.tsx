import { useEffect, useState } from "react";
import { Cloud, HardDrive, ListOrdered, Download, RefreshCw } from "lucide-react";
import { AreaPetaOffline, DataSpasialItem, PilihanResolusiKonflik } from "../types";
import { perkiraanPenyimpanan, PerkiraanPenyimpanan, formatUkuranByte, useStatusPenyimpanan } from "../lib/penyimpanan";
import { perkiraBytesDataUrl } from "../lib/foto";
import { eksporKeGeoJSON } from "../lib/geoUtils";
import { cadanganSurveiZip, unduhLokal } from "../lib/cadangan";
import { bacaAntreanSinkron } from "../lib/gdriveBertahap";
import { BottomSheet } from "./peta/BottomSheet";

export function PusatSinkronisasi({
  data,
  peta,
  sedangSinkron,
  onResolusi
}: {
  data: DataSpasialItem[];
  peta: AreaPetaOffline[];
  sedangSinkron: boolean;
  onResolusi: (id: string, pilihan: PilihanResolusiKonflik, gabungan?: Partial<DataSpasialItem>) => void;
}) {
  const [ruang, setRuang] = useState<PerkiraanPenyimpanan | null>(null),
    [pesan, setPesan] = useState(""),
    [pilihKonflik, setPilihKonflik] = useState<string | null>(null),
    [geometri, setGeometri] = useState<"lokal" | "admin">("lokal"),
    [atribut, setAtribut] = useState<"lokal" | "admin">("lokal");
  const status = useStatusPenyimpanan();
  const ukur = () => {
    void perkiraanPenyimpanan()
      .then(setRuang)
      .catch(() => setRuang(null));
  };
  useEffect(() => {
    let aktif = true;
    void perkiraanPenyimpanan().then((r) => {
      if (aktif) setRuang(r);
    });
    return () => {
      aktif = false;
    };
  }, [data, peta, sedangSinkron]);
  const lokal = data.filter((d) => d.statusSinkron === "lokal"),
    lengkap = data.filter((d) => d.statusSinkron === "tersinkron" || d.statusSinkron === "terverifikasi");
  const bytesFoto = lokal.reduce((n, d) => n + perkiraBytesDataUrl(d.fotoBase64 ?? ""), 0),
    bytesAudio = lokal.reduce((n, d) => n + (d.memoSuara ?? []).reduce((a, m) => a + m.ukuranByte, 0), 0),
    antrean = bacaAntreanSinkron();
  const item = data.find((d) => d.id === pilihKonflik),
    k = item?.konflikSinkron;
  const backup = (zip: boolean) => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (zip) {
        const bytes = cadanganSurveiZip(data, peta);
        unduhLokal(`titik-tapak-${stamp}.zip`, bytes.buffer as ArrayBuffer, "application/zip");
      } else unduhLokal(`titik-tapak-${stamp}.geojson`, eksporKeGeoJSON(data), "application/geo+json");
      setPesan("Cadangan disiapkan untuk diunduh ke perangkat.");
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Cadangan gagal dibuat.");
    }
  };
  const resolve = (pilihan: PilihanResolusiKonflik) => {
    if (!k) return;
    const sumber = atribut === "lokal" ? k.lokal : k.server,
      geo = geometri === "lokal" ? k.lokal : k.server;
    onResolusi(
      k.idData,
      pilihan,
      pilihan === "gabungkan"
        ? {
            ...sumber,
            jenisGeometri: geo.jenisGeometri,
            koordinat: geo.koordinat,
            panjangKm: geo.panjangKm,
            luasHa: geo.luasHa,
            gpsAveraging: geo.gpsAveraging
          }
        : undefined
    );
    setPilihKonflik(null);
  };
  return (
    <>
      <section className="section-card sync-center">
        <header>
          <span className="field-eyebrow">DARI LAPANGAN KE DESA</span>
          <h2>Setiap temuan tetap tersimpan</h2>
          <p className="field-help">Unggahan hanya selesai setelah seluruh data dikonfirmasi server.</p>
        </header>
        <ol className="sync-pipeline" aria-label="Pipeline sinkronisasi">
          <li>
            <HardDrive />
            <strong>{data.length}</strong>
            <span>Lokal di HP</span>
          </li>
          <li aria-current={sedangSinkron ? "step" : undefined}>
            <ListOrdered />
            <strong>{lokal.length}</strong>
            <span>Antrean prioritas</span>
            <small>Teks → foto & suara</small>
          </li>
          <li>
            <Cloud />
            <strong>{lengkap.length}</strong>
            <span>Google Drive desa</span>
            <small>Sudah dikonfirmasi</small>
          </li>
        </ol>
        {lokal.map((d) => {
          const a = antrean[d.id];
          return a && a.fase !== "selesai" ? (
            <div key={d.id} className="sync-job">
              <strong>{d.judul}</strong>
              <span>
                {a.fase === "metadata"
                  ? "Metadata"
                  : a.fase === "media"
                    ? "Mengirim lampiran"
                    : a.fase === "konflik"
                      ? "Perlu tinjau konflik"
                      : "Menunggu ulang"}
              </span>
              <progress aria-label={`Unggahan ${d.judul}`} max={Math.max(1, a.jumlahChunk)} value={a.chunkDiterima.length} />
              <small>
                {a.chunkDiterima.length}/{a.jumlahChunk} bagian
                {a.cobaLagiPada ? ` · Coba lagi setelah ${new Date(a.cobaLagiPada).toLocaleTimeString("id-ID")}` : ""}
              </small>
              {a.galat && <p>{a.galat}</p>}
            </div>
          ) : null;
        })}
      </section>
      <section className="section-card storage-diagnostics">
        <div className="section-header-flex">
          <h3>Ruang offline perangkat</h3>
          <button type="button" className="btn-outline-sm" onClick={ukur}>
            <RefreshCw size={16} /> Periksa ruang
          </button>
        </div>
        {ruang ? (
          <>
            <progress aria-label="Kapasitas penyimpanan terpakai" max={100} value={ruang.persen} />
            <p>
              {formatUkuranByte(ruang.pakaiByte)} dipakai · {formatUkuranByte(Math.max(0, ruang.kuotaByte - ruang.pakaiByte))} tersedia
            </p>
          </>
        ) : (
          <p>Browser belum memberikan perkiraan kuota penyimpanan.</p>
        )}
        <p className="field-help">
          Penyimpanan: {status.mode} · {status.persisten ? "Persisten" : "Dapat dibersihkan browser"}. Kuota dibagi IndexedDB, cache peta
          dan OPFS pada asal situs ini.
        </p>
        <div className="storage-stats">
          <span>
            Foto antrean <strong>{formatUkuranByte(bytesFoto)}</strong>
          </span>
          <span>
            Suara antrean <strong>{formatUkuranByte(bytesAudio)}</strong>
          </span>
          <span>
            Peta tercatat <strong>{formatUkuranByte(peta.reduce((n, p) => n + p.ukuranMb * 1024 * 1024, 0))}</strong>
          </span>
        </div>
        {peta.length > 0 && (
          <details>
            <summary>Ukuran tiap peta ({peta.length})</summary>
            <ul>
              {peta.map((p) => (
                <li key={p.id}>
                  {p.namaArea} · {p.jenisFile ?? "Peta offline"} · {formatUkuranByte(p.ukuranMb * 1024 * 1024)}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="field-button-row">
          <button type="button" className="btn-outline-sm" onClick={() => backup(false)}>
            <Download size={16} /> Cadangan geometri (.geojson)
          </button>
          <button type="button" className="btn-primary-sm" onClick={() => backup(true)}>
            <Download size={16} /> Survei + media (.zip)
          </button>
        </div>
        <p className="field-help">ZIP berisi geometri, atribut, foto dan suara survei. Berkas peta dasar dan akun tidak disertakan.</p>
        <p role="status">{pesan}</p>
      </section>
      {data.some((d) => d.konflikSinkron) && (
        <section className="section-card field-conflicts">
          <h3>Perubahan perlu ditinjau</h3>
          <p>Versi lokal dan revisi admin disimpan. Pilih hasilnya sebelum mengunggah ulang.</p>
          {data
            .filter((d) => d.konflikSinkron)
            .map((d) => (
              <button
                type="button"
                key={d.id}
                className="btn-outline-sm"
                onClick={() => {
                  setPilihKonflik(d.id);
                  setGeometri("lokal");
                  setAtribut("lokal");
                }}
              >
                Tinjau konflik: {d.judul}
              </button>
            ))}
        </section>
      )}
      {k && (
        <BottomSheet judul="Selesaikan konflik survei" onTutup={() => setPilihKonflik(null)} awal={92} className="conflict-sheet">
          <p>Catatan admin: {k.server.catatanAdmin || "Tidak ada catatan"}</p>
          <div className="conflict-comparison">
            {[
              ["Versi lokal", k.lokal],
              ["Versi admin", k.server]
            ].map(([judul, d]) => {
              const v = d as DataSpasialItem;
              return (
                <article key={String(judul)}>
                  <h4>{String(judul)}</h4>
                  <strong>{v.judul}</strong>
                  <p>{v.deskripsi}</p>
                  <p>
                    {v.koordinat.length} vertex · {v.jenisGeometri}
                  </p>
                  <p>Nama lokal: {v.namaLokal || "—"}</p>
                  <p>Status: {v.statusSinkron}</p>
                </article>
              );
            })}
          </div>
          <div className="field-button-row">
            <button type="button" className="btn-outline-sm" onClick={() => resolve("lokal")}>
              Simpan Versi Lokal
            </button>
            <button type="button" className="btn-outline-sm" onClick={() => resolve("admin")}>
              Gunakan Versi Admin
            </button>
          </div>
          <fieldset>
            <legend>Gabungkan secara eksplisit</legend>
            <label>
              Atribut & media
              <select className="form-input" value={atribut} onChange={(e) => setAtribut(e.target.value as "lokal" | "admin")}>
                <option value="lokal">Pakai versi lokal</option>
                <option value="admin">Pakai versi admin</option>
              </select>
            </label>
            <label>
              Geometri
              <select className="form-input" value={geometri} onChange={(e) => setGeometri(e.target.value as "lokal" | "admin")}>
                <option value="lokal">Pakai geometri lokal</option>
                <option value="admin">Pakai geometri admin</option>
              </select>
            </label>
            <button type="button" className="btn-primary-sm" onClick={() => resolve("gabungkan")}>
              Gabungkan pilihan
            </button>
          </fieldset>
          <p className="field-help">Catatan admin dipertahankan. Pilihan lokal/gabungan masuk antrean untuk dikirim ulang.</p>
        </BottomSheet>
      )}
    </>
  );
}
