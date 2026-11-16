import React from "react";
import { catatBugOtomatis, eksporInventarisBugMarkdown } from "../lib/inventarisBug";

interface StateBoundary {
  gagal: boolean;
  pesan: string;
}

export class PenangkapErrorBoundary extends React.Component<{ children: React.ReactNode }, StateBoundary> {
  state: StateBoundary = { gagal: false, pesan: "" };

  static getDerivedStateFromError(error: Error): StateBoundary {
    return { gagal: true, pesan: error?.message || "Kesalahan antarmuka" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    catatBugOtomatis({
      judul: error?.message || "Kesalahan render React",
      deskripsi: `${error?.name || "Error"}: ${error?.message || "Komponen gagal dimuat"}`,
      lokasi: "Render Antarmuka",
      tumpukan: info.componentStack || error?.stack
    });
  }

  render() {
    if (!this.state.gagal) return this.props.children;
    return (
      <div className="bantuan-fallback-layar" role="alert">
        <div className="bantuan-fallback-kartu">
          <h2>Terjadi Kendala Aplikasi</h2>
          <p>
            Masalah ini sudah otomatis dicatat ke inventaris bug agar bisa segera diperbaiki di sesi berikutnya.
          </p>
          <p className="bantuan-fallback-galat">{this.state.pesan}</p>
          <div className="bantuan-fallback-aksi">
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => {
                this.setState({ gagal: false, pesan: "" });
              }}
            >
              Coba Lagi
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(eksporInventarisBugMarkdown());
              }}
            >
              Salin Log Bug
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                window.location.reload();
              }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
