/** Posisi baris WGS84 north-up ketika kanvas memakai Web Mercator. */
export function fraksiBarisGeografis(fraksiMercator: number, minLat: number, maxLat: number): number {
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const atas = merc(maxLat),
    bawah = merc(minLat);
  const lat = (Math.atan(Math.sinh(atas + (bawah - atas) * fraksiMercator)) * 180) / Math.PI;
  return Math.max(0, Math.min(1, (maxLat - lat) / (maxLat - minLat)));
}
