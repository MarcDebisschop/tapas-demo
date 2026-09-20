// ---------------------------------------------------------------------------
// tests/hdd-rapportsluis.test.ts
//
// De regel: wie als lid van een Human Due Diligence-traject invult, mag zijn
// eigen rapport nooit zelf openen of downloaden. Alleen de begeleider haalt de
// rapporten op, en die geeft ze daarna per lid vrij.
//
// Wat deze tests bewijzen:
//   1. De sluis zelf beslist juist: een token van een traject zonder vrijgave is
//      dicht, met vrijgave open, en een token dat niet bij een traject hoort
//      verandert niets (gewone deelnemers buiten een traject blijven bij hun
//      eigen rapport).
//   2. Alle drie de ingangen waar een lid bij een rapport kon komen, vragen de
//      sluis: het deelnemersdashboard, het individuele Teamscan-rapport en de
//      2MINSCAN-PDF.
//   3. Het scherm van de 2MINSCAN toont geen rapport zolang de sluis dicht is.
//      Dat is nodig omdat dat rapport in de browser gerekend wordt.
//   4. De begeleider heeft een route om vrij te geven, en die staat achter de
//      beheerderspoort. De publieke sluiscontrole staat er bewust buiten, maar
//      verklapt geen traject- of lidgegevens.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bouwSluisIndex,
  beoordeelToken,
  rapportGesloten,
  geslotenTokens,
  CODE_RAPPORT_NIET_VRIJGEGEVEN,
  MELDING_RAPPORT_NIET_VRIJGEGEVEN,
} from "../server/hdd/rapportsluis";

function lid(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    trajectId: 7,
    naam: "Herman Van Esbroeck",
    email: "herman@example.be",
    instrumentTokens: JSON.stringify({
      "tapas-teamscan": "tok-teamscan",
      twominscan: "tok-2min",
      "t4p-business-kompas": "tok-kompas",
    }),
    rapportVrijgaveOp: null,
    rapportVrijgaveDoor: null,
    createdAt: 1,
    ...over,
  } as any;
}

describe("de rapportsluis beslist per token", () => {
  it("houdt elk token van een lid zonder vrijgave tegen", () => {
    const index = bouwSluisIndex([lid()]);
    expect(rapportGesloten("tok-teamscan", index)).toBe(true);
    expect(rapportGesloten("tok-2min", index)).toBe(true);
    expect(rapportGesloten("tok-kompas", index)).toBe(true);
  });

  it("laat alles door zodra de begeleider vrijgaf", () => {
    const index = bouwSluisIndex([lid({ rapportVrijgaveOp: 1700000000000 })]);
    expect(rapportGesloten("tok-teamscan", index)).toBe(false);
    expect(rapportGesloten("tok-2min", index)).toBe(false);
    expect(rapportGesloten("tok-kompas", index)).toBe(false);
  });

  it("raakt een token buiten een traject niet aan", () => {
    const index = bouwSluisIndex([lid()]);
    expect(rapportGesloten("een-los-token", index)).toBe(false);
    expect(rapportGesloten("", index)).toBe(false);
    expect(rapportGesloten(undefined, index)).toBe(false);
    expect(beoordeelToken("een-los-token", index).vanTraject).toBe(false);
  });

  it("noemt bij een tokenkennis het traject en het lid, zodat de begeleiderskant kan tonen wat er dicht staat", () => {
    const index = bouwSluisIndex([lid({ id: 42, trajectId: 9 })]);
    const uitspraak = beoordeelToken("tok-2min", index);
    expect(uitspraak.vanTraject).toBe(true);
    expect(uitspraak.vrijgegeven).toBe(false);
    expect(uitspraak.trajectId).toBe(9);
    expect(uitspraak.lidId).toBe(42);
    expect(uitspraak.instrumentId).toBe("twominscan");
  });

  it("overleeft een leeg of stuk tokenveld zonder te breken", () => {
    const index = bouwSluisIndex([
      lid({ id: 2, instrumentTokens: "{}" }),
      lid({ id: 3, instrumentTokens: "dit is geen json" }),
      lid({ id: 4, instrumentTokens: JSON.stringify({ twominscan: "" }) }),
    ]);
    expect(index.size).toBe(0);
  });

  it("zeeft een reeks tokens in één keer", () => {
    const index = bouwSluisIndex([
      lid(),
      lid({ id: 5, instrumentTokens: JSON.stringify({ twominscan: "tok-vrij" }), rapportVrijgaveOp: 1 }),
    ]);
    const dicht = geslotenTokens(["tok-2min", "tok-vrij", "los", null], index);
    expect([...dicht]).toEqual(["tok-2min"]);
  });
});

