import { describe, expect, it } from "vitest";
import {
  registrasiProtokolMbtiles,
  daftarkanSumberMbtiles,
  ambilSumberMbtiles,
  hapusSumberMbtiles,
  dapatkanSqlJs
} from "./mbtilesProtocol";

describe("mbtilesProtocol", () => {
  it("dapat memuat SQL.js WebAssembly", async () => {
    const SQL = await dapatkanSqlJs();
    expect(SQL).toBeDefined();
    expect(typeof SQL.Database).toBe("function");

    // Uji instansiasi database in-memory
    const db = new SQL.Database();
    db.run("CREATE TABLE test (id int, nama text);");
    db.run("INSERT INTO test VALUES (1, 'Kader Titik Tapak');");
    const res = db.exec("SELECT nama FROM test WHERE id = 1");
    expect(res[0].values[0][0]).toBe("Kader Titik Tapak");
    db.close();
  });

  it("mendaftarkan dan mengelola database MBTiles", async () => {
    const SQL = await dapatkanSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE metadata (name text, value text);");
    db.run("INSERT INTO metadata VALUES ('name', 'Peta Uji MBTiles');");
    db.run("INSERT INTO metadata VALUES ('format', 'png');");
    db.run("INSERT INTO metadata VALUES ('bounds', '117.1,2.6,117.5,3.0');");
    db.run("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);");

    const binary = db.export();
    const blob = new Blob([binary.buffer as ArrayBuffer], { type: "application/vnd.sqlite3" });

    const meta = await daftarkanSumberMbtiles("peta-mbtiles-test", blob);
    expect(meta.namaArea).toBe("Peta Uji MBTiles");
    expect(meta.format).toBe("png");
    expect(meta.minLng).toBe(117.1);
    expect(meta.minLat).toBe(2.6);

    expect(ambilSumberMbtiles("peta-mbtiles-test")).toBeDefined();

    hapusSumberMbtiles("peta-mbtiles-test");
    expect(ambilSumberMbtiles("peta-mbtiles-test")).toBeUndefined();
  });

  it("dapat mendaftarkan custom protocol mbtiles:// ke MapLibre GL", () => {
    let namaProtokol = "";
    let handlerDidaftarkan: any = null;

    const mockMapLibre = {
      addProtocol: (protocol: string, handler: any) => {
        namaProtokol = protocol;
        handlerDidaftarkan = handler;
      }
    } as any;

    registrasiProtokolMbtiles(mockMapLibre);
    expect(namaProtokol).toBe("mbtiles");
    expect(typeof handlerDidaftarkan).toBe("function");
  });
});
