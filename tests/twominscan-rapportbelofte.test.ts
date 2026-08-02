import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  TWOMINSCAN_RAPPORT_PAGINAS,
  TWOMINSCAN_RAPPORT_TALEN,
  TWOMINSCAN_PROFIELEN,
  TWOMINSCAN_PAGINATEKST,
} from "../shared/twominscan-rapport";

// ---------------------------------------------------------------------------
// Ronde C, punt 7. De opdracht ging ervan uit dat de belofte van vijftien
// pagina's een getal was dat niemand afdwong. Gemeten blijkt het getal te
// kloppen: alle 120 vooraf ontwikkelde rapporten (24 profielen maal 5 talen)
// tellen exact vijftien pagina's. Er was alleen niets dat het vasthield, en het
// getal stond met de hand op vier plaatsen.
//
// Deze test meet de echte bestanden en houdt de belofte eraan vast. Wie een
// profiel vervangt door een rapport van een andere lengte, krijgt hier een rode
// test in plaats van een belofte die stil onwaar wordt.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");
const rapportenMap = path.join(wortel, "client/public/twominscan-rapporten");

function pdfsVan(taal: string): string[] {
  const map = path.join(rapportenMap, taal.toLowerCase());
  return readdirSync(map)
    .filter((n) => n.endsWith(".pdf"))
    .map((n) => path.join(map, n));
}

async function aantalPaginas(pad: string): Promise<number> {
  // updateMetadata: false houdt het laden zo licht mogelijk; we lezen alleen.
  const doc = await PDFDocument.load(readFileSync(pad), { updateMetadata: false });
  return doc.getPageCount();
}

describe("2MINSCAN: de belofte over het rapport is gemeten en niet beloofd", () => {
  it("elke taal heeft de 24 profielen", () => {
    expect(existsSync(rapportenMap)).toBe(true);
    for (const taal of TWOMINSCAN_RAPPORT_TALEN) {
      expect(pdfsVan(taal), taal).toHaveLength(TWOMINSCAN_PROFIELEN);
    }
  });

  it("alle 120 rapporten tellen exact het beloofde aantal pagina's", async () => {
    const afwijkend: string[] = [];
    for (const taal of TWOMINSCAN_RAPPORT_TALEN) {
      for (const pad of pdfsVan(taal)) {
        const paginas = await aantalPaginas(pad);
        if (paginas !== TWOMINSCAN_RAPPORT_PAGINAS) {
          afwijkend.push(`${path.relative(wortel, pad)}: ${paginas}`);
        }
      }
    }
    expect(
      afwijkend,
      `rapporten met een ander aantal pagina's dan ${TWOMINSCAN_RAPPORT_PAGINAS}:\n${afwijkend.join("\n")}`,
    ).toEqual([]);
  }, 120_000);

  it("de teksten naar de gebruiker halen het getal uit de gedeelde bron", async () => {
    const { getDescriptor } = await import("../server/registry");
    const { INSTRUMENTENGIDS } = await import("../client/src/data/instrumentengids");

    expect(getDescriptor("twominscan")!.description).toContain(TWOMINSCAN_PAGINATEKST);

    const gids = INSTRUMENTENGIDS.find((i: { id: string }) => i.id === "twominscan")!;
    expect(gids.rapportTeaser).toContain(TWOMINSCAN_PAGINATEKST);
  });

  it("geen enkel bronbestand schrijft het getal nog met de hand", () => {
    // Vier plaatsen deden dat: het register, twee keer de catalogus en de
    // instrumentengids in de client. De bron zelf mag het getal noemen, want
    // daar staat het.
    const metDeHand = /15[- ]?pagina|15 pages|\b15 pagina's/i;
    const bestanden = [
      "server/registry.ts",
      "server/routes/instrumenten-catalogus.ts",
      "client/src/data/instrumentengids.ts",
    ];
    for (const pad of bestanden) {
      const inhoud = readFileSync(path.join(wortel, pad), "utf-8");
      expect(inhoud, pad).not.toMatch(metDeHand);
    }
  });
});