describe("de drie ingangen naar een rapport vragen de sluis", () => {
  const bron = (pad: string) => readFileSync(resolve(__dirname, "..", pad), "utf8");

  it("het deelnemersdashboard geeft geen rapport-ids en geen bestand", () => {
    const routes = bron("server/routes-deelnemer.ts");
    expect(routes).toMatch(/from "\.\/hdd\/rapportsluis"/);
    // De lijst: geen ids wanneer de sluis dicht staat, wel een reden.
    expect(routes).toMatch(/rapporten: gesloten\s*\n?\s*\? \[\]/);
    expect(routes).toMatch(/wachtOpVrijgave: gesloten/);
    // Bekijken en downloaden: allebei geweigerd.
    const html = routes.indexOf('"/api/dashboard/:token/rapport/:rapportId/html"');
    const pdf = routes.indexOf('"/api/dashboard/:token/rapport/:rapportId/pdf"');
    expect(html).toBeGreaterThan(-1);
    expect(pdf).toBeGreaterThan(-1);
    expect(routes.slice(html, html + 1800)).toMatch(/rapportGesloten\(eigen\?\.inviteToken\)\) return sluisWeigering\(res\)/);
    expect(routes.slice(pdf, pdf + 1800)).toMatch(/rapportGesloten\(eigen\?\.inviteToken\)\) return sluisWeigering\(res\)/);
  });

  it("het individuele Teamscan-rapport staat open op het token en wordt daarom hier gekeurd", () => {
    const routes = bron("server/teamscan/routes.ts");
    const start = routes.indexOf('"/api/teamscan/deelnemer/:token/rapport"');
    expect(start).toBeGreaterThan(-1);
    expect(routes.slice(start, start + 1200)).toMatch(
      /rapportGesloten\(req\.params\.token\)\) return sluisWeigering\(res\)/,
    );
  });

  it("de 2MINSCAN-PDF neemt het uitnodigingstoken aan en weigert voor het renderen", () => {
    const routes = bron("server/twominscan/routes.ts");
    expect(routes).toMatch(/uitnodiging: z\.string\(\)/);
    expect(routes).toMatch(
      /rapportGesloten\(parsed\.data\.uitnodiging\)\) return sluisWeigering\(res\)/,
    );
  });

  it("het 2MINSCAN-scherm toont geen inhoud zolang de sluis dicht is", () => {
    const pagina = bron("client/src/pages/twominscan-rapport.tsx");
    expect(pagina).toMatch(/\/api\/rapportsluis\//);
    expect(pagina).toMatch(/sluis\.stand === "navragen" \|\| sluis\.stand === "dicht"/);
    expect(pagina).toMatch(/<Wachtscherm/);
    // En het token reist mee naar de server bij het downloaden.
    expect(pagina).toMatch(/uitnodiging: uitnodiging \|\| undefined/);
  });
});

describe("de begeleiderskant", () => {
  const routes = readFileSync(resolve(__dirname, "../server/hdd/routes.ts"), "utf8");
  const scherm = readFileSync(
    resolve(__dirname, "../client/src/pages/hdd-traject.tsx"),
    "utf8",
  );

  it("heeft een vrijgaveroute achter de beheerderspoort", () => {
    const poort = routes.indexOf('app.use("/api/hdd", vereisScope)');
    const route = routes.indexOf('"/api/hdd/trajecten/:id/vrijgave"');
    expect(poort).toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(poort);
    expect(routes).toMatch(/zetRapportVrijgave\(lid\.id, parsed\.data\.vrij, door\)/);
  });

  it("de publieke sluiscontrole staat buiten /api/hdd en verklapt geen lid", () => {
    const start = routes.indexOf('"/api/rapportsluis/:token"');
    expect(start).toBeGreaterThan(-1);
    const route = routes.slice(start, start + 700);
    expect(route).toMatch(/gesloten/);
    expect(route).not.toMatch(/lidId/);
    expect(route).not.toMatch(/trajectId/);
  });

  it("het trajectscherm heeft een knop per lid en een knop voor alle leden", () => {
    expect(scherm).toMatch(/button-vrijgave-allen/);
    expect(scherm).toMatch(/data-testid=\{`button-vrijgave-\$\{lid\.id\}`\}/);
    expect(scherm).toMatch(/Nog niet vrijgegeven/);
  });
});

describe("de meldingen", () => {
  it("dragen een eigen code en noemen de begeleider", () => {
    expect(CODE_RAPPORT_NIET_VRIJGEGEVEN).toBe("RAPPORT_NIET_VRIJGEGEVEN");
    expect(MELDING_RAPPORT_NIET_VRIJGEGEVEN).toMatch(/begeleider/);
  });

  it("bevatten geen lange streepjes", () => {
    const bestanden = [
      "server/hdd/rapportsluis.ts",
      "server/hdd/routes.ts",
      "client/src/pages/hdd-traject.tsx",
    ];
    for (const pad of bestanden) {
      const tekst = readFileSync(resolve(__dirname, "..", pad), "utf8");
      expect(tekst.includes("\u2014"), `em-dash in ${pad}`).toBe(false);
      expect(tekst.includes("\u2013"), `en-dash in ${pad}`).toBe(false);
    }
  });
});
