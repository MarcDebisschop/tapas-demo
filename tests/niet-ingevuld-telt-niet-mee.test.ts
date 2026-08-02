// ---------------------------------------------------------------------------
// Een vraag die niet beantwoord is, mag nergens als getal in de berekening
// terechtkomen: niet als nul, niet als laagste waarde, niet als middenwaarde.
// En een construct waarvoor niet alle antwoorden er zijn, krijgt geen score en
// geen label maar de melding dat er te weinig antwoorden zijn.
//
// Wat de deelnemer hiervan merkt staat per test in de omschrijving.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { buildT4TeensContract } from "../server/t4teens/scoring";
import { bouwT4TeensRapport } from "../server/t4teens/rapport";
import { buildT4KidsContract } from "../server/t4kids/scoring";
import { laadInstrumentItems } from "../server/question-manager";
import { T4KIDS_STELLINGEN } from "../server/t4kids/itembank";

const deelnemer = { respondentCode: "TEST-001", name: "Test Persoon" };

function teensAntwoorden(waarde: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of laadInstrumentItems("tapas-t4teens")) out[item.itemId] = waarde;
  return out;
}

function teensRapport(responses: Record<string, unknown>) {
  const inhoud = bouwT4TeensRapport(buildT4TeensContract({ ...deelnemer, responses }));
  // De opwektijd verschilt per aanroep en zegt niets over de inhoud.
  return JSON.stringify({ ...inhoud, gegenereerdOp: "" });
}

function alleTekst(responses: Record<string, unknown>): string {
  const inhoud = bouwT4TeensRapport(buildT4TeensContract({ ...deelnemer, responses }));
  return JSON.stringify(inhoud.secties);
}

const VANGNETZINNEN = [
  "Er zijn nog te weinig antwoorden om je talent-versnellers te duiden.",
  "Er zijn nog te weinig antwoorden om je talent-foci te duiden.",
  "Er zijn nog te weinig antwoorden om je interesses te duiden.",
  "Er zijn nog te weinig antwoorden om je gevoel voor betekenis te duiden.",
];

const HERKENBAARHEIDSLABELS = [
  "heel herkenbaar",
  "niet echt herkenbaar",
  "soms wel, soms niet",
];

describe("T4Teens - een jongere die niets invult, krijgt geen volledig rapport", () => {
  it("het rapport van een lege invulling verschilt van dat van een volledig neutrale invulling", () => {
    // Wat de jongere merkt: wie de vragenlijst opent en meteen afsluit, kreeg
    // tot nu toe letterlijk hetzelfde rapport als wie alle 25 vragen op
    // "Neutraal" zette. Niets in dat rapport verried dat er niets was ingevuld.
    expect(teensRapport({})).not.toBe(teensRapport(teensAntwoorden(0)));
  });

  it("bij een lege invulling staat nergens een herkenbaarheidslabel", () => {
    // Wat de jongere merkt: overal stond "soms wel, soms niet", alsof zij of
    // hij bij elk onderwerp iets had aangegeven.
    const tekst = alleTekst({});
    for (const label of HERKENBAARHEIDSLABELS) {
      expect(tekst).not.toContain(label);
    }
  });

  it("bij een lege invulling melden alle vier de vangnetzinnen dat er te weinig antwoorden zijn", () => {
    const tekst = alleTekst({});
    for (const zin of VANGNETZINNEN) {
      expect(tekst).toContain(zin);
    }
  });

  it("een construct zonder enkel antwoord krijgt geen gemiddelde, ook geen nul", () => {
    const contract = buildT4TeensContract({ ...deelnemer, responses: {} });
    for (const rij of contract.sections.main.constructRows) {
      expect(rij.avgEnergy).toBeNull();
      expect(rij.beantwoord).toBe(0);
    }
    expect(contract.sections.main.meta.averageScore).toBeNull();
  });

  it("een construct met twee vragen waarvan er een is overgeslagen, krijgt geen oordeel", () => {
    // Wat de jongere merkt: Facilitatie steunt op twee vragen. Wie er een van
    // beide beantwoordde, kreeg exact hetzelfde oordeel als wie beide
    // beantwoordde. Het rapport zei niet dat het op de helft berustte.
    const beide = buildT4TeensContract({
      ...deelnemer,
      responses: { "T4T-V3-1": 2, "T4T-V4-1": 2 },
    });
    const een = buildT4TeensContract({ ...deelnemer, responses: { "T4T-V3-1": 2 } });

    const rijVan = (c: typeof beide) =>
      c.sections.main.constructRows.find((r) => r.construct === "Facilitatie")!;

    expect(rijVan(beide).avgEnergy).toBe(2);
    expect(rijVan(beide).beantwoord).toBe(2);
    expect(rijVan(een).beantwoord).toBe(1);
    expect(rijVan(een).shown).toBe(2);

    const tekstEen = alleTekst({ "T4T-V3-1": 2 });
    expect(tekstEen).not.toContain("heel herkenbaar");
  });

  it("de drivertabel spreekt de tekst op dezelfde pagina niet tegen", () => {
    // Wat de jongere merkt: bij een driver met gemiddelde precies 0 zei de
    // tabel "eerder gaspedaal", terwijl de alinea erboven zei dat geen enkele
    // driver eruit sprong.
    const inhoud = bouwT4TeensRapport(
      buildT4TeensContract({ ...deelnemer, responses: teensAntwoorden(0) }),
    );
    const sectie = inhoud.secties.find((s) => s.kop.startsWith("Drivers"))!;
    const zegtGeenEnkele = sectie.paragrafen.some((p) =>
      p.includes("Er sprong geen enkele driver er duidelijk uit"),
    );
    const tabelZegtGaspedaal = (sectie.tabel?.rijen ?? []).some((r) =>
      String(r[2]).includes("gaspedaal"),
    );
    expect(zegtGeenEnkele && tabelZegtGaspedaal).toBe(false);
  });
});

