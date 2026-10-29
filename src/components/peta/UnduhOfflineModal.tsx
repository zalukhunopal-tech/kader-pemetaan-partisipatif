import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AreaPetaOffline, BasemapType } from "../../types";
import { buatId } from "../../lib/id";
import {
  BATAS_TILE_PER_AREA,
  KotakWilayah,
  NAMA_ENV_SUMBER,
  SUMBER_TILE,
  daftarTile,
  hapusTile,
  hitungJumlahTile,
  isiTemplateTile,
  penyimpananTileDidukung,
  perkiraanUkuranMb,
  ukuranPenyimpanan,
  unduhTile,
  unduhanLayak
} from "../../lib/petaOffline";

/**
 * Keadaan pengunduh peta offline. Dipegang oleh peta (bukan oleh modal) supaya unduhan tetap berjalan
 * walau modal ditutup, dan dihentikan bila peta ditutup.
 */
export function useUnduhAreaOffline(
  basemap: BasemapType,
  areaOffline: AreaPetaOffline[],
  onSimpanAreaOffline: (area: AreaPetaOffline) => void
) {
  const [bukaModalOffline, setBukaModalOffline] = useState<boolean>(false);
  const [namaAreaOfflineBaru, setNamaAreaOfflineBaru] = useState<string>("");
  const [sedangMengunduhTile, setSedangMengunduhTile] = useState<boolean>(false);
  const [kotakUnduh, setKotakUnduh] = useState<KotakWilayah | null>(null);
  const [zoomMinUnduh, setZoomMinUnduh] = useState<number>(13);
  const [zoomMaksUnduh, setZoomMaksUnduh] = useState<number>(17);
  const [kemajuanUnduh, setKemajuanUnduh] = useState<{ selesai: number; total: number; gagal: number } | null>(null);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);
  const [ruangPenyimpanan, setRuangPenyimpanan] = useState<{ pakaiMb: number; kuotaMb: number } | null>(null);
  const batalUnduhRef = useRef<AbortController | null>(null);

  // Unduhan yang sedang berjalan dihentikan bila peta ditutup (tile yang sudah masuk dibersihkan)
  useEffect(() => () => batalUnduhRef.current?.abort(), []);

  /** Membuka modal untuk kotak wilayah yang sedang tampil; rentang zoom bawaan ±2 dari zoom peta */
  const bukaModalUnduh = (kotak: KotakWilayah, zoom: number) => {
    setKotakUnduh(kotak);
    setZoomMinUnduh(Math.max(10, Math.round(zoom) - 2));
    setZoomMaksUnduh(Math.min(18, Math.round(zoom) + 2));
    setGalatUnduh(null);
    setKemajuanUnduh(null);
    void ukuranPenyimpanan().then(setRuangPenyimpanan);
    setBukaModalOffline(true);
  };

  const [tetapUnduh, setTetapUnduh] = useState(false);
  const sumberUnduh = basemap === "taktis" ? null : SUMBER_TILE[basemap];
  const bolehUnduhFinal = Boolean(sumberUnduh && (sumberUnduh.bolehUnduh || tetapUnduh));
  const jumlahTileUnduh = kotakUnduh && basemap !== "taktis" ? hitungJumlahTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh) : 0;
  const kelebihanTile = jumlahTileUnduh > BATAS_TILE_PER_AREA;
  const bisaUnduh = sumberUnduh !== null && bolehUnduhFinal && penyimpananTileDidukung() && jumlahTileUnduh > 0 && !kelebihanTile;

  const handleUnduhAreaOffline = async () => {
    if (!bisaUnduh || !kotakUnduh || !sumberUnduh || basemap === "taktis") return;
    const daftarUrl = daftarTile(kotakUnduh, zoomMinUnduh, zoomMaksUnduh)
      .map((t) => isiTemplateTile(sumberUnduh.template, t.z, t.x, t.y))
      .filter((u): u is string => u !== null);

    const pengendali = new AbortController();
    batalUnduhRef.current = pengendali;
    setSedangMengunduhTile(true);
    setGalatUnduh(null);
    setKemajuanUnduh({ selesai: 0, total: daftarUrl.length, gagal: 0 });
    try {
      const hasil = await unduhTile(daftarUrl, {
        sinyal: pengendali.signal,
        onKemajuan: (selesai, total, gagal) => setKemajuanUnduh({ selesai, total, gagal })
      });
      if (!unduhanLayak(hasil, daftarUrl.length)) {
        await hapusTile(hasil.urlBaru); // kembalikan penyimpanan seperti semula
        setGalatUnduh(
          hasil.dihentikan
            ? "Unduhan dibatalkan. Tile yang sudah masuk dibersihkan."
            : hasil.kuotaPenuh
              ? "Penyimpanan HP penuh. Kosongkan ruang atau pilih area dan zoom yang lebih kecil."
              : `Unduhan gagal: ${hasil.gagal + hasil.tidakAda} dari ${daftarUrl.length} tile tidak dapat diambil. Periksa koneksi dan sumber tile, lalu coba lagi.`
        );
        return;
      }
      onSimpanAreaOffline({
        id: buatId("OFF"),
        namaArea: namaAreaOfflineBaru.trim() || `Peta Offline ${areaOffline.length + 1}`,
        basemapId: basemap,
        ...kotakUnduh,
        zoomMin: zoomMinUnduh,
        zoomMax: zoomMaksUnduh,
        jumlahTile: hasil.tersimpan + hasil.sudahAda,
        ukuranMb: Number((hasil.byte / 1_000_000).toFixed(2)),
        jumlahGagal: hasil.gagal + hasil.tidakAda,
        diunduhPada: new Date().toISOString(),
        jenisFile: "XYZ Tiles",
        unduhanNyata: true,
        templateTile: sumberUnduh.template
      });
      setNamaAreaOfflineBaru("");
      setBukaModalOffline(false);
    } catch {
      setGalatUnduh("Unduhan terhenti karena galat tak terduga. Coba lagi.");
    } finally {
      setSedangMengunduhTile(false);
      setKemajuanUnduh(null);
      batalUnduhRef.current = null;
    }
  };

  return {
    bukaModalOffline,
    setBukaModalOffline,
    bukaModalUnduh,
    namaAreaOfflineBaru,
    setNamaAreaOfflineBaru,
    sedangMengunduhTile,
    zoomMinUnduh,
    setZoomMinUnduh,
    zoomMaksUnduh,
    setZoomMaksUnduh,
    kemajuanUnduh,
    galatUnduh,
    ruangPenyimpanan,
    sumberUnduh,
    jumlahTileUnduh,
    kelebihanTile,
    bolehUnduhFinal,
    setTetapUnduh,
    bisaUnduh,
    handleUnduhAreaOffline,
    batalkanUnduhan: () => batalUnduhRef.current?.abort()
  };
}

