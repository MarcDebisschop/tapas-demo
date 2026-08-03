import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Herstelronde, punt 6: drie kleine fouten op het blad "Waarom kiezen
// makkelijk of moeilijk kan voelen".
//
// 1. De inleiding zegt "Hierboven en hierna lees je twee dingen". Beide
//    onderdelen staan op bladen die hiervoor komen, niets komt hierna.
// 2. Het opschrift "DRIVERPATROON PLEASE OTHERS/ TRY HARD" heeft een
//    verdwaalde ruimte na de schuine streep en leest moeilijk.
// 3. De waarde bij het driverpatroon toont alleen het interne label
//    ("gaspedaal", "remmend", "neutraal"). Er moet gewone taal bij, zonder
//    het label te vervangen.
// ---------------------------------------------------------------------------

function bouw(antwoorden: Record<string, unknown>) {
  const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
  const rapport = bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: I.version,
  });
  return { resultaat, rapport };
}

function vindBlad(paginas: T4SPagina[]): T4SPagina {
  const blad = paginas.find((p) => /waarom kiezen makkelijk of moeilijk kan voelen/i.test(p.titel));
  expect(blad, "geen blad over kiezen gevonden").toBeDefined();
  return blad!;
}

function alleTeksten(p: T4SPagina): string {
  const stukken: string[] = [p.titel, p.ondertitel];
  for (const b of p.blokken as any[]) {
    if (typeof b.tekst === "string") stukken.push(b.tekst);
    if (Array.isArray(b.punten)) stukken.push(...b.punten);
    if (Array.isArray(b.paren)) for (const par of b.paren) stukken.push(par.label, par.waarde);
  }
  return stukken.join(" \n ");
}

describe("het blad over kiezen: drie kleine fouten hersteld", () => {
  it("de inleiding verwijst niet meer naar 'hierna', want beide onderdelen staan hiervoor", () => {
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const tekst = alleTeksten(vindBlad(rapport.paginas));
    expect(tekst).toContain("Op de bladen hiervoor las je twee dingen");
    expect(tekst).not.toContain("Hierboven en hierna");
  });

  it("het opschrift van het driverpatroon heeft geen verdwaalde ruimte meer na een schuine streep", () => {
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    const parenBlok = (blad.blokken as any[]).find((b) => Array.isArray(b.paren));
    expect(parenBlok, "geen paren-blok gevonden").toBeDefined();
    const label = parenBlok.paren.find((p: { label: string }) => /driverpatroon/i.test(p.label)).label;
    // Het label zelf staat in gewone spelling; de PDF-weergave maakt er
    // hoofdletters van via toUpperCase(). Er mag geen schuine streep meer in
    // staan, want die gaf een verdwaalde ruimte in de opgemaakte tekst.
    expect(label).toBe("Driverpatroon, Please Others en Try Hard");
    expect(label).not.toContain("/");
  });

  it("de waarde bij het driverpatroon toont het bestaande label met gewone taal erbij", () => {
    // Voorbeeldprofiel: Please Others of Try Hard staat op gaspedaal.
    const { rapport } = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    const parenBlok = (blad.blokken as any[]).find((b) => Array.isArray(b.paren));
    const waarde = parenBlok.paren.find((p: { label: string }) => /driverpatroon/i.test(p.label)).waarde;
    expect(waarde).toBe("gaspedaal, sterk aanwezig");
  });

  it("de drie labels krijgen elk hun eigen gewone taal, met het bestaande label als eerste woord", () => {
    const remmend = {
      ...VOORBEELDAFNAME.antwoorden,
      D2: { recognition: 3, energy: -2 },
      D3: { recognition: 2, energy: -2 },
    };
    const { rapport: rRemmend } = bouw(remmend as unknown as Record<string, unknown>);
    const parenRemmend = (vindBlad(rRemmend.paginas).blokken as any[]).find((b) => Array.isArray(b.paren));
    const waardeRemmend = parenRemmend.paren.find((p: { label: string }) => /driverpatroon/i.test(p.label)).waarde;
    expect(waardeRemmend).toBe("remmend, weinig aanwezig");

    const neutraal = {
      ...VOORBEELDAFNAME.antwoorden,
      D2: { recognition: 3, energy: 0 },
      D3: { recognition: 2, energy: 0 },
    };
    const { rapport: rNeutraal } = bouw(neutraal as unknown as Record<string, unknown>);
    const parenNeutraal = (vindBlad(rNeutraal.paginas).blokken as any[]).find((b) => Array.isArray(b.paren));
    const waardeNeutraal = parenNeutraal.paren.find((p: { label: string }) => /driverpatroon/i.test(p.label)).waarde;
    expect(waardeNeutraal).toBe("neutraal, gemiddeld aanwezig");
  });
});
