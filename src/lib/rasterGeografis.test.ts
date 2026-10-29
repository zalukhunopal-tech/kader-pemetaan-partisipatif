import { it, expect } from "vitest";
import { fraksiBarisGeografis } from "./rasterGeografis";
it("memproyeksikan tepi dan baris tengah Mercator ke lintang raster", () => {
  expect(fraksiBarisGeografis(0, 50, 70)).toBeCloseTo(0, 10);
  expect(fraksiBarisGeografis(1, 50, 70)).toBeCloseTo(1, 10);
  // Mercator midpoint at 61.568294 degrees, not latitude midpoint 60.
  expect(fraksiBarisGeografis(0.5, 50, 70)).toBeCloseTo((70 - 61.5682941794) / 20, 8);
  expect(fraksiBarisGeografis(0.5, -1, 1)).toBeCloseTo(0.5, 10);
});