interface UnduhOfflineModalProps {
  basemap: BasemapType;
  areaOffline: AreaPetaOffline[];
  unduh: ReturnType<typeof useUnduhAreaOffline>;
  /** Memusatkan peta ke area offline yang dipilih */
  onBukaArea: (pusat: { lat: number; lng: number }) => void;
}

/** Modal pengunduh tile peta (Satelit/Topografi/OSM) untuk dipakai tanpa internet */
export const UnduhOfflineModal: React.FC<UnduhOfflineModalProps> = ({ basemap, areaOffline, unduh, onBukaArea }) => {
  const {
    setBukaModalOffline,
    namaAreaOfflineBaru,
    setNamaAreaOfflineBaru,
    sedangMengunduhTile,
    zoomMinUnduh,
    setZoomMinUnduh,
    zoomMaksUnduh,
    setZoomMaksUnduh,
    kemajuanUnduh,
    galatUnduh,
    ruangPenyimpanan,
    sumberUnduh,
    jumlahTileUnduh,
    kelebihanTile,
    bolehUnduhFinal,
    setTetapUnduh,
    bisaUnduh,
    handleUnduhAreaOffline,
    batalkanUnduhan
  } = unduh;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>📥 Unduh Peta Offline</h3>
          <button type="button" className="btn-icon-close" onClick={() => setBukaModalOffline(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-form">
          {basemap === "taktis" || sumberUnduh === null ? (
            <p className="text-muted" style={{ fontSize: "0.84rem", margin: 0 }}>
              Peta Kontur digambar langsung oleh aplikasi dan sudah tersedia tanpa internet. Pilih Satelit, Topografi, atau OSM bila ingin
              mengunduh tile.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "0.84rem" }}>
                Area: bagian peta yang terlihat sekarang. Sumber: <strong>{sumberUnduh.nama}</strong>.
              </p>

              {!bolehUnduhFinal && (
                <div
                  className="alert-banner-success"
                  style={{ margin: 0, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
                >
                  {sumberUnduh.alasanTidakBoleh}{" "}
                  {basemap === "google" || basemap === "esri" ? (
                    <>Untuk peta offline, pilih Satelit Sentinel-2, Topografi, atau OSM dengan penyedia tile yang mengizinkan unduhan.</>
                  ) : (
                    <>
                      Untuk mengunduh, pasang penyedia tile yang lisensinya mengizinkan lewat{" "}
                      <code>VITE_TILE_URL_{NAMA_ENV_SUMBER[basemap]}</code> dan <code>VITE_TILE_UNDUH_{NAMA_ENV_SUMBER[basemap]}=true</code>{" "}
                      di berkas <code>.env</code>, lalu bangun ulang aplikasi.
                    </>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                      onClick={() => setTetapUnduh(true)}
                    >
                      Tetap Izinkan Unduh untuk Wilayah Lapangan
                    </button>
                  </div>
                </div>
              )}

              {!penyimpananTileDidukung() && (
                <div
                  className="alert-banner-success"
                  style={{ margin: 0, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
                >
                  Penyimpanan offline membutuhkan HTTPS atau localhost. Buka aplikasi lewat alamat aman.
                </div>
              )}

              {bolehUnduhFinal && penyimpananTileDidukung() && (
                <>
                  <div>
                    <label>Nama Area Peta Offline</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Masukkan nama area"
                      value={namaAreaOfflineBaru}
                      disabled={sedangMengunduhTile}
                      onChange={(e) => setNamaAreaOfflineBaru(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label htmlFor="zoom-min-unduh">Zoom terjauh</label>
                      <select
                        id="zoom-min-unduh"
                        className="form-input"
                        value={zoomMinUnduh}
                        disabled={sedangMengunduhTile}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setZoomMinUnduh(v);
                          if (v > zoomMaksUnduh) setZoomMaksUnduh(v);
                        }}
                      >
                        {Array.from({ length: 9 }, (_, i) => 10 + i).map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="zoom-maks-unduh">Zoom terdekat</label>
                      <select
                        id="zoom-maks-unduh"
                        className="form-input"
                        value={zoomMaksUnduh}
                        disabled={sedangMengunduhTile}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setZoomMaksUnduh(v);
                          if (v < zoomMinUnduh) setZoomMinUnduh(v);
                        }}
                      >
                        {Array.from({ length: 9 }, (_, i) => 10 + i).map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p id="perkiraan-unduh" style={{ margin: 0, fontSize: "0.84rem", color: kelebihanTile ? "#b91c1c" : undefined }}>
                    {kelebihanTile
                      ? `${jumlahTileUnduh.toLocaleString("id-ID")} tile melebihi batas ${BATAS_TILE_PER_AREA.toLocaleString("id-ID")} per area. Perbesar peta (zoom in) atau kurangi zoom terdekat.`
                      : `${jumlahTileUnduh.toLocaleString("id-ID")} tile, perkiraan ±${perkiraanUkuranMb(jumlahTileUnduh, basemap).toFixed(1)} MB.`}
                    {ruangPenyimpanan &&
                      ` Penyimpanan HP: ${ruangPenyimpanan.pakaiMb.toFixed(0)} MB terpakai dari ${ruangPenyimpanan.kuotaMb.toFixed(0)} MB.`}
                  </p>
                </>
              )}
            </>
          )}

          {galatUnduh && (
            <div className="alert-banner-success" style={{ margin: 0, background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}>
              {galatUnduh}
            </div>
          )}

          {kemajuanUnduh && (
            <div>
              <progress value={kemajuanUnduh.selesai} max={Math.max(1, kemajuanUnduh.total)} style={{ width: "100%" }} />
              <small className="text-muted" id="kemajuan-unduh">
                {kemajuanUnduh.selesai.toLocaleString("id-ID")} dari {kemajuanUnduh.total.toLocaleString("id-ID")} tile
                {kemajuanUnduh.gagal > 0 ? `, ${kemajuanUnduh.gagal} gagal` : ""}. Biarkan layar ini terbuka.
              </small>
            </div>
          )}

          {sedangMengunduhTile ? (
            <button type="button" className="btn-outline-sm" onClick={batalkanUnduhan}>
              Batalkan Unduhan
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!bisaUnduh} onClick={() => void handleUnduhAreaOffline()}>
              ⬇️ Unduh Sekarang
            </button>
          )}

          {areaOffline.length > 0 && (
            <div className="offline-list" style={{ marginTop: 8 }}>
              {areaOffline.map((a) => (
                <div key={a.id} className="offline-item">
                  <div>
                    <strong>{a.namaArea}</strong>
                    <small>
                      {a.unduhanNyata
                        ? `${a.jumlahTile.toLocaleString("id-ID")} tile • ${a.ukuranMb} MB`
                        : "Catatan saja, tile tidak tersimpan"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={() => {
                      onBukaArea({
                        lat: (a.minLat + a.maxLat) / 2,
                        lng: (a.minLng + a.maxLng) / 2
                      });
                      setBukaModalOffline(false);
                    }}
                  >
                    Buka
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
