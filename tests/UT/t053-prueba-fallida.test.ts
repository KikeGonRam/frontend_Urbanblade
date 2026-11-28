import { describe, expect, it } from "vitest";

import { formatShortDate } from "../../app/utils/format";

/*
 * T053 (HT-19): cambio con una prueba FALLIDA A PROPÓSITO para comprobar que el pipeline queda en rojo y no deja
 * integrar el cambio (RNF-19). NO FUSIONAR: esta rama solo existe para la prueba y se borra al terminar.
 */
describe("T053 · prueba fallida a propósito", () => {
  it("espera un formato de fecha que la web no usa", () => {
    // La web muestra «27 nov 2026»; la prueba exige otro formato para fallar.
    expect(formatShortDate("2026-11-27")).toBe("2026/11/27");
  });
});
