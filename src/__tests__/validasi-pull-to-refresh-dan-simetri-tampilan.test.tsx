// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { AkunAdminPanel } from "../components/AkunAdminPanel";
import { DatabaseSyncView } from "../components/DatabaseSyncView";

describe("Validasi Fitur Pull to Refresh dan Simetri Tampilan", () => {
  it("merender PullToRefresh dengan konten anak dan elemen indikator dengan benar", () => {
    const handleRefresh = vi.fn();
    const html = renderToString(
      <PullToRefresh onRefresh={handleRefresh}>
        <div id="konten-uji">Konten Layar Uji</div>
      </PullToRefresh>
    );

    expect(html).toContain("ptr-wrapper");
    expect(html).toContain("ptr-content");
    expect(html).toContain("Konten Layar Uji");
  });

  it("memastikan tombol manual Segarkan di AkunAdminPanel telah dihapus dan filter pills simetris", () => {
    const html = renderToString(
      <AkunAdminPanel
        sesiAdmin={{
          email: "admin@contoh.id",
          peran: "admin",
          nama: "Admin Uji",
          idKader: "ADMIN-1",
          createdAt: new Date().toISOString(),
          desaWilayah: "Desa Rimba",
          noHp: "08123456789",
          kelompokMasyarakat: "Pemetaan Partisipatif",
          namaOrganisasi: "Komunitas Adat"
        }}
        dataSpasial={[]}
        sertifikatList={[]}
      />
    );

    // Tombol manual 'Segarkan' harus sudah tidak ada
    expect(html).not.toContain("Memuat…");
    expect(html).not.toMatch(/<button[^>]*>Segarkan<\/button>/);

    // Filter pills simetris
    expect(html).toContain("akun-filter-pills");
    expect(html).toContain("akun-admin-title-row");
    expect(html).toContain("Reset Akun");
    expect(html).toContain("Semua (");
    expect(html).toContain("Menunggu (");
    expect(html).toContain("Aktif");
    expect(html).toContain("Ditolak");
  });

  it("memastikan tombol manual Sinkronkan Sekarang di DatabaseSyncView telah digantikan oleh petunjuk tarik layar", () => {
    const html = renderToString(
      <DatabaseSyncView
        dataSpasial={[]}
        areaOffline={[]}
        onResolusiKonflik={vi.fn()}
        terakhirSinkron="18/11/2026, 20.00"
        sedangSinkron={false}
        pesanSinkron={null}
        pesanSinkronGagal={false}
        sedangOnline={true}
        onSinkronkanSekarang={vi.fn()}
        onFokusKePeta={vi.fn()}
      />
    );

    // Tombol lama 'Sinkronkan Sekarang' tidak boleh ada
    expect(html).not.toContain("Sinkronkan Sekarang");

    // Badge petunjuk tarik layar harus ada
    expect(html).toContain("pull-sync-hint-badge");
    expect(html).toContain("Semua data tersinkron");
  });

  it("memastikan CSS app.css mendefinisikan aturan simetri tampilan dan pull to refresh", () => {
    const cssApp = readFileSync(resolve(__dirname, "../styles/app.css"), "utf8");

    // 1. Pull to refresh
    expect(cssApp).toContain(".ptr-indicator");
    expect(cssApp).toContain(".ptr-wrapper");

    // 2. Akun filter pills 4 kolom simetris
    expect(cssApp).toContain(".akun-filter-pills");
    expect(cssApp).toContain("grid-template-columns: repeat(4, 1fr)");

    // 3. Database subtabs 2 kolom 50%/50% simetris
    expect(cssApp).toContain(".admin-data-subtabs");
    expect(cssApp).toContain("grid-template-columns: repeat(2, 1fr)");

    // 4. Admin tugas actions simetris
    expect(cssApp).toContain(".admin-tugas-actions");
    expect(cssApp).toContain(".admin-tugas-actions > .btn-danger-sm");
  });
});
