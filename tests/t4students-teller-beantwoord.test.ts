import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 8 uit fase 1: de teller van beantwoorde items.
//
// WAT FASE 1 VERMOEDDE, EN WAT DE METING ERVAN MAAKTE
// In fase 1 viel op dat de energie-ankers de teller niet ophogen, en het
// vermoeden was dat de teller daardoor te laag uitkomt. Nagemeten klopt dat
// vermoeden niet. Negentien items dragen een energie-anker, en alle negentien worden
// al geteld via hun eigen herkenningsantwoord. Bij een volledig ingevulde
// vragenlijst staat de teller op 34 van 34: precies goed. Zou de motor de
// ankers apart meetellen, dan kwam er 53 van 34 uit, en dat is dubbeltellen.
//
// WAT ER WEL MIS WAS
// Een item met een energie-anker heeft twee schuiven: een voor "kenmerkt dit
// mij" en een voor "geeft dit mij energie". Wie alleen de energieschuif
// beweegt en de herkenning openlaat, heeft wel degelijk iets beantwoord, maar
// werd als onbeantwoord geteld. In drie van de zeventien patronen gebeurt dat:
// de deelnemer raakte vijftien items aan, de teller zei veertien.
//
// WAT EEN DEELNEMER DAARVAN MERKTE
// Rechtstreeks niets: geen enkel scherm en geen enkele tekst leest deze teller
// vandaag. Of een rapport voorlopig heet, hangt af van een andere telling
// (totaalSignaal tegen voorlopigDrempel). Maar de teller staat wel in de
// uitvoer als verantwoording van hoeveel er is ingevuld, en dan hoort hij te
// kloppen voor er iets op gebouwd wordt.
//
// De blauwdruk zegt nergens dat alleen herkenningsvragen tellen. Ze noemt deze
// teller helemaal niet; de enige telling die ze noemt is totaalsignaal tegen
// voorlopigDrempel, en die blijft ongemoeid.
// ---------------------------------------------------------------------------

/** Hoeveel items de deelnemer werkelijk heeft aangeraakt. */
function aangeraakt(antwoorden: Record<string, any>): number {
  return Object.values(antwoorden).filter(
    (a: any) =>
      a != null &&
      (a.recognition != null ||
        a.energy != null ||
        a.interest != null ||
        a.choice != null ||
        a.value != null),
  ).length;
}

describe("punt 8: de teller telt wat een deelnemer werkelijk beantwoordde", () => {
  it("wie alleen de energieschuif beweegt, heeft een item beantwoord", () => {
    // V3 vraagt twee dingen: kenmerkt dit mij, en geeft het mij energie. Deze
    // deelnemer beantwoordde de tweede vraag. Dat is een antwoord.
    const r = scoreStudiekompas(I, { V3: { energy: 2 } }, null, "nl");
    expect(
      r.betrouwbaarheid.beantwoord,
      "de energieschuif van V3 is bewogen, dus er is een item beantwoord",
    ).toBe(1);
  });

  it("een item wordt niet dubbel geteld als beide schuiven bewogen zijn", () => {
    // Dezelfde deelnemer beantwoordt nu beide vragen van hetzelfde item. Dat
    // blijft een item.
    const r = scoreStudiekompas(I, { V3: { recognition: 2, energy: 2 } }, null, "nl");
    expect(r.betrouwbaarheid.beantwoord).toBe(1);
  });

  it("de teller kan nooit boven het aantal items uitkomen", () => {
    // De grens waar dubbeltellen zichtbaar zou worden. Alle twaalf items met
    // een energie-anker volledig ingevuld: dat blijven twaalf items.
    const alles: Record<string, any> = {};
    for (const id of I.scoringMap.energyItems) alles[id] = { recognition: 3, energy: 2 };
    const r = scoreStudiekompas(I, alles, null, "nl");
    expect(r.betrouwbaarheid.beantwoord).toBe(I.scoringMap.energyItems.length);
    expect(r.betrouwbaarheid.beantwoord).toBeLessThanOrEqual(r.betrouwbaarheid.totaalItems);
  });

  it("de teller komt overeen met het aantal aangeraakte items", () => {
    const gevallen: Record<string, any>[] = [
      {},
      { V3: { energy: 2 } },
      { V3: { recognition: 1 } },
      { V1: { recognition: 2, energy: 1 }, V2: { energy: -1 }, R1: { interest: 2 }, D5: { choice: "a" } },
      { BE1: { energy: 1 }, BE2: { recognition: 2 }, I1: { value: 7 }, S1: { choice: "dialoog" } },
    ];
    for (const antwoorden of gevallen) {
      const r = scoreStudiekompas(I, antwoorden, null, "nl");
      expect(
        r.betrouwbaarheid.beantwoord,
        `teller wijkt af bij ${JSON.stringify(antwoorden)}`,
      ).toBe(aangeraakt(antwoorden));
    }
  });

  it("een volledig ingevulde vragenlijst staat op 34 van 34", () => {
    // Dit is de tegenproef tegen dubbeltellen. De reparatie mag hier niets
    // veranderen: het stond al goed.
    const items = I.sections.find((s) => s.sectionId === "main")!.items;
    const alles: Record<string, any> = {};
    for (const it of items) {
      if (it.itemType === "sjt" || it.options) alles[it.id] = { choice: (it.options || [])[0]?.key };
      else if (it.scale === "interest") alles[it.id] = { interest: 2 };
      else if (it.scale === "recognition") alles[it.id] = { recognition: 3, energy: 1 };
      else alles[it.id] = { value: 5 };
    }
    const r = scoreStudiekompas(I, alles, null, "nl");
    expect(r.betrouwbaarheid.totaalItems).toBe(34);
    expect(r.betrouwbaarheid.beantwoord).toBe(34);
  });

  it("de telling die het voorlopig-signaal stuurt blijft ongemoeid", () => {
    // totaalSignaal is een andere telling, over een vaste lijst van
    // signaaldragende items. Die bepaalt of het rapport voorlopig heet. De
    // reparatie van de teller mag daar niet aan raken.
    const r = scoreStudiekompas(I, { V3: { energy: 2 } }, null, "nl");
    expect(r.betrouwbaarheid.totaalSignaal).toBe(1);
    expect(r.betrouwbaarheid.voorlopig).toBe(true);
    expect(r.betrouwbaarheid.voorlopigDrempel).toBe(I.scoringMap.constants.voorlopigDrempel);
  });
});
