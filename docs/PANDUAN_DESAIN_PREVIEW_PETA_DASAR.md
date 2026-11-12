# Panduan Desain & Konfigurasi Preview Peta Dasar (Basemap Thumbnails)

Dokumen ini merupakan pedoman baku untuk mempertahankan tampilan pratinjau (preview thumbnails) pada menu pemilihan peta dasar (*Lapisan Peta -> Peta Dasar*) di aplikasi Titik Tapak (Kader Pemetaan Partisipatif).

---

## 1. Latar Belakang & Aturan Permanen

Pada iterasi antarmuka sebelumnya, beberapa mockup atau tampilan memperlihatkan ikon kotak hijau sederhana dengan garis diagonal atau pola abstrak untuk mewakili pilihan peta dasar. Pengguna telah menginstruksikan secara tegas:

> **"Perbaiki gambar label pilih peta ini, buat gambarnya preview dari peta yang mau dipilih jangan seperti ini, perbaiki dan catat di repo agar kalau ada redesign tetap dipertahankan pengaturan gambar label pilih peta ini."**

### Prinsip Utama (Non-Negotiable)
1. **Pratinjau Nyata (Authentic Map Previews)**:
   Setiap pilihan peta dasar **WAJIB** menampilkan potongan citra atau peta nyata yang representatif dari jenis peta tersebut, bukan gambar kartun, bentuk geometris polos, atau emoji.
2. **Kemandirian Offline (Zero Latency / Offline-Ready)**:
   Semua aset thumbnail disimpan secara lokal di direktori `public/assets/basemaps/`. Aplikasi tidak boleh meminta tile jaringan eksternal hanya untuk sekadar menampilkan ikon di menu popover, sehingga menu lapisan peta dapat dibuka seketika dalam kondisi luar jaringan (offline di lapangan).
3. **Preservasi Redesign**:
   Setiap kali ada perombakan UI/UX (redesign tampilan, tema gelap/terang, perubahan layout), struktur visual thumbnail preview peta nyata ini **harus tetap dipertahankan**.

---

## 2. Daftar Aset Preview & Karakteristik Visual

Semua aset disimpan di dalam folder `public/assets/basemaps/`:

| ID Basemap | Label Tampilan | Subtitle | File Aset | Deskripsi Karakteristik Visual |
| :--- | :--- | :--- | :--- | :--- |
| `esri` | **Satelit Esri HD** | Citra Maxar resolusi tinggi | `preview-esri.jpg` | Potongan citra satelit resolusi tinggi dari Esri World Imagery (Maxar) yang menampilkan lanskap alam tajam, pepohonan, pesisir, dan bangunan. |
| `google` | **Google Satelit HD** | Satelit Google hybrid + label jalan | `preview-google.jpg` | Citra satelit hybrid Google dengan lapisan garis jalan (kuning/oranye) dan label nama wilayah yang jelas. |
| `satelit` | **Citra Satelit** | Sentinel-2 cloudless, 10 m | `preview-satelit.jpg` | Citra satelit Sentinel-2 cloudless natural color 10 m bebas awan (EOX / Copernicus). |
| `osm` | **Peta Jalan (OSM)** | Peta jalan terbuka global (OpenStreetMap) | `preview-osm.png` | Potongan peta jalan standar OpenStreetMap dengan pola jalan raya, area hijau/taman, dan kawasan terbangun. |
| `topo` | **Topografi** | Kontur elevasi dan medan | `preview-topo.png` | Peta topografi OpenTopoMap dengan hillshading bayangan tebing, garis kontur elevasi, dan elevasi medan pegunungan. |
| `taktis` | **Kontur Taktis** | Gaya kontur offline & taktikal | `preview-taktis.svg` | Tampilan taktis gelap (*dark military / field GIS canvas*) dengan kontur isoline elevasi neon/cyan berjarak rapat dan grid koordinat taktikal. |

---

## 3. Spesifikasi Teknis Komponen

Komponen pengelola terletak di:
- **Komponen React**: `src/components/peta/PanelLapisanPeta.tsx`
- **Gaya CSS**: `src/styles/app.css` (kelas `.map-basemap-item`, `.map-basemap-thumb-wrap`, `.map-basemap-thumb-img`, `.map-basemap-info`, `.map-basemap-radio-active`)

### Struktur HTML / JSX:
```tsx
<button
  type="button"
  className={`map-basemap-Option map-basemap-item ${aktif ? "active" : ""}`}
  onClick={() => onPilihBasemap(id)}
>
  <div className="map-basemap-thumb-wrap">
    <img
      src={getBasemapPreview(id)}
      alt={getBasemapBadge(id)}
      className="map-basemap-thumb-img"
      loading="lazy"
      decoding="async"
    />
  </div>
  <div className="map-basemap-info">
    <div className="map-basemap-title">{getBasemapBadge(id)}</div>
    <small className="map-basemap-sub">{getBasemapSubtitle(id)}</small>
  </div>
  <div className="map-basemap-check-indicator">
    {aktif ? (
      <div className="map-basemap-radio-active" aria-label="Aktif">
        <Check size={13} strokeWidth={3} />
      </div>
    ) : (
      <div className="map-basemap-radio-inactive" />
    )}
  </div>
</button>
```

### Dimensi & Styling:
- **Ukuran Thumbnail**: 46px × 46px dengan `border-radius: 10px` dan `object-fit: cover`.
- **Efek Interaksi**: Pada saat kursor mengarah ke kartu (`:hover`), thumbnail membesar halus (`scale(1.06)`) dan latar belakang kartu sedikit terang.
- **Indikator Aktif**: Kartu yang aktif memiliki garis batas biru (`border: 1.5px solid #3b82f6`), latar belakang biru lembut (`#eff6ff`), dan ikon centang putih di dalam lingkaran biru solid (`#2563eb`). Kartu tidak aktif memiliki lingkaran luar tipis abu-abu bergaya radio button.
