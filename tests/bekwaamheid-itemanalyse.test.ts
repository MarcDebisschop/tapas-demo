/**
 * Tests op de itemanalyse.
 *
 * Twee dingen worden hier vastgezet. Ten eerste de rekenkunde: de p-waarde en
 * de item-restcorrelatie moeten kloppen tegen met de hand nagerekende getallen,
 * niet tegen wat de code nu toevallig teruggeeft. Ten tweede de grenzen uit
 * protocol blok 4, inclusief de vraag wat er op de grens zelf gebeurt.
 *
 * De met de hand nagerekende gevallen staan in commentaar bij de test, zodat
 * een volgende lezer de verwachting kan controleren zonder de code te lezen.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AFNAMEMINIMUM,
  P_BOVENGRENS,
  P_ONDERGRENS,
  analyseerItems,
  isUitsluitgrond,
  voorgesteldeUitsluitingen,
  type Afnameregel,
  type Itembeoordeling,
} from "../server/bekwaamheid/itemanalyse";

const BESTAND = join(process.cwd(), "server/bekwaamheid/itemanalyse.ts");

/**
 * Bouwt afnames uit een patroon per item: "gggff" betekent drie keer goed en
 * twee keer fout, in die volgorde. Alle patronen moeten even lang zijn, want
 * elke positie is één afname.
 */
function bouwAfnames(patronen: Record<number, string>): Afnameregel[] {
  const ids = Object.keys(patronen).map(Number);
  const lengtes = new Set(ids.map((id) => patronen[id].length));
  if (lengtes.size !== 1) throw new Error("alle patronen moeten even lang zijn");
  const aantal = patronen[ids[0]].length;

  const teken: Record<string, Itembeoordeling> = {
    g: "goed",
    f: "fout",
    u: "uitgesloten",
    w: "wacht_op_mens",
  };

  const afnames: Afnameregel[] = [];
  for (let i = 0; i < aantal; i += 1) {
    const uitkomsten: Record<number, Itembeoordeling> = {};
    for (const id of ids) {
      const t = patronen[id][i];
      if (t === "-") continue; // item niet aangeboden
      const beoordeling = teken[t];
      if (!beoordeling) throw new Error(`onbekend teken "${t}"`);
      uitkomsten[id] = beoordeling;
    }
    afnames.push({ itemsetId: i + 1, uitkomsten });
  }
  return afnames;
}

/** Herhaalt een teken n keer. */
function n(teken: string, aantal: number): string {
  return teken.repeat(aantal);
}

describe("de grenzen komen uit het draaiboek", () => {
  it("het minimum is twintig afnames", () => {
    expect(AFNAMEMINIMUM).toBe(20);
  });

  it("de p-grenzen zijn .30 en .95", () => {
    expect(P_ONDERGRENS).toBe(0.3);
    expect(P_BOVENGRENS).toBe(0.95);
  });
});

describe("onder het minimum volgt geen uitspraak", () => {
  it("negentien afnames leveren geen p-waarde", () => {
    const afnames = bouwAfnames({ 1: n("g", 10) + n("f", 9) });
    const uit = analyseerItems({ afnames });

    expect(uit.aantalAfnames).toBe(19);
    expect(uit.voldoendeAfnames).toBe(false);
    expect(uit.items[0].pWaarde).toBeNull();
    expect(uit.items[0].discriminatie).toBeNull();
    expect(uit.items[0].advies).toBe("te_weinig_afnames");
  });

  it("de tellingen zijn er wél, ook onder het minimum", () => {
    const afnames = bouwAfnames({ 1: n("g", 4) + n("f", 3) + n("u", 2) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].aantalMeetbaar).toBe(7);
    expect(uit.items[0].aantalGoed).toBe(4);
    expect(uit.items[0].aantalBuitenMeting).toBe(2);
  });

  it("twintig afnames leveren wél een uitspraak", () => {
    const afnames = bouwAfnames({ 1: n("g", 10) + n("f", 10), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });

    expect(uit.aantalAfnames).toBe(20);
    expect(uit.voldoendeAfnames).toBe(true);
    expect(uit.items[0].pWaarde).not.toBeNull();
  });

  it("de grond noemt hoeveel afnames er nog missen", () => {
    const afnames = bouwAfnames({ 1: n("g", 5) });
    const uit = analyseerItems({ afnames });
    expect(uit.items[0].grond).toContain("5 van de 20");
  });
});

