// ---------------------------------------------------------------------------
// tests/t4students-bereikbaarheid.test.ts
//
// Of de herstelde weg ook echt aan staat. De vorige storing kwam niet doordat
// een module verkeerd rekende, maar doordat niemand de deelnemer naar de juiste
// module bracht: het invulscherm viel terug op een ander instrument en niets
// hield dat tegen. Deze toets meet daarom de aansluitingen zelf:
//
//   1. server/routes.ts zet de vragenlijstroute van dit instrument aan.
//   2. client/src/App.tsx kent het adres van het invulscherm.
//   3. client/src/pages/deel1.tsx stuurt een T4Students-afname naar dat scherm
//      in plaats van er zelf blokken van een ander instrument te tonen.
//   4. Het invulscherm kan elke itemsoort tonen die in de itembank voorkomt, en
//      vraagt nergens de vragenlijst van een ander instrument op.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { itemsVanInstrument, itemSoort } from "../server/t4students/antwoorden";

function lees(pad: string): string {
  return readFileSync(resolve(process.cwd(), pad), "utf-8");
}

describe("de weg naar het studiekompas staat aan", () => {
  it("de vragenlijstroute van dit instrument wordt geregistreerd in server/routes.ts", () => {
    const bron = lees("server/routes.ts");
    expect(bron).toContain("registerVragenlijstT4StudentsRoutes");
    expect(bron).toContain("./routes/vragenlijst-t4students");
    // Niet alleen ingevoerd, ook aangeroepen.
    expect(bron).toContain("registerVragenlijstT4StudentsRoutes(app)");
  });

  it("het invulscherm heeft een adres in client/src/App.tsx", () => {
    const bron = lees("client/src/App.tsx");
    expect(bron).toContain('import Studiekompas from "@/pages/studiekompas"');
    expect(bron).toContain('path="/afname/:id/studiekompas" component={Studiekompas}');
  });

  it("deel 1 van het T4P Business Kompas stuurt een T4Students-afname door", () => {
    const bron = lees("client/src/pages/deel1.tsx");
    expect(bron).toContain('afname?.instrumentId === "t4students"');
    expect(bron).toContain("navigate(`/afname/${id}/studiekompas`");
  });

  it("het invulscherm kent elke itemsoort van de itembank", () => {
    const bron = lees("client/src/pages/studiekompas.tsx");
    const soorten = new Set<string>();
    for (const item of itemsVanInstrument(T4STUDENTS_INSTRUMENT)) {
      if (item.variants) {
        for (const variant of Object.values(item.variants)) {
          if (variant.itemType) soorten.add(variant.itemType);
        }
        continue;
      }
      const soort = itemSoort(item);
      if (soort) soorten.add(soort);
    }
    expect(soorten.size).toBeGreaterThan(5);
    for (const soort of soorten) {
      expect(bron, `het scherm behandelt de itemsoort ${soort} niet`).toContain(`"${soort}"`);
    }
  });

  it("het invulscherm haalt geen vragenlijst van een ander instrument op", () => {
    const bron = lees("client/src/pages/studiekompas.tsx");
    expect(bron).toContain("/api/vragenlijst/tapas-t4students");
    expect(bron).not.toContain("/api/instrument");
    expect(bron).not.toContain("tapas-t4teens");
    expect(bron).not.toContain("tapas-t4kids");
  });
});
