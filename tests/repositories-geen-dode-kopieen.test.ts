// ---------------------------------------------------------------------------
// tests/repositories-geen-dode-kopieen.test.ts
//
// Auditbevinding A-2 (hoog): in server/repositories/ stonden zes niet-aangesloten
// kopieën van datalaagcode die elders leeft, plus een hulp- en een verzamelmodule
// die alleen die kopieën dienden. Ze zijn verwijderd. Deze test zorgt ervoor dat
// het probleem niet stil terugkeert: elk .ts-bestand in die map moet werkelijk
// door server/storage.ts geïmporteerd worden.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const wortel = resolve(__dirname, "..");
const map = resolve(wortel, "server/repositories");
const storage = readFileSync(resolve(wortel, "server/storage.ts"), "utf8");

describe("server/repositories bevat geen dode kopieën (auditbevinding A-2)", () => {
  const bestanden = readdirSync(map)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => n.replace(/\.ts$/, ""));

  it("bevat minstens de twee aangesloten repositories", () => {
    expect(bestanden).toContain("billers");
    expect(bestanden).toContain("organisaties");
  });

  it("heeft geen enkel bestand dat storage.ts niet importeert", () => {
    const nietAangesloten = bestanden.filter(
      (naam) => !storage.includes(`./repositories/${naam}`),
    );
    expect(
      nietAangesloten,
      `Niet-aangesloten repositories gevonden: ${nietAangesloten.join(", ")}. ` +
        "Sluit ze echt aan op server/storage.ts of verwijder ze; een kopie die " +
        "niemand importeert verouderd stil en is een bron van stille fouten.",
    ).toEqual([]);
  });

  it("bevat de verwijderde kopieën niet opnieuw", () => {
    for (const dood of ["afnames", "credits", "rapporten", "deelnemers", "sessies", "toegang", "db", "index"]) {
      expect(bestanden, `${dood}.ts is opnieuw opgedoken in server/repositories/`).not.toContain(dood);
    }
  });

  it("documenteert de regel in het leesmij-bestand van de map", () => {
    const leesmij = readFileSync(resolve(map, "README.md"), "utf8");
    expect(leesmij).toMatch(/Nooit een repository toevoegen die niemand importeert/);
  });
});