describe("de p-waarde", () => {
  it("is het aandeel goed over de meetbare afnames", () => {
    // 14 goed van 20 meetbaar = 0,70.
    const afnames = bouwAfnames({ 1: n("g", 14) + n("f", 6), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });
    expect(uit.items[0].pWaarde).toBe(0.7);
  });

  it("rekent uitgesloten en wachtende items niet in de noemer", () => {
    // 15 goed, 8 fout, 4 uitgesloten, 3 wachtend: noemer 23, p = 15/23 = 0,6522.
    const afnames = bouwAfnames({
      1: n("g", 15) + n("f", 8) + n("u", 4) + n("w", 3),
      2: n("g", 15) + n("f", 15),
    });
    const uit = analyseerItems({ afnames });
    const item = uit.items[0];

    expect(item.aantalMeetbaar).toBe(23);
    expect(item.aantalBuitenMeting).toBe(7);
    expect(item.pWaarde).toBe(0.6522);
  });

  it("telt een item dat niet is aangeboden nergens mee", () => {
    // 20 afnames, item 2 alleen in de eerste tien aangeboden.
    const afnames = bouwAfnames({
      1: n("g", 20),
      2: n("g", 6) + n("f", 4) + n("-", 10),
    });
    const uit = analyseerItems({ afnames, minimum: 10 });
    const tweede = uit.items.find((i) => i.itemId === 2)!;

    expect(tweede.aantalMeetbaar).toBe(10);
    expect(tweede.aantalBuitenMeting).toBe(0);
    expect(tweede.pWaarde).toBe(0.6);
  });
});

