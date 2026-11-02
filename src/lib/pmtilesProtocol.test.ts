import { describe, expect, it } from "vitest";
import {
  registrasiProtokolPmtiles,
  daftarkanSumberPmtiles,
  ambilSumberPmtiles,
  hapusSumberPmtiles,
  BlobPMTilesSource
} from "./pmtilesProtocol";

describe("pmtilesProtocol", () => {
  it("mendaftarkan dan mengelola BlobPMTilesSource dengan benar", () => {
    const dummyBlob = new Blob(["PMTiles dummy content"], { type: "application/octet-stream" });
    const source = new BlobPMTilesSource(dummyBlob, "peta-test-1");

    expect(source.getKey()).toBe("peta-test-1");

    daftarkanSumberPmtiles("area-pmtiles-1", dummyBlob);
    const diambil = ambilSumberPmtiles("area-pmtiles-1");
    expect(diambil).toBeDefined();

    hapusSumberPmtiles("area-pmtiles-1");
    expect(ambilSumberPmtiles("area-pmtiles-1")).toBeUndefined();
  });

  it("dapat memanggil registrasiProtokolPmtiles pada instance maplibregl mock", () => {
    let namaProtokol = "";
    let handlerDidaftarkan: unknown = null;

    const mockMapLibre = {
      addProtocol: (protocol: string, handler: Parameters<typeof import("maplibre-gl").addProtocol>[1]) => {
        namaProtokol = protocol;
        handlerDidaftarkan = handler;
      }
    } satisfies Pick<typeof import("maplibre-gl"), "addProtocol">;

    registrasiProtokolPmtiles(mockMapLibre);
    expect(namaProtokol).toBe("pmtiles");
    expect(typeof handlerDidaftarkan).toBe("function");
  });
});
