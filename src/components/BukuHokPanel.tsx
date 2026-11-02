import { aksesAdminSah, muatSesiPengguna } from "../lib/auth";
import { useEffect, useState } from "react";
import { DataSpasialItem, KonfigurasiHok, ProfilKader, SesiPatroliHok } from "../types";
import { hitungBukuHok, eksporHokCSV, eksporHokPDF, KONFIGURASI_HOK_CONTOH } from "../lib/hok";
import { bacaTeks, tulisTeks } from "../lib/penyimpanan";
import { unduhLokal } from "../lib/cadangan";
import { buatId } from "../lib/id";
const KUNCI = "titik_tapak_hok_v1";
type ProgramHok = { config: KonfigurasiHok; sesi: SesiPatroliHok[] };
function bacaSemua(): Record<string, ProgramHok> {
  try {
    return JSON.parse(bacaTeks(KUNCI) ?? "{}");
  } catch {
    return {};
  }
}
export function BukuHokPanel({ data, profil, admin = false }: { data: DataSpasialItem[]; profil: ProfilKader; admin?: boolean }) {
  const [program, setProgram] = useState(() => `desa:${profil.desaWilayah}`),
    [semua, setSemua] = useState(bacaSemua),
    [mulai, setMulai] = useState(""),
    [selesai, setSelesai] = useState(""),
    [jarak, setJarak] = useState("0"),
    [pesan, setPesan] = useState("");
  const nilai = semua[program] ?? { config: { ...KONFIGURASI_HOK_CONTOH, idProgram: program }, sesi: [] };
  const [configDraf, setConfigDraf] = useState<KonfigurasiHok | null>(null);
  useEffect(() => {
    tulisTeks(KUNCI, JSON.stringify(semua));
  }, [semua]);
  const simpan = (p: ProgramHok) => setSemua((s) => ({ ...s, [program]: p }));
  let buku: ReturnType<typeof hitungBukuHok> = [],
    galat = "";
  try {
    buku = hitungBukuHok(
      admin ? data : data.filter((d) => d.idKader === profil.idKader),
      nilai.sesi.filter((s) => admin || s.idKader === profil.idKader),
      nilai.config
    );
  } catch (e) {
    galat = e instanceof Error ? e.message : "Buku HOK tidak dapat dihitung.";
  }
  const catat = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baru: SesiPatroliHok = {
        id: buatId("PATROLI"),
        idKader: profil.idKader,
        mulai: new Date(mulai).toISOString(),
        selesai: new Date(selesai).toISOString(),
        kmMedanBerat: Number(jarak),
        terverifikasi: false
      };
      const daftar = [...nilai.sesi, baru];
      hitungBukuHok(
        [],
        daftar.map((s) => ({ ...s, terverifikasi: true })),
        nilai.config
      );
      simpan({ ...nilai, sesi: daftar });
      setMulai("");
      setSelesai("");
      setPesan("Sesi disimpan. Menunggu pemeriksaan admin pada perangkat ini.");
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Waktu patroli tidak valid.");
    }
  };
  const ekspor = async (pdf: boolean) => {
    try {
      if (galat) throw new Error(galat);
      if (pdf) {
        const bytes = await eksporHokPDF(buku);
        unduhLokal("buku-hok.pdf", bytes.slice().buffer as ArrayBuffer, "application/pdf");
      } else unduhLokal("buku-hok.csv", eksporHokCSV(buku), "text/csv;charset=utf-8");
      setPesan("Buku HOK disiapkan untuk diunduh.");
    } catch (e) {
      setPesan(e instanceof Error ? e.message : "Ekspor gagal.");
    }
  };
  return (
    <section className="section-card hok-panel">
      <span className="field-eyebrow">KERJA LAPANGAN, TERCATAT JELAS</span>
      <h3>Buku HOK</h3>
      <p className="field-help">
        Catatan pada perangkat ini. Hanya sesi dan temuan yang telah diverifikasi dihitung. Nilai HOK bukan persetujuan pembayaran.
      </p>
      {admin && (
        <label>
          Desa / program
          <input
            className="form-input"
            value={program}
            maxLength={100}
            onChange={(e) => {
              setProgram(e.target.value);
              setConfigDraf(null);
            }}
          />
        </label>
      )}
      {!admin && (
        <label>
          Program
          <select className="form-input" value={program} onChange={(e) => setProgram(e.target.value)}>
            {Array.from(new Set([`desa:${profil.desaWilayah}`, ...Object.keys(semua)])).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        <strong>{nilai.config.idProgram}</strong> · Rumus {nilai.config.versi} · {nilai.config.zonaWaktu}
      </p>
      <p className="hok-formula">
        Jam efektif ÷ {nilai.config.jamPerHok} × {nilai.config.bobotJam} + km medan berat × {nilai.config.hokPerKmMedanBerat} + titik Grade
        A × {nilai.config.bonusTitikGradeA}. Batas {nilai.config.batasHokPerHari} HOK/hari.
      </p>
      {admin && (
        <details>
          <summary>Atur rumus program</summary>
          <form
            className="field-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                if (!admin || !aksesAdminSah(muatSesiPengguna())) throw new Error("Sesi admin sudah terkunci. Buka kembali mode admin.");
                const c = configDraf ?? nilai.config;
                hitungBukuHok([], [], c);
                simpan({ ...nilai, config: c });
                setPesan("Rumus program disimpan pada perangkat ini.");
              } catch (err) {
                setPesan(err instanceof Error ? err.message : "Rumus tidak valid.");
              }
            }}
          >
            {(
              [
                ["jamPerHok", "Jam per HOK"],
                ["bobotJam", "Bobot jam efektif"],
                ["hokPerKmMedanBerat", "HOK per km medan berat"],
                ["bonusTitikGradeA", "Bonus titik Grade A"],
                ["batasHokPerHari", "Batas HOK per hari"]
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className="form-input"
                  type="number"
                  min={key === "jamPerHok" ? 0.01 : 0}
                  step="any"
                  required
                  value={(configDraf ?? nilai.config)[key]}
                  onChange={(e) => setConfigDraf((c) => ({ ...(c ?? nilai.config), [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <label>
              Versi rumus
              <input
                className="form-input"
                required
                value={(configDraf ?? nilai.config).versi}
                onChange={(e) => setConfigDraf((c) => ({ ...(c ?? nilai.config), versi: e.target.value }))}
              />
            </label>
            <label>
              Zona waktu
              <select
                className="form-input"
                value={(configDraf ?? nilai.config).zonaWaktu}
                onChange={(e) => setConfigDraf((c) => ({ ...(c ?? nilai.config), zonaWaktu: e.target.value }))}
              >
                <option>Asia/Jakarta</option>
                <option>Asia/Makassar</option>
                <option>Asia/Jayapura</option>
              </select>
            </label>
            <button type="submit" className="btn-primary-sm">
              Simpan rumus
            </button>
          </form>
        </details>
      )}
      <details>
        <summary>Catat sesi patroli</summary>
        <form className="field-form-grid" onSubmit={catat}>
          <label>
            Mulai (waktu perangkat)
            <input type="datetime-local" className="form-input" required value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </label>
          <label>
            Selesai
            <input type="datetime-local" className="form-input" required value={selesai} onChange={(e) => setSelesai(e.target.value)} />
          </label>
          <label>
            Jarak medan berat (km)
            <input
              type="number"
              className="form-input"
              min={0}
              step="0.001"
              required
              value={jarak}
              onChange={(e) => setJarak(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-outline-sm">
            Catat, menunggu verifikasi
          </button>
        </form>
      </details>
      {nilai.sesi
        .filter((s) => !s.terverifikasi && (admin || s.idKader === profil.idKader))
        .map((s) => (
          <div className="hok-pending" key={s.id}>
            <span>
              {s.idKader} · {new Date(s.mulai).toLocaleString("id-ID")} → {new Date(s.selesai).toLocaleString("id-ID")} · {s.kmMedanBerat}{" "}
              km · menunggu admin
            </span>
            {admin && (
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => {
                  try {
                    if (!admin || !aksesAdminSah(muatSesiPengguna())) throw new Error("Sesi admin sudah terkunci.");
                    const daftar = nilai.sesi.map((v) => (v.id === s.id ? { ...v, terverifikasi: true } : v));
                    hitungBukuHok(data, daftar, nilai.config);
                    simpan({ ...nilai, sesi: daftar });
                  } catch (e) {
                    setPesan(e instanceof Error ? e.message : "Verifikasi gagal.");
                  }
                }}
              >
                Sahkan sesi
              </button>
            )}
          </div>
        ))}
      {galat && <p role="alert">{galat}</p>}
      {buku.length ? (
        <div className="table-responsive">
          <table className="data-table">
            <caption>Rincian harian · {nilai.config.versi}</caption>
            <thead>
              <tr>
                <th>Tanggal / Kader</th>
                <th>Menit</th>
                <th>Km berat</th>
                <th>Titik A</th>
                <th>Jam + jarak + bonus</th>
                <th>HOK dibatasi</th>
              </tr>
            </thead>
            <tbody>
              {buku.map((b) => (
                <tr key={`${b.tanggal}:${b.idKader}`}>
                  <td>
                    {b.tanggal}
                    <br />
                    {b.idKader}
                  </td>
                  <td>{b.menitEfektif.toFixed(1)}</td>
                  <td>{b.kmMedanBerat.toFixed(3)}</td>
                  <td>{b.titikGradeA}</td>
                  <td>
                    {b.hokJam.toFixed(3)} + {b.hokJarak.toFixed(3)} + {b.hokBonus.toFixed(3)}
                  </td>
                  <td>
                    <strong>{b.totalHok.toFixed(3)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Belum ada HOK terverifikasi pada program ini.</p>
      )}
      <div className="field-button-row">
        <button type="button" className="btn-outline-sm" disabled={!buku.length || Boolean(galat)} onClick={() => void ekspor(false)}>
          Ekspor CSV
        </button>
        <button type="button" className="btn-outline-sm" disabled={!buku.length || Boolean(galat)} onClick={() => void ekspor(true)}>
          Ekspor PDF
        </button>
      </div>
      <p role="status">{pesan}</p>
    </section>
  );
}