describe("de item-restcorrelatie", () => {
  it("gebruikt de rest en niet het totaal", () => {
    // Vier items, twintig afnames. Item 1 loopt precies gelijk met de andere
    // drie: de eerste tien kandidaten hebben alles goed, de laatste tien alles
    // fout. De itemscore is dan 1..1,0..0 en de restscore 3..3,0..0. Die twee
    // reeksen zijn perfect gelijkgericht, dus r = 1.
    const goedFout = n("g", 10) + n("f", 10);
    const afnames = bouwAfnames({ 1: goedFout, 2: goedFout, 3: goedFout, 4: goedFout });
    const uit = analyseerItems({ afnames });
    expect(uit.items[0].discriminatie).toBe(1);
  });

  it("wordt negatief bij een item dat omkeert", () => {
    // Item 1 staat precies omgekeerd op de andere drie: wie de rest goed heeft,
    // heeft item 1 fout. Itemscore 0..0,1..1 tegen restscore 3..3,0..0 geeft
    // r = -1.
    const goedFout = n("g", 10) + n("f", 10);
    const omgekeerd = n("f", 10) + n("g", 10);
    const afnames = bouwAfnames({ 1: omgekeerd, 2: goedFout, 3: goedFout, 4: goedFout });
    const uit = analyseerItems({ afnames });
    expect(uit.items[0].discriminatie).toBe(-1);
  });

  it("is leeg wanneer alle kandidaten het item goed hadden", () => {
    const afnames = bouwAfnames({ 1: n("g", 20), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });
    const item = uit.items[0];

    expect(item.discriminatie).toBeNull();
    expect(item.redenGeenDiscriminatie).toContain("geen spreiding");
  });

  it("is leeg wanneer geen enkele kandidaat het item goed had", () => {
    const afnames = bouwAfnames({ 1: n("f", 20), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });
    const item = uit.items[0];

    expect(item.discriminatie).toBeNull();
    expect(item.redenGeenDiscriminatie).toContain("geen enkele kandidaat");
  });

  it("is leeg, en niet nul, wanneer de restscores geen spreiding hebben", () => {
    // Twee items. Item 2 heeft iedereen goed, dus de restscore van item 1 is
    // bij elke kandidaat 1. Nul teruggeven zou "geen samenhang" beweren waar
    // "niet te bepalen" hoort te staan.
    const afnames = bouwAfnames({ 1: n("g", 12) + n("f", 8), 2: n("g", 20) });
    const uit = analyseerItems({ afnames });
    const eerste = uit.items.find((i) => i.itemId === 1)!;

    expect(eerste.discriminatie).toBeNull();
    expect(eerste.redenGeenDiscriminatie).toContain("restscores");
  });

  it("rekent een met de hand nagerekend geval goed uit", () => {
    // Twee items, twintig afnames, opgebouwd in vier groepen van vijf:
    //   groep 1 (5x): item1 goed, item2 goed  -> itemscore 1, restscore 1
    //   groep 2 (5x): item1 goed, item2 fout  -> itemscore 1, restscore 0
    //   groep 3 (5x): item1 fout, item2 goed  -> itemscore 0, restscore 1
    //   groep 4 (5x): item1 fout, item2 fout  -> itemscore 0, restscore 0
    // Item- en restscore zijn hier volledig onafhankelijk: elke combinatie
    // komt even vaak voor. De correlatie is dan exact 0.
    const item1 = n("g", 10) + n("f", 10);
    const item2 = n("g", 5) + n("f", 5) + n("g", 5) + n("f", 5);
    const uit = analyseerItems({ afnames: bouwAfnames({ 1: item1, 2: item2 }) });

    expect(uit.items[0].pWaarde).toBe(0.5);
    expect(uit.items[0].discriminatie).toBe(0);
  });
});

describe("de grenzen zijn strikt", () => {
  it("p precies .30 blijft staan", () => {
    // 6 goed van 20 = 0,30 exact.
    const afnames = bouwAfnames({ 1: n("g", 6) + n("f", 14), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].pWaarde).toBe(0.3);
    expect(uit.items[0].advies).toBe("houden");
  });

  it("p net onder .30 is te moeilijk", () => {
    // 5 goed van 20 = 0,25.
    const afnames = bouwAfnames({ 1: n("g", 5) + n("f", 15), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].pWaarde).toBe(0.25);
    expect(uit.items[0].advies).toBe("te_moeilijk");
  });

  it("p precies .95 blijft staan", () => {
    // 19 goed van 20 = 0,95 exact.
    const afnames = bouwAfnames({ 1: n("g", 19) + n("f", 1), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].pWaarde).toBe(0.95);
    expect(uit.items[0].advies).toBe("houden");
  });

  it("p boven .95 is te makkelijk", () => {
    // 40 goed van 40 zou 1,00 zijn; hier 39 van 40 = 0,975.
    const afnames = bouwAfnames({ 1: n("g", 39) + n("f", 1), 2: n("g", 20) + n("f", 20) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].pWaarde).toBe(0.975);
    expect(uit.items[0].advies).toBe("te_makkelijk");
  });

  it("een item dat iedereen goed heeft, heet te makkelijk en niet onbeslist", () => {
    // p = 1 én geen berekenbare correlatie. Het advies moet het werkelijke
    // gebrek noemen.
    const afnames = bouwAfnames({ 1: n("g", 20), 2: n("g", 10) + n("f", 10) });
    const uit = analyseerItems({ afnames });

    expect(uit.items[0].pWaarde).toBe(1);
    expect(uit.items[0].discriminatie).toBeNull();
    expect(uit.items[0].advies).toBe("te_makkelijk");
  });

  it("een negatieve correlatie binnen de p-grenzen levert keert_om", () => {
    const goedFout = n("g", 10) + n("f", 10);
    const omgekeerd = n("f", 10) + n("g", 10);
    const uit = analyseerItems({
      afnames: bouwAfnames({ 1: omgekeerd, 2: goedFout, 3: goedFout, 4: goedFout }),
    });

    expect(uit.items[0].pWaarde).toBe(0.5);
    expect(uit.items[0].advies).toBe("keert_om");
  });

  it("een correlatie van precies nul is geen uitsluitgrond", () => {
    // Het draaiboek zegt "negatieve item-restcorrelatie". Nul is niet negatief.
    const item1 = n("g", 10) + n("f", 10);
    const item2 = n("g", 5) + n("f", 5) + n("g", 5) + n("f", 5);
    const uit = analyseerItems({ afnames: bouwAfnames({ 1: item1, 2: item2 }) });

    expect(uit.items[0].discriminatie).toBe(0);
    expect(uit.items[0].advies).toBe("houden");
  });
});