describe("T4Kids - een overgeslagen stelling telt niet als de laagste waarde", () => {
  const kidsBasis = { ...deelnemer, keuzes: null };

  it("wie alleen de twee extrinsieke stellingen beantwoordt, krijgt niet het label 'eerder extern'", () => {
    // Wat het kind merkt: het las vetgedrukt dat het "eerder extern" is,
    // terwijl dat label volledig voortkwam uit de drie stellingen die het
    // had overgeslagen.
    const contract = buildT4KidsContract({
      ...kidsBasis,
      responses: { "T4K-Z-10": 3, "T4K-Z-12": 3 },
    });
    expect(contract.sections.main.meta.autonomie.balansLabel).not.toBe("eerder extern");
    expect(contract.sections.main.meta.autonomie.intrinsiek).toBeNull();
  });

  it("wie niets beantwoordt, krijgt niet het label 'in evenwicht'", () => {
    const contract = buildT4KidsContract({ ...kidsBasis, responses: {} });
    expect(contract.sections.main.meta.autonomie.balansLabel).not.toBe("in evenwicht");
    expect(contract.sections.main.meta.autonomie.intrinsiek).toBeNull();
    expect(contract.sections.main.meta.autonomie.extrinsiek).toBeNull();
  });

  it("wie alle vijf de driverstellingen beantwoordt, krijgt wel een echt label", () => {
    const responses: Record<string, number> = {};
    for (const s of T4KIDS_STELLINGEN) if (s.soort === "Driver") responses[s.id] = 3;
    const contract = buildT4KidsContract({ ...kidsBasis, responses });
    expect(contract.sections.main.meta.autonomie.balansLabel).toBe("in evenwicht");
  });

  it("een sterkte met twee stellingen waarvan er een is overgeslagen, krijgt geen gemiddelde", () => {
    // Resultaatgericht steunt op T4K-Z-01 en T4K-Z-08.
    const contract = buildT4KidsContract({ ...kidsBasis, responses: { "T4K-Z-01": 3 } });
    const rij = contract.sections.main.constructRows.find(
      (r) => r.construct === "Resultaatgericht",
    )!;
    expect(rij.shown).toBe(2);
    expect(rij.beantwoord).toBe(1);
    expect(rij.avgEnergy).toBeNull();
  });

  it("een kind dat niets koos, telt als nul keuzes en niet als een", () => {
    const contract = buildT4KidsContract({ ...kidsBasis, responses: {} });
    const interesse = contract.sections.main.familyRows.find((f) => f.family === "Interesse")!;
    expect(interesse.avgEnergy).toBe(0);
  });
});
