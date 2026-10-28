import React from "react";
import { WilayahAdministrasi } from "../types";
import { DAFTAR_PROVINSI, rapikanNamaWilayah } from "../lib/wilayah";

interface IsianWilayahProps {
  idAwalan: string;
  nilai: WilayahAdministrasi;
  onUbah: (w: WilayahAdministrasi) => void;
  /** Wilayah akun lain di perangkat ini: ejaannya disarankan supaya tidak terbentuk folder Drive ganda */
  saran: (WilayahAdministrasi | undefined)[];
  wajib?: boolean;
}

const unik = (daftar: string[]) => [...new Set(daftar.map(rapikanNamaWilayah).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
const sama = (a: string, b: string) => rapikanNamaWilayah(a).toLowerCase() === rapikanNamaWilayah(b).toLowerCase();

/** Wilayah tugas: provinsi, kabupaten/kota, kecamatan, kelurahan/desa (menentukan folder Google Drive) */
export const IsianWilayah: React.FC<IsianWilayahProps> = ({ idAwalan, nilai, onUbah, saran, wajib }) => {
  const ada = saran.filter((w): w is WilayahAdministrasi => !!w);
  // Saran tingkat bawah mengikuti tingkat di atasnya yang sudah diisi
  const saranKab = unik(ada.filter((w) => !nilai.provinsi || sama(w.provinsi, nilai.provinsi)).map((w) => w.kabupaten));
  const saranKec = unik(ada.filter((w) => !nilai.kabupaten || sama(w.kabupaten, nilai.kabupaten)).map((w) => w.kecamatan));
  const saranDesa = unik(ada.filter((w) => !nilai.kecamatan || sama(w.kecamatan, nilai.kecamatan)).map((w) => w.desa));
  const ubah = (kunci: keyof WilayahAdministrasi, v: string) => onUbah({ ...nilai, [kunci]: v });
  const tanda = wajib ? " *" : "";

  const isian = (kunci: "kabupaten" | "kecamatan" | "desa", label: string, contoh: string, daftar: string[]) => (
    <div>
      <label htmlFor={`${idAwalan}-${kunci}`}>
        {label}
        {tanda}
      </label>
      <input
        id={`${idAwalan}-${kunci}`}
        className="form-input"
        required={wajib}
        list={`${idAwalan}-${kunci}-saran`}
        placeholder={contoh}
        value={nilai[kunci]}
        onChange={(e) => ubah(kunci, e.target.value)}
      />
      <datalist id={`${idAwalan}-${kunci}-saran`}>
        {daftar.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );

  return (
    <div className="form-row-2 isian-wilayah">
      <div>
        <label htmlFor={`${idAwalan}-provinsi`}>Provinsi{tanda}</label>
        <select
          id={`${idAwalan}-provinsi`}
          className="form-input"
          required={wajib}
          value={nilai.provinsi}
          onChange={(e) => ubah("provinsi", e.target.value)}
        >
          <option value="">Pilih provinsi</option>
          {DAFTAR_PROVINSI.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {nilai.provinsi && !DAFTAR_PROVINSI.includes(nilai.provinsi) && <option value={nilai.provinsi}>{nilai.provinsi}</option>}
        </select>
      </div>
      {isian("kabupaten", "Kabupaten/Kota", "mis. Kabupaten Merangin", saranKab)}
      {isian("kecamatan", "Kecamatan", "mis. Bangko", saranKec)}
      {isian("desa", "Kelurahan/Desa", "mis. Rantau Panjang", saranDesa)}
    </div>
  );
};