describe("het minimum geldt ook per item", () => {
  it("een item met te weinig meetbare afnames krijgt geen uitspraak", () => {
    // Veertig afnames, maar item 2 is er maar in vijftien meetbaar.
    const afnames = bouwAfnames({
      1: n("g", 20) + n("f", 20),
      2: n("g", 8) + n("f", 7) + n("-", 25),
    });
    const uit = analyseerItems({ afnames });
    const tweede = uit.items.find((i) => i.itemId === 2)!;

    expect(uit.voldoendeAfnames).toBe(true);
    expect(tweede.aantalMeetbaar).toBe(15);
    expect(tweede.advies).toBe("te_weinig_afnames");
    expect(tweede.pWaarde).toBeNull();
  });

  it("een item dat overal buiten de meting bleef, krijgt geen uitspraak", () => {
    const afnames = bouwAfnames({ 1: n("g", 10) + n("f", 10), 2: n("u", 20) });
    const uit = analyseerItems({ afnames });
    const tweede = uit.items.find((i) => i.itemId === 2)!;

    expect(tweede.aantalMeetbaar).toBe(0);
    expect(tweede.aantalBuitenMeting).toBe(20);
    expect(tweede.advies).toBe("te_weinig_afnames");
    expect(tweede.redenGeenDiscriminatie).toContain("in geen enkele afname meetbaar");
  });
});

describe("dubbele afnames", () => {
  it("worden één keer meegerekend en gemeld", () => {
    const basis = bouwAfnames({ 1: n("g", 20) });
    const afnames = [...basis, basis[0]];
    const uit = analyseerItems({ afnames });

    expect(uit.aantalAfnames).toBe(20);
    expect(uit.bevindingen.length).toBe(1);
    expect(uit.bevindingen[0]).toContain("meer dan één keer");
  });

  it("kunnen het aantal niet over het minimum tillen", () => {
    const basis = bouwAfnames({ 1: n("g", 10) });
    const uit = analyseerItems({ afnames: [...basis, ...basis] });

    expect(uit.aantalAfnames).toBe(10);
    expect(uit.voldoendeAfnames).toBe(false);
  });
});

