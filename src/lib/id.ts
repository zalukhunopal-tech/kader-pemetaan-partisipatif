/**
 * Pembuat ID unik: awalan + 12 karakter heksadesimal acak (48 bit).
 * Memakai crypto.randomUUID() bila ada. crypto.getRandomValues menjadi cadangan karena
 * randomUUID hanya tersedia di konteks aman, sedangkan dev server sering dibuka lewat
 * HTTP di jaringan lokal.
 */
export function buatId(awalan: string): string {
  const c: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  let hex: string;
  if (c && typeof c.randomUUID === "function") {
    // 12 karakter pertama UUID v4 seluruhnya acak (nibble versi ada di posisi ke-13)
    hex = c.randomUUID().replace(/-/g, "").slice(0, 12);
  } else if (c && typeof c.getRandomValues === "function") {
    hex = Array.from(c.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    hex = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
  return `${awalan}-${hex}`;
}

/**
 * Memperbaiki daftar lama yang memuat ID kembar (akibat ID berbasis 4-5 digit waktu).
 * Entri pertama mempertahankan ID-nya; entri kembar berikutnya mendapat ID baru dengan
 * awalan yang sama, sehingga verifikasi, hapus, dan pembaruan berdasarkan ID tidak
 * mengenai beberapa objek sekaligus. Daftar yang sudah unik dikembalikan apa adanya.
 */
export function unikkanId<T extends { id: string }>(daftar: T[]): T[] {
  const dipakai = new Set<string>();
  let berubah = false;
  const hasil = daftar.map((item) => {
    if (!dipakai.has(item.id)) {
      dipakai.add(item.id);
      return item;
    }
    const awalan = item.id.replace(/-[^-]*$/, "") || "ID";
    let baru = buatId(awalan);
    while (dipakai.has(baru)) baru = buatId(awalan);
    dipakai.add(baru);
    berubah = true;
    return { ...item, id: baru };
  });
  return berubah ? hasil : daftar;
}
