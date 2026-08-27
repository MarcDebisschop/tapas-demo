// ---------------------------------------------------------------------------
// tests/hdd-gate-richting.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. Het beslismoment tussen fase één en fase twee kijkt in de juiste
//      richting: dysfunctionele signalen laten het traject stoppen, en de
//      afwezigheid van die signalen opent de diepteanalyse.
//   B. De drempel blijft één signaal van hoge ernst, of twee van gemiddelde
//      ernst.
//   C. Het platform adviseert en de consultant beslist: het consultantbesluit
//      blijft naast het advies bestaan.
//   D. De publieke trajectteksten zeggen exact hetzelfde als de module, en
//      dragen nergens nog de omgekeerde belofte.
//   E. In de teksten van dit traject staat geen em-dash.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { evalueerGate, verzamelRodeVlaggen, type Fase1Aggregaat } from "../server/hdd/gate";
import { HDD_STAPPEN, HDD_OUTPUTS, HDD_UITKOMST } from "../client/src/data/oplossingen";

// Een verkenning zonder enig risicosignaal.
const GEZOND: Fase1Aggregaat = {
  waardenfitGemiddelde: 4.2,
  vertrouwenOnderDrempel: false,
  vertrouwensGaps: [0.4, 0.6, 0.3],
  conflictZwak: false,
  energieBalans: 1.4,
  spreiding: 0.7,
};

describe("HDD: de richting van het beslismoment", () => {
  it("geen dysfunctionele signalen betekent: fase twee start", () => {
    const gate = evalueerGate(GEZOND);
    expect(verzamelRodeVlaggen(GEZOND)).toHaveLength(0);
    expect(gate.advies).toBe("go");
    expect(gate.samenvatting.toLowerCase()).toContain("start fase 2");
    // De centrale vraag van de diepteanalyse staat erbij.
    expect(gate.samenvatting.toLowerCase()).toContain("ambitie");
  });

  it("één signaal van hoge ernst laat het traject stoppen", () => {
    const gate = evalueerGate({ ...GEZOND, waardenfitGemiddelde: 2.4 });
    expect(gate.signalen.filter((s) => s.ernst === "hoog")).toHaveLength(1);
    expect(gate.advies).toBe("no-go");
    expect(gate.samenvatting.toLowerCase()).toContain("stopt hier");
  });

  it("twee signalen van gemiddelde ernst laten het traject stoppen", () => {
    const gate = evalueerGate({ ...GEZOND, conflictZwak: true, energieBalans: -0.8 });
    expect(gate.signalen.filter((s) => s.ernst === "hoog")).toHaveLength(0);
    expect(gate.signalen.filter((s) => s.ernst === "midden")).toHaveLength(2);
    expect(gate.advies).toBe("no-go");
  });

  it("één signaal van gemiddelde ernst blokkeert de diepteanalyse niet", () => {
    const gate = evalueerGate({ ...GEZOND, spreiding: 1.9 });
    expect(gate.signalen).toHaveLength(1);
    expect(gate.signalen[0].ernst).toBe("midden");
    expect(gate.advies).toBe("go");
  });

  it("een leeg aggregaat geeft geen signalen en dus een start van fase twee", () => {
    const gate = evalueerGate({});
    expect(gate.signalen).toHaveLength(0);
    expect(gate.advies).toBe("go");
  });
});

describe("HDD: de publieke teksten volgen de module", () => {
  const beslisstap = HDD_STAPPEN.find((s) => s.naam === "Go of No-Go")!;

  it("de trajectstap beschrijft dezelfde richting als de gate", () => {
    const t = beslisstap.inhoud.toLowerCase();
    expect(t).toContain("dysfunctioneel");
    expect(t).toContain("stopt het traject hier");
    expect(t).toContain("diepteanalyse");
    expect(t).toContain("ambitie");
    // De consultant houdt de eindregie, net als in evalueerGate.
    expect(t).toContain("eindregie");
  });

  it("nergens staat nog de omgekeerde belofte", () => {
    const alles = [
      ...HDD_STAPPEN.map((s) => `${s.naam} ${s.inhoud}`),
      ...HDD_OUTPUTS.map((o) => `${o.naam} ${o.inhoud} ${o.vorm}`),
      ...HDD_UITKOMST,
    ]
      .join(" ")
      .toLowerCase();
    expect(alles).not.toContain("zijn er geen signalen, dan stopt");
    expect(alles).not.toContain("zonder signalen niet verder");
    expect(alles).not.toMatch(/geen signalen[^.]{0,40}stopt/);
  });

  it("de teksten van dit traject dragen geen em-dash", () => {
    const alles = [
      ...HDD_STAPPEN.map((s) => `${s.naam} ${s.inhoud} ${s.duur}`),
      ...HDD_OUTPUTS.map((o) => `${o.naam} ${o.inhoud} ${o.vorm} ${o.lezer}`),
      ...HDD_UITKOMST,
      evalueerGate({}).samenvatting,
      evalueerGate({ waardenfitGemiddelde: 1.5, vertrouwenOnderDrempel: true }).samenvatting,
      ...verzamelRodeVlaggen({
        waardenfitGemiddelde: 1.5,
        vertrouwenOnderDrempel: true,
        vertrouwensGaps: [2.1, 2.2],
        conflictZwak: true,
        energieBalans: -1,
        spreiding: 2,
      }).map((s) => s.toelichting),
    ].join(" ");
    expect(alles).not.toContain("\u2014");
    expect(alles).not.toContain("\u2013");
  });
});