describe("het advies is een voorstel en geen handeling", () => {
  it("te weinig afnames is geen uitsluitgrond", () => {
    expect(isUitsluitgrond("te_weinig_afnames")).toBe(false);
    expect(isUitsluitgrond("houden")).toBe(false);
  });

  it("de drie gebreken zijn wél uitsluitgrond", () => {
    expect(isUitsluitgrond("te_moeilijk")).toBe(true);
    expect(isUitsluitgrond("te_makkelijk")).toBe(true);
    expect(isUitsluitgrond("keert_om")).toBe(true);
  });

  it("voorgesteldeUitsluitingen levert alleen de gebrekkige items, op id", () => {
    const goedFout = n("g", 10) + n("f", 10);
    const uit = analyseerItems({
      afnames: bouwAfnames({
        1: n("g", 20), // p = 1: te makkelijk
        2: goedFout, // houden
        3: n("f", 20), // p = 0: te moeilijk
        4: goedFout, // houden
      }),
    });

    expect(voorgesteldeUitsluitingen(uit)).toEqual([1, 3]);
  });

  it("aandacht bevat ook de items zonder uitspraak", () => {
    const afnames = bouwAfnames({ 1: n("g", 10) });
    const uit = analyseerItems({ afnames });
    expect(uit.aandacht).toEqual([1]);
  });

  it("elke uitkomst draagt een grond die te tonen is", () => {
    const goedFout = n("g", 10) + n("f", 10);
    const uit = analyseerItems({
      afnames: bouwAfnames({ 1: n("g", 20), 2: goedFout, 3: n("f", 20) }),
    });

    for (const item of uit.items) {
      expect(item.grond.length).toBeGreaterThan(40);
      expect(item.grond).not.toContain("undefined");
      expect(item.grond).not.toContain("NaN");
    }
  });
});

describe("de uitkomst is stabiel en ordelijk", () => {
  it("items staan op oplopend id", () => {
    const goedFout = n("g", 10) + n("f", 10);
    const uit = analyseerItems({
      afnames: bouwAfnames({ 7: goedFout, 2: goedFout, 91: goedFout, 13: goedFout }),
    });
    expect(uit.items.map((i) => i.itemId)).toEqual([2, 7, 13, 91]);
  });

  it("twee keer dezelfde invoer levert exact dezelfde uitkomst", () => {
    const maak = () =>
      bouwAfnames({
        1: n("g", 13) + n("f", 7),
        2: n("g", 9) + n("f", 11),
        3: n("g", 4) + n("f", 16),
      });
    expect(analyseerItems({ afnames: maak() })).toEqual(analyseerItems({ afnames: maak() }));
  });

  it("geen enkel getal komt er als NaN of Infinity uit", () => {
    const uit = analyseerItems({
      afnames: bouwAfnames({ 1: n("u", 20), 2: n("g", 20), 3: n("f", 20) }),
    });
    for (const item of uit.items) {
      for (const waarde of [item.pWaarde, item.discriminatie]) {
        if (waarde !== null) expect(Number.isFinite(waarde)).toBe(true);
      }
    }
  });

  it("een lege invoer valt niet om", () => {
    const uit = analyseerItems({ afnames: [] });
    expect(uit.aantalAfnames).toBe(0);
    expect(uit.items).toEqual([]);
    expect(uit.aandacht).toEqual([]);
    expect(uit.voldoendeAfnames).toBe(false);
  });

  it("een afwijkend minimum staat in de uitkomst", () => {
    const uit = analyseerItems({ afnames: bouwAfnames({ 1: n("g", 6) + n("f", 4) }), minimum: 10 });
    expect(uit.minimumGebruikt).toBe(10);
    expect(uit.voldoendeAfnames).toBe(true);
    expect(uit.items[0].pWaarde).toBe(0.6);
  });
});

describe("de laag blijft zuiver", () => {
  /** Haalt commentaar weg, zodat een woord uit een toelichting niet meetelt. */
  function zonderCommentaar(bron: string): string {
    return bron.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it("raakt geen databank, geen Express, geen klok en geen toeval", () => {
    const code = zonderCommentaar(readFileSync(BESTAND, "utf-8"));
    for (const verboden of [
      "better-sqlite3",
      "express",
      "drizzle",
      "./storage",
      "db.prepare",
      "fetch(",
      "new Date",
      "Date.now",
      "Math.random",
    ]) {
      expect(code).not.toContain(verboden);
    }
  });

  it("gebruikt de restscore en noemt dat ook zo", () => {
    const bron = readFileSync(BESTAND, "utf-8");
    expect(bron).toContain("restScores");
    expect(bron).toContain("item-restcorrelatie");
  });
});
