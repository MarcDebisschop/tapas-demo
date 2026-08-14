import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isVerkortPlan,
  isVolledigPlan,
  keurKennischeckNa,
  planTotaal,
  stelKennischeckSamen,
  verkortPlan,
  volledigPlan,
  zwaartepuntBlok,
  type Bankitem,
  type NakijkItem,
} from "../server/bekwaamheid/kennischeck";
import {
  BLOKNAMEN,
  BLOKPLAN,
  BLOKPLAN_TOTAAL,
  BLOKPLAN_VERKORT,
  BLOKPLAN_VERKORT_TOTAAL,
  KENNISCHECKBLOKKEN,
  type Kennischeckblok,
} from "../server/bekwaamheid/schema";

// ---------------------------------------------------------------------------
// Het blokplan zoals het draaiboek het vastlegt
// ---------------------------------------------------------------------------

describe("Het blokplan uit draaiboek 4.3", () => {
  it("legt de verdeling A10 B6 C8 D8 E8 vast", () => {
    expect(BLOKPLAN).toEqual({ A: 10, B: 6, C: 8, D: 8, E: 8 });
    expect(BLOKPLAN_TOTAAL).toBe(40);
    expect(planTotaal(volledigPlan())).toBe(40);
  });

  it("houdt blok C en E samen op veertig procent", () => {
    // Draaiboek §4.3, letterlijk: "Blok C en E zijn samen 40% van de check. Dat
    // is opzettelijk: de meeste schade in dit vak komt niet van iets niet weten,
    // maar van iets beweren wat je niet mag beweren." Zou iemand de verdeling
    // later bijstellen zonder die verhouding te bewaken, dan verdwijnt de
    // bewuste weging in stilte.
    const grenzen = BLOKPLAN.C + BLOKPLAN.E;
    expect(grenzen / BLOKPLAN_TOTAAL).toBeCloseTo(0.4, 10);
  });

  it("houdt de verkorte check op de helft, met dezelfde verhouding", () => {
    expect(BLOKPLAN_VERKORT_TOTAAL).toBe(20);
    expect(planTotaal(verkortPlan())).toBe(20);
    const grenzen = BLOKPLAN_VERKORT.C + BLOKPLAN_VERKORT.E;
    expect(grenzen / BLOKPLAN_VERKORT_TOTAAL).toBeCloseTo(0.4, 10);
  });

  it("kent de twee plannen van elkaar", () => {
    expect(isVolledigPlan(volledigPlan())).toBe(true);
    expect(isVerkortPlan(volledigPlan())).toBe(false);
    expect(isVerkortPlan(verkortPlan())).toBe(true);
    expect(isVolledigPlan(verkortPlan())).toBe(false);
  });

  it("heeft voor elk blok een leesbare naam", () => {
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(BLOKNAMEN[blok], blok).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Samenstellen
// ---------------------------------------------------------------------------

/** Bouwt een bank met per blok het gevraagde aantal meetbare items. */
function maakBank(perBlok: Partial<Record<Kennischeckblok, number>>): Bankitem[] {
  const bank: Bankitem[] = [];
  let id = 100;
  for (const blok of KENNISCHECKBLOKKEN) {
    const aantal = perBlok[blok] ?? 0;
    for (let i = 0; i < aantal; i += 1) {
      bank.push({ id: id++, blok, soort: "meerkeuze", gebruik: "meten", actief: true });
    }
  }
  return bank;
}

/** Een bank die het volledige plan net haalt. */
function volleBank(): Bankitem[] {
  return maakBank(BLOKPLAN);
}

describe("Het samenstellen van een kennischeck", () => {
  it("levert veertig items in de verdeling van het draaiboek", () => {
    const uitkomst = stelKennischeckSamen({ bank: volleBank(), zaad: 7 });
    expect(uitkomst.gelukt).toBe(true);
    expect(uitkomst.itemIds).toHaveLength(BLOKPLAN_TOTAAL);
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(uitkomst.perBlok[blok], `blok ${blok}`).toHaveLength(BLOKPLAN[blok]);
    }
  });

  it("levert geen item twee keer", () => {
    const uitkomst = stelKennischeckSamen({ bank: maakBank({ A: 40, B: 40, C: 40, D: 40, E: 40 }), zaad: 3 });
    expect(new Set(uitkomst.itemIds).size).toBe(uitkomst.itemIds.length);
  });

  it("geeft bij hetzelfde zaad exact dezelfde set", () => {
    // Bij een bezwaar is de eerste vraag: waarom kreeg ik deze veertig. Die vraag
    // is alleen te beantwoorden als de samenstelling met bank en zaad exact te
    // herbouwen is.
    const bank = maakBank({ A: 20, B: 20, C: 20, D: 20, E: 20 });
    const eerste = stelKennischeckSamen({ bank, zaad: 42 });
    const tweede = stelKennischeckSamen({ bank, zaad: 42 });
    expect(tweede.itemIds).toEqual(eerste.itemIds);
    expect(tweede.perBlok).toEqual(eerste.perBlok);
  });

  it("geeft bij een ander zaad een andere set", () => {
    const bank = maakBank({ A: 20, B: 20, C: 20, D: 20, E: 20 });
    const eerste = stelKennischeckSamen({ bank, zaad: 42 });
    const tweede = stelKennischeckSamen({ bank, zaad: 43 });
    expect(tweede.itemIds).not.toEqual(eerste.itemIds);
  });

  it("bewaart het zaad in de uitkomst", () => {
    expect(stelKennischeckSamen({ bank: volleBank(), zaad: 99 }).zaad).toBe(99);
  });

  it("biedt de blokken niet op rij aan", () => {
    // Acht items op rij over grenzen leest als een hoofdstuk, en dat verandert
    // hoe iemand antwoordt. De set moet dus geschud zijn en niet blok voor blok
    // aan elkaar geplakt.
    const bank = volleBank();
    const uitkomst = stelKennischeckSamen({ bank, zaad: 5 });
    const opRij = KENNISCHECKBLOKKEN.flatMap((b) => uitkomst.perBlok[b]);
    expect(uitkomst.itemIds).not.toEqual(opRij);
    // Wel dezelfde inhoud: er mag niets verdwenen of bijgekomen zijn.
    expect([...uitkomst.itemIds].sort((a, b) => a - b)).toEqual(
      [...opRij].sort((a, b) => a - b),
    );
  });

  it("neemt alleen items die op meten staan", () => {
    const bank = volleBank();
    // Vervang alle items van blok B door oefenitems: blok B moet nu tekortkomen.
    const gewijzigd = bank.map((item) =>
      item.blok === "B" ? { ...item, gebruik: "oefenen" } : item,
    );
    const uitkomst = stelKennischeckSamen({ bank: gewijzigd, zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.tekorten.map((t) => t.blok)).toEqual(["B"]);
    expect(uitkomst.tekorten[0]!.beschikbaar).toBe(0);
  });

  it("neemt geen verbrande items", () => {
    const bank = volleBank().map((item) =>
      item.blok === "E" ? { ...item, gebruik: "verbrand" } : item,
    );
    const uitkomst = stelKennischeckSamen({ bank, zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.tekorten.map((t) => t.blok)).toEqual(["E"]);
  });

  it("neemt geen items zonder blok", () => {
    // Zonder blok is niet vast te stellen of de verdeling gehaald is, en die
    // verdeling is de meting.
    const zonderBlok: Bankitem[] = Array.from({ length: 60 }, (_, i) => ({
      id: 900 + i,
      blok: null,
      soort: "meerkeuze",
      gebruik: "meten",
      actief: true,
    }));
    const uitkomst = stelKennischeckSamen({ bank: zonderBlok, zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.tekorten).toHaveLength(KENNISCHECKBLOKKEN.length);
  });

  it("neemt geen niet-actieve items", () => {
    const bank = volleBank().map((item) =>
      item.blok === "D" ? { ...item, actief: false } : item,
    );
    const uitkomst = stelKennischeckSamen({ bank, zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.tekorten.map((t) => t.blok)).toEqual(["D"]);
  });

  it("sluit items uit die deze persoon eerder kreeg", () => {
    // Draaiboek §4.3 eist twee equivalente versies voor herkansingen. Uitsluiten
    // op wat iemand werkelijk zag haalt dezelfde eis en is strenger: bij twee
    // vaste versies kan een kandidaat in ronde drie versie A terugkrijgen.
    const bank = maakBank({ A: 20, B: 12, C: 16, D: 16, E: 16 });
    const eerste = stelKennischeckSamen({ bank, zaad: 11 });
    expect(eerste.gelukt).toBe(true);

    const tweede = stelKennischeckSamen({ bank, zaad: 12, uitsluiten: eerste.itemIds });
    expect(tweede.gelukt).toBe(true);
    const overlap = tweede.itemIds.filter((id) => eerste.itemIds.includes(id));
    expect(overlap).toEqual([]);
    expect(tweede.uitgeslotenWegensEerder).toBe(BLOKPLAN_TOTAAL);
  });

  it("weigert wanneer de uitsluiting de bank te klein maakt", () => {
    // Een bank die net groot genoeg is voor één ronde, kan geen tweede leveren.
    // Weigeren is hier de bedoeling: stil dezelfde items opnieuw aanbieden zou
    // een herkansing over de al bekende items laten gaan.
    const bank = volleBank();
    const eerste = stelKennischeckSamen({ bank, zaad: 1 });
    const tweede = stelKennischeckSamen({ bank, zaad: 2, uitsluiten: eerste.itemIds });
    expect(tweede.gelukt).toBe(false);
    expect(tweede.tekorten).toHaveLength(KENNISCHECKBLOKKEN.length);
    expect(tweede.itemIds).toEqual([]);
  });

  it("levert geen gedeeltelijke set als één blok tekortkomt", () => {
    // De kern van de weigering. Een kennischeck van vierendertig items is geen
    // kennischeck: de wegingen per blok verschuiven en de drempel van 60% is
    // vastgesteld op de verdeling van veertig.
    const bank = maakBank({ ...BLOKPLAN, C: BLOKPLAN.C - 1 });
    const uitkomst = stelKennischeckSamen({ bank, zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.itemIds).toEqual([]);
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(uitkomst.perBlok[blok], `blok ${blok}`).toEqual([]);
    }
  });

  it("benoemt het tekort per blok met gevraagd en beschikbaar", () => {
    // Een tekort dat je niet kan benoemen, wordt niet gedicht.
    const bank = maakBank({ ...BLOKPLAN, C: 3, E: 0 });
    const uitkomst = stelKennischeckSamen({ bank, zaad: 1 });
    expect(uitkomst.tekorten).toEqual([
      { blok: "C", gevraagd: 8, beschikbaar: 3 },
      { blok: "E", gevraagd: 8, beschikbaar: 0 },
    ]);
  });

  it("stelt ook de verkorte check van twintig samen", () => {
    const uitkomst = stelKennischeckSamen({
      bank: volleBank(),
      plan: verkortPlan(),
      zaad: 4,
    });
    expect(uitkomst.gelukt).toBe(true);
    expect(uitkomst.itemIds).toHaveLength(BLOKPLAN_VERKORT_TOTAAL);
  });

  it("laat de meegegeven bank ongemoeid", () => {
    // Een samensteller die zijn invoer schudt, maakt de aanroeper afhankelijk van
    // de aanroeporde.
    const bank = volleBank();
    const kopie = bank.map((i) => ({ ...i }));
    stelKennischeckSamen({ bank, zaad: 8 });
    expect(bank).toEqual(kopie);
  });

  it("laat een lege bank stuklopen op alle vijf de blokken", () => {
    const uitkomst = stelKennischeckSamen({ bank: [], zaad: 1 });
    expect(uitkomst.gelukt).toBe(false);
    expect(uitkomst.tekorten.map((t) => t.beschikbaar)).toEqual([0, 0, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// Nakijken
// ---------------------------------------------------------------------------

function keuzeItem(id: number, sleutel: string, blok = "A"): NakijkItem {
  return { id, soort: "meerkeuze", sleutel, blok };
}

describe("Het nakijken van een kennischeck", () => {
  it("rekent een volledig automatische set na", () => {
    const items = [keuzeItem(1, "A"), keuzeItem(2, "B"), keuzeItem(3, "C"), keuzeItem(4, "D")];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "A", "2": "B", "3": "D", "4": "D" },
    });
    expect(uitkomst.volledig).toBe(true);
    expect(uitkomst.goed).toBe(3);
    expect(uitkomst.meetbaar).toBe(4);
    expect(uitkomst.ruweScore).toBeCloseTo(0.75, 10);
  });

  it("negeert hoofdletters en witruimte in het antwoord", () => {
    const uitkomst = keurKennischeckNa({
      items: [keuzeItem(1, "C")],
      antwoorden: { "1": " c " },
    });
    expect(uitkomst.goed).toBe(1);
  });

  it("rekent juist en onjuist na", () => {
    const items: NakijkItem[] = [
      { id: 1, soort: "juistfout", sleutel: "juist", blok: "C" },
      { id: 2, soort: "juistfout", sleutel: "onjuist", blok: "C" },
    ];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "Juist", "2": "juist" },
    });
    expect(uitkomst.goed).toBe(1);
    expect(uitkomst.ruweScore).toBeCloseTo(0.5, 10);
  });

  it("rekent een onbeantwoord item als onjuist en verkleint de noemer niet", () => {
    // De check is open boek, zonder timer, met één inlevering. Zou leeg niet
    // meetellen, dan wordt overslaan een strategie: wie de twaalf moeilijkste
    // items leeglaat, houdt achtentwintig items over waarop hij goed scoort.
    const items = [keuzeItem(1, "A"), keuzeItem(2, "B"), keuzeItem(3, "C"), keuzeItem(4, "D")];
    const uitkomst = keurKennischeckNa({ items, antwoorden: { "1": "A", "2": "B" } });
    expect(uitkomst.meetbaar).toBe(4);
    expect(uitkomst.goed).toBe(2);
    expect(uitkomst.ruweScore).toBeCloseTo(0.5, 10);
    expect(uitkomst.volledig).toBe(true);
  });

  it("houdt de score leeg zolang een open item op een mens wacht", () => {
    // De kern van dit bestand. Zou het automatische deel als score teruggaan, dan
    // is dat getal te laag om een verkeerde reden: de open items staan er dan als
    // onbeantwoord in, en een beslisvoorstel op zo'n getal gaat over een andere
    // kandidaat dan die er zat.
    const items: NakijkItem[] = [
      keuzeItem(1, "A"),
      keuzeItem(2, "B"),
      { id: 3, soort: "open", sleutel: "Het antwoord benoemt de grens van het instrument.", blok: "C" },
    ];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "A", "2": "B", "3": "Omdat het instrument daar niet voor is." },
    });
    expect(uitkomst.volledig).toBe(false);
    expect(uitkomst.ruweScore).toBeNull();
    expect(uitkomst.wachtOp).toEqual([3]);
    expect(uitkomst.goed).toBe(2);
    expect(uitkomst.meetbaar).toBe(3);
  });

  it("levert een score zodra de beoordelaar de open items heeft gescoord", () => {
    const items: NakijkItem[] = [
      keuzeItem(1, "A"),
      keuzeItem(2, "B"),
      { id: 3, soort: "open", sleutel: "Het antwoord benoemt de grens van het instrument.", blok: "C" },
      { id: 4, soort: "open", sleutel: "Het antwoord benoemt de rechtsgrond.", blok: "E" },
    ];
    const antwoorden = { "1": "A", "2": "C", "3": "Antwoord drie.", "4": "Antwoord vier." };

    const half = keurKennischeckNa({ items, antwoorden, handmatigeScores: { "3": 1 } });
    expect(half.volledig).toBe(false);
    expect(half.ruweScore).toBeNull();
    expect(half.wachtOp).toEqual([4]);

    const heel = keurKennischeckNa({
      items,
      antwoorden,
      handmatigeScores: { "3": 1, "4": 0 },
    });
    expect(heel.volledig).toBe(true);
    expect(heel.goed).toBe(2);
    expect(heel.ruweScore).toBeCloseTo(0.5, 10);
  });

  it("negeert een handmatige score op een item dat een machine nakijkt", () => {
    // Anders kan een beoordelaar een automatisch fout antwoord goedrekenen zonder
    // dat daar ergens een spoor van is. Wie een sleutel verkeerd vindt, past het
    // item aan.
    const uitkomst = keurKennischeckNa({
      items: [keuzeItem(1, "A")],
      antwoorden: { "1": "B" },
      handmatigeScores: { "1": 1 },
    });
    expect(uitkomst.goed).toBe(0);
    expect(uitkomst.ruweScore).toBeCloseTo(0, 10);
  });

  it("haalt een uitgesloten item uit de noemer en niet uit de teller alleen", () => {
    // Draaiboek §4.3: items met een p-waarde onder .30 of boven .95 gaan uit de
    // scoring van die ronde. Het item als fout laten staan zou de kandidaat
    // straffen voor een fout van de itemschrijver.
    const items = [keuzeItem(1, "A"), keuzeItem(2, "B"), keuzeItem(3, "C"), keuzeItem(4, "D")];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "A", "2": "B", "3": "A", "4": "A" },
      uitsluiten: [3, 4],
      redenUitsluiting: "p-waarde onder .30 na itemanalyse van 24 afnames",
    });
    expect(uitkomst.meetbaar).toBe(2);
    expect(uitkomst.goed).toBe(2);
    expect(uitkomst.ruweScore).toBeCloseTo(1, 10);
    expect(uitkomst.uitgesloten).toEqual([3, 4]);
    const uitgesloten = uitkomst.perItem.filter((i) => i.beoordeling === "uitgesloten");
    expect(uitgesloten).toHaveLength(2);
    expect(uitgesloten[0]!.redenUitsluiting).toMatch(/p-waarde/);
  });

  it("wacht niet op een open item dat is uitgesloten", () => {
    const items: NakijkItem[] = [
      keuzeItem(1, "A"),
      { id: 2, soort: "open", sleutel: "Een scoringssleutel van voldoende lengte.", blok: "C" },
    ];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "A", "2": "Iets." },
      uitsluiten: [2],
    });
    expect(uitkomst.volledig).toBe(true);
    expect(uitkomst.wachtOp).toEqual([]);
    expect(uitkomst.ruweScore).toBeCloseTo(1, 10);
  });

  it("geeft geen score bij een set waarin alles is uitgesloten", () => {
    // Delen door nul zou Infinity of NaN geven, en dat glipt door een reeks
    // berekeningen heen tot het ergens als score op een scherm staat.
    const items = [keuzeItem(1, "A"), keuzeItem(2, "B")];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: { "1": "A", "2": "B" },
      uitsluiten: [1, 2],
    });
    expect(uitkomst.meetbaar).toBe(0);
    expect(uitkomst.ruweScore).toBeNull();
    expect(Number.isNaN(uitkomst.ruweScore as unknown as number)).toBe(false);
  });

  it("houdt de volgorde van perItem gelijk aan de itemset", () => {
    const items = [keuzeItem(7, "A"), keuzeItem(3, "B"), keuzeItem(9, "C")];
    const uitkomst = keurKennischeckNa({ items, antwoorden: {} });
    expect(uitkomst.perItem.map((i) => i.itemId)).toEqual([7, 3, 9]);
  });

  it("geeft de score tussen nul en een", () => {
    const items = [keuzeItem(1, "A"), keuzeItem(2, "B")];
    for (const antwoorden of [{}, { "1": "A" }, { "1": "A", "2": "B" }]) {
      const uitkomst = keurKennischeckNa({ items, antwoorden });
      expect(uitkomst.ruweScore).toBeGreaterThanOrEqual(0);
      expect(uitkomst.ruweScore).toBeLessThanOrEqual(1);
    }
  });

  it("rekent een antwoord dat geen letter is als onjuist", () => {
    for (const ruw of ["", " ", "AB", "1", "b)"]) {
      const uitkomst = keurKennischeckNa({
        items: [keuzeItem(1, "B")],
        antwoorden: { "1": ruw },
      });
      expect(uitkomst.goed, `antwoord ${JSON.stringify(ruw)}`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Terugkoppeling onder de drempel
// ---------------------------------------------------------------------------

describe("Het zwaartepunt van de gemiste items", () => {
  it("wijst het blok met de meeste gemiste items aan", () => {
    const items = [
      keuzeItem(1, "A", "A"),
      keuzeItem(2, "A", "C"),
      keuzeItem(3, "A", "C"),
      keuzeItem(4, "A", "C"),
      keuzeItem(5, "A", "E"),
    ];
    const uitkomst = keurKennischeckNa({ items, antwoorden: { "1": "A", "5": "A" } });
    const zwaartepunt = zwaartepuntBlok(uitkomst);
    expect(zwaartepunt.blok).toBe("C");
    expect(zwaartepunt.toelichting).toBe(BLOKNAMEN.C);
  });

  it("geeft geen enkel getal terug", () => {
    // Draaiboek §4.3: wie onder de drempel blijft, krijgt geen subscores per blok.
    // Blok B heeft zes items; 4 op 6 heeft een betrouwbaarheidsinterval waar de
    // hele schaal in past. Wat wél houdbaar is, is de rangorde.
    const uitkomst = keurKennischeckNa({
      items: [keuzeItem(1, "A", "B")],
      antwoorden: {},
    });
    const zwaartepunt = zwaartepuntBlok(uitkomst);
    expect(Object.keys(zwaartepunt).sort()).toEqual(["blok", "toelichting"]);
    for (const waarde of Object.values(zwaartepunt)) {
      expect(typeof waarde).not.toBe("number");
    }
  });

  it("wijst geen blok aan bij een gelijke stand", () => {
    // Twee blokken die even zwaar wegen tot één aanwijzing terugbrengen zou een
    // keuze verzinnen die de gegevens niet dragen.
    const items = [keuzeItem(1, "A", "A"), keuzeItem(2, "A", "C")];
    const uitkomst = keurKennischeckNa({ items, antwoorden: {} });
    const zwaartepunt = zwaartepuntBlok(uitkomst);
    expect(zwaartepunt.blok).toBeNull();
    expect(zwaartepunt.toelichting).toBe("");
  });

  it("wijst geen blok aan wanneer er niets gemist is", () => {
    const uitkomst = keurKennischeckNa({
      items: [keuzeItem(1, "A", "A")],
      antwoorden: { "1": "A" },
    });
    expect(zwaartepuntBlok(uitkomst).blok).toBeNull();
  });

  it("telt uitgesloten items niet mee als gemist", () => {
    // Een item dat uit de scoring is gehaald wegens een slechte p-waarde mag het
    // zwaartepunt niet naar zijn blok trekken; dan zou het opfrisaanbod over een
    // itemfout gaan in plaats van over een kennishiaat.
    const items = [
      keuzeItem(1, "A", "A"),
      keuzeItem(2, "A", "A"),
      keuzeItem(3, "A", "A"),
      keuzeItem(4, "A", "E"),
    ];
    const uitkomst = keurKennischeckNa({
      items,
      antwoorden: {},
      uitsluiten: [1, 2, 3],
    });
    expect(zwaartepuntBlok(uitkomst).blok).toBe("E");
  });

  it("negeert items zonder blok", () => {
    const items: NakijkItem[] = [
      { id: 1, soort: "meerkeuze", sleutel: "A", blok: null },
      { id: 2, soort: "meerkeuze", sleutel: "A", blok: null },
      keuzeItem(3, "A", "D"),
    ];
    const uitkomst = keurKennischeckNa({ items, antwoorden: {} });
    expect(zwaartepuntBlok(uitkomst).blok).toBe("D");
  });
});

// ---------------------------------------------------------------------------
// De brontekst
// ---------------------------------------------------------------------------

describe("De brontekst van kennischeck.ts", () => {
  const bron = fs.readFileSync(
    path.join(process.cwd(), "server/bekwaamheid/kennischeck.ts"),
    "utf8",
  );

  function zonderCommentaar(tekst: string): string {
    return tekst
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((r) => !r.trim().startsWith("//"))
      .join("\n");
  }

  it("raakt geen databank en geen Express aan", () => {
    const code = zonderCommentaar(bron);
    for (const verboden of [
      "better-sqlite3",
      "express",
      "drizzle",
      "./storage",
      "db.prepare",
      "fetch(",
    ]) {
      expect(code, `kennischeck.ts verwijst naar ${verboden}`).not.toContain(verboden);
    }
  });

  it("gebruikt geen toeval en geen datum", () => {
    // Math.random zou de samenstelling onherhaalbaar maken, en dan is bij een
    // bezwaar niet meer na te gaan of de set zo is samengesteld als beweerd.
    const code = zonderCommentaar(bron);
    for (const verboden of ["Math.random", "new Date", "Date.now"]) {
      expect(code, `kennischeck.ts gebruikt ${verboden}`).not.toContain(verboden);
    }
  });
});
