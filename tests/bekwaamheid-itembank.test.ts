import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  JUISTFOUT_SLEUTELS,
  OPTIES_MAXIMUM,
  OPTIES_MINIMUM,
  STAM_MINIMUM,
  TOELICHTING_MINIMUM,
  blokdekking,
  indexNaarLetter,
  isAutomatischScoorbaar,
  isMeetbaar,
  letterNaarIndex,
  magOvergang,
  valideerItem,
  type ItemInvoer,
} from "../server/bekwaamheid/itembank";
import { ITEMGEBRUIKEN } from "../server/bekwaamheid/schema";

// ---------------------------------------------------------------------------
// De eenrichtingsstatusmachine
// ---------------------------------------------------------------------------

describe("De eenrichtingsregel op het gebruik van een item", () => {
  it("laat een meetitem degraderen naar oefenitem", () => {
    // De normale weg voor een item dat na itemanalyse te makkelijk blijkt: het
    // verliest zijn meetfunctie en wordt lesmateriaal.
    expect(magOvergang("meten", "oefenen").toegestaan).toBe(true);
  });

  it("laat beide levende toestanden verbranden", () => {
    expect(magOvergang("meten", "verbrand").toegestaan).toBe(true);
    expect(magOvergang("oefenen", "verbrand").toegestaan).toBe(true);
  });

  it("weigert oefenen naar meten", () => {
    // De belangrijkste regel van dit bestand. Een oefenitem is inhoudelijk
    // bekend bij wie de oefenset heeft gezien; als meetitem levert het hoge
    // scores op zonder dat er iets gemeten is, en het verraderlijke is dat dat
    // niet opvalt: de p-waarde stijgt en de check lijkt gewoon makkelijker
    // geworden.
    const uitspraak = magOvergang("oefenen", "meten");
    expect(uitspraak.toegestaan).toBe(false);
    expect(uitspraak.reden).toMatch(/nooit meetitem/);
  });

  it("laat niets meer toe vanuit verbrand", () => {
    for (const naar of ITEMGEBRUIKEN) {
      if (naar === "verbrand") continue;
      const uitspraak = magOvergang("verbrand", naar);
      expect(uitspraak.toegestaan, `verbrand naar ${naar} werd toegestaan`).toBe(false);
      expect(uitspraak.reden).toMatch(/blijft verbrand/);
    }
  });

  it("laat gelijk blijven altijd toe", () => {
    // Geen overgang, maar wel een schrijfhandeling die hier langs kan komen. Zou
    // die falen, dan is een spelfout in de stam van een meetitem niet meer te
    // herstellen.
    for (const gebruik of ITEMGEBRUIKEN) {
      expect(magOvergang(gebruik, gebruik).toegestaan, gebruik).toBe(true);
    }
  });

  it("weigert een onbekende waarde in plaats van er iets van te maken", () => {
    expect(magOvergang("bevroren" as never, "meten").toegestaan).toBe(false);
    expect(magOvergang("meten", "actief" as never).toegestaan).toBe(false);
  });

  it("dekt alle negen combinaties van de drie toestanden", () => {
    // Een uitputtend raster. Zou er een vierde gebruik bijkomen, dan valt deze
    // test om en niet de module in stilte.
    const verwacht: Record<string, boolean> = {
      "oefenen>oefenen": true,
      "oefenen>meten": false,
      "oefenen>verbrand": true,
      "meten>oefenen": true,
      "meten>meten": true,
      "meten>verbrand": true,
      "verbrand>oefenen": false,
      "verbrand>meten": false,
      "verbrand>verbrand": true,
    };
    expect(Object.keys(verwacht)).toHaveLength(ITEMGEBRUIKEN.length ** 2);
    for (const van of ITEMGEBRUIKEN) {
      for (const naar of ITEMGEBRUIKEN) {
        const sleutel = `${van}>${naar}`;
        expect(magOvergang(van, naar).toegestaan, sleutel).toBe(verwacht[sleutel]);
      }
    }
  });

  it("noemt alleen meten meetbaar", () => {
    expect(isMeetbaar("meten")).toBe(true);
    expect(isMeetbaar("oefenen")).toBe(false);
    expect(isMeetbaar("verbrand")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// De constructieregels
// ---------------------------------------------------------------------------

/** Een item dat door alle regels heen komt. Basis voor de afwijkingen hieronder. */
function geldigItem(): ItemInvoer {
  return {
    instrumentId: "t4p-business-kompas",
    as: "weten",
    blok: "C",
    soort: "meerkeuze",
    stam:
      "Een coach wil de scores van het Business Kompas gebruiken om te bepalen " +
      "wie in aanmerking komt voor een promotie. Wat is hier het probleem?",
    opties: [
      "Er is geen probleem, mits de coach de handleiding volgt.",
      "Het instrument is niet gevalideerd voor selectiebeslissingen.",
      "De scores zijn te oud om nog te gebruiken.",
      "De coach moet eerst een tweede instrument afnemen.",
    ],
    sleutel: "B",
    toelichtingGoed:
      "Juist. Het Business Kompas is ontwikkeld voor ontwikkelingsgesprekken en " +
      "niet voor selectie; die toepassing valt buiten het validatiebereik.",
    toelichtingFout:
      "Het gaat hier niet om de ouderdom van de scores of om een tweede meting, " +
      "maar om het gebruiksdoel waarvoor het instrument is onderzocht.",
    gebruik: "meten",
  };
}

function veldenVan(bevindingen: { veld: string }[]): string[] {
  return bevindingen.map((b) => b.veld);
}

describe("De constructieregels op een item", () => {
  it("keurt een volledig item goed", () => {
    expect(valideerItem(geldigItem())).toEqual([]);
  });

  it("wijst het ontbrekende veld aan en niet alleen dat er iets mis is", () => {
    // Een formulier met twaalf velden moet per veld kunnen aanwijzen wat er
    // scheelt. Eén samengeplakte foutmelding kan dat niet.
    const bevindingen = valideerItem({ ...geldigItem(), stam: "", sleutel: "" });
    expect(veldenVan(bevindingen)).toContain("stam");
    expect(veldenVan(bevindingen)).toContain("sleutel");
  });

  it("weigert een blok op een andere as dan weten", () => {
    // De blokken A tot E zijn de indeling van de kennischeck, en de kennischeck
    // meet weten. Een blok-C-item op de as zorgen zou in de samenstelling
    // meetellen voor een verdeling waar het niet in thuishoort.
    const bevindingen = valideerItem({ ...geldigItem(), as: "zorgen" });
    expect(veldenVan(bevindingen)).toContain("blok");
  });

  it("laat een item zonder blok door op elke as", () => {
    for (const as of ["weten", "zien", "zeggen", "zorgen"]) {
      const bevindingen = valideerItem({ ...geldigItem(), as, blok: null });
      expect(veldenVan(bevindingen), as).not.toContain("blok");
      expect(veldenVan(bevindingen), as).not.toContain("as");
    }
  });

  it("weigert een blok buiten A tot E", () => {
    expect(veldenVan(valideerItem({ ...geldigItem(), blok: "F" }))).toContain("blok");
    expect(veldenVan(valideerItem({ ...geldigItem(), blok: "3" }))).toContain("blok");
  });

  it("weigert een stam die te kort is om een vraag te zijn", () => {
    const kort = "x".repeat(STAM_MINIMUM - 1);
    expect(veldenVan(valideerItem({ ...geldigItem(), stam: kort }))).toContain("stam");
    const netAan = "x".repeat(STAM_MINIMUM);
    expect(veldenVan(valideerItem({ ...geldigItem(), stam: netAan }))).not.toContain("stam");
  });

  it("weigert alle bovenstaande en geen van bovenstaande als mogelijkheid", () => {
    // Draaiboek §4.3 noemt dit letterlijk. Zo'n optie is geen inhoudelijke
    // afleider maar een toets op nauwkeurig lezen.
    for (const verboden of [
      "Alle bovenstaande.",
      "alle van de bovenstaande",
      "Geen van bovenstaande",
      "GEEN VAN DE BOVENSTAANDE!",
      "Alle antwoorden zijn juist.",
    ]) {
      const item = geldigItem();
      const opties = [...(item.opties as string[])];
      opties[3] = verboden;
      const bevindingen = valideerItem({ ...item, opties });
      expect(veldenVan(bevindingen), verboden).toContain("opties");
    }
  });

  it("weigert twee mogelijkheden die op leestekens na gelijk zijn", () => {
    const item = geldigItem();
    const opties = [...(item.opties as string[])];
    opties[3] = opties[1]!.toUpperCase() + "!!";
    const bevindingen = valideerItem({ ...item, opties });
    expect(veldenVan(bevindingen)).toContain("opties");
  });

  it("houdt het aantal mogelijkheden tussen de grenzen", () => {
    const item = geldigItem();
    const teWeinig = (item.opties as string[]).slice(0, OPTIES_MINIMUM - 1);
    expect(veldenVan(valideerItem({ ...item, opties: teWeinig }))).toContain("opties");

    const teVeel = Array.from(
      { length: OPTIES_MAXIMUM + 1 },
      (_, i) => `Een mogelijkheid met nummer ${i}.`,
    );
    expect(veldenVan(valideerItem({ ...item, opties: teVeel }))).toContain("opties");
  });

  it("weigert een sleutel die naar een niet-bestaande mogelijkheid wijst", () => {
    // Vier opties, sleutel E. Dit is de fout die een itemset onnakijkbaar maakt.
    const bevindingen = valideerItem({ ...geldigItem(), sleutel: "E" });
    expect(veldenVan(bevindingen)).toContain("sleutel");
  });

  it("weigert een sleutel die geen enkele letter is", () => {
    for (const sleutel of ["AB", "1", "b)", ""]) {
      const bevindingen = valideerItem({ ...geldigItem(), sleutel });
      expect(veldenVan(bevindingen), `sleutel ${sleutel}`).toContain("sleutel");
    }
  });

  it("aanvaardt een sleutel in kleine letters", () => {
    expect(valideerItem({ ...geldigItem(), sleutel: "b" })).toEqual([]);
  });

  it("eist juist of onjuist bij een juist-onjuistitem", () => {
    const basis: ItemInvoer = {
      ...geldigItem(),
      soort: "juistfout",
      opties: null,
      sleutel: "juist",
    };
    expect(valideerItem(basis)).toEqual([]);
    expect(valideerItem({ ...basis, sleutel: "Onjuist" })).toEqual([]);
    // Eén woord voor één ding: waar en true worden niet aanvaard, anders staan er
    // over een jaar drie schrijfwijzen in de bank.
    for (const fout of ["waar", "true", "ja", "A"]) {
      expect(veldenVan(valideerItem({ ...basis, sleutel: fout })), fout).toContain(
        "sleutel",
      );
    }
  });

  it("weigert eigen mogelijkheden bij een juist-onjuistitem", () => {
    const bevindingen = valideerItem({
      ...geldigItem(),
      soort: "juistfout",
      sleutel: "juist",
      opties: ["Juist", "Onjuist"],
    });
    expect(veldenVan(bevindingen)).toContain("opties");
  });

  it("eist bij een open item een scoringssleutel van enige inhoud", () => {
    const basis: ItemInvoer = {
      ...geldigItem(),
      soort: "open",
      opties: null,
      sleutel: "",
    };
    expect(veldenVan(valideerItem(basis))).toContain("sleutel");
    expect(veldenVan(valideerItem({ ...basis, sleutel: "goed" }))).toContain("sleutel");
    expect(
      valideerItem({
        ...basis,
        sleutel:
          "Het antwoord benoemt dat het instrument niet voor selectie is gevalideerd.",
      }),
    ).toEqual([]);
  });

  it("eist beide toelichtingen", () => {
    const kort = "x".repeat(TOELICHTING_MINIMUM - 1);
    expect(veldenVan(valideerItem({ ...geldigItem(), toelichtingGoed: "" }))).toContain(
      "toelichtingGoed",
    );
    expect(
      veldenVan(valideerItem({ ...geldigItem(), toelichtingFout: kort })),
    ).toContain("toelichtingFout");
  });

  it("weigert een onbekende soort of as in plaats van er iets van te maken", () => {
    expect(veldenVan(valideerItem({ ...geldigItem(), soort: "matrix" }))).toContain(
      "soort",
    );
    expect(veldenVan(valideerItem({ ...geldigItem(), as: "kunnen" }))).toContain("as");
  });

  it("weigert een item zonder instrument", () => {
    expect(veldenVan(valideerItem({ ...geldigItem(), instrumentId: "" }))).toContain(
      "instrumentId",
    );
  });

  it("gooit niet bij een leeg object", () => {
    // Een half ingevuld formulier moet een lijst bevindingen opleveren en geen
    // uitzondering; anders krijgt de gebruiker een 500 in plaats van uitleg.
    const bevindingen = valideerItem({});
    expect(bevindingen.length).toBeGreaterThan(0);
    expect(veldenVan(bevindingen)).toContain("stam");
  });
});

// ---------------------------------------------------------------------------
// De hulpstukken
// ---------------------------------------------------------------------------

describe("De sleutelletters", () => {
  it("zet letter en index op elkaar terug", () => {
    for (let i = 0; i < OPTIES_MAXIMUM; i += 1) {
      expect(letterNaarIndex(indexNaarLetter(i))).toBe(i);
    }
  });

  it("geeft null bij alles wat geen enkele letter is", () => {
    for (const ruw of ["", " ", "AB", "1", "Z", "b)", "é"]) {
      expect(letterNaarIndex(ruw), ruw).toBeNull();
    }
  });

  it("negeert witruimte en hoofdletters", () => {
    expect(letterNaarIndex(" c ")).toBe(2);
    expect(letterNaarIndex("C")).toBe(2);
  });
});

describe("Welke soorten een machine kan nakijken", () => {
  it("sluit open items uit", () => {
    // Bij een open item is de sleutel een scoringssleutel en geen vergelijkbaar
    // antwoord. Zou open hier wel in staan, dan zou een antwoord dat letterlijk
    // gelijk is aan de scoringsinstructie als juist gelden.
    expect(isAutomatischScoorbaar("open")).toBe(false);
    expect(isAutomatischScoorbaar("scenario")).toBe(true);
    expect(isAutomatischScoorbaar("meerkeuze")).toBe(true);
    expect(isAutomatischScoorbaar("juistfout")).toBe(true);
  });

  it("noemt een onbekende soort niet scoorbaar", () => {
    expect(isAutomatischScoorbaar("matrix")).toBe(false);
  });
});

describe("De blokdekking van een bank", () => {
  it("telt alleen actieve meetitems met een blok", () => {
    const dekking = blokdekking([
      { blok: "A", gebruik: "meten", actief: true },
      { blok: "A", gebruik: "meten" },
      { blok: "A", gebruik: "oefenen", actief: true },
      { blok: "A", gebruik: "verbrand", actief: true },
      { blok: "A", gebruik: "meten", actief: false },
      { blok: null, gebruik: "meten", actief: true },
      { blok: "F", gebruik: "meten", actief: true },
      { blok: "C", gebruik: "meten", actief: true },
    ]);
    expect(dekking).toEqual({ A: 2, B: 0, C: 1, D: 0, E: 0 });
  });

  it("geeft alle vijf de blokken terug, ook de lege", () => {
    // Een dekkingsoverzicht dat lege blokken weglaat, laat precies de gaten
    // onzichtbaar die het moet aanwijzen.
    expect(Object.keys(blokdekking([])).sort()).toEqual(["A", "B", "C", "D", "E"]);
  });
});

// ---------------------------------------------------------------------------
// De brontekst
// ---------------------------------------------------------------------------

describe("De brontekst van itembank.ts", () => {
  const bron = fs.readFileSync(
    path.join(process.cwd(), "server/bekwaamheid/itembank.ts"),
    "utf8",
  );

  /** Haalt commentaar weg, zodat een uitleg over een verbod niet als verbod leest. */
  function zonderCommentaar(tekst: string): string {
    return tekst
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((r) => !r.trim().startsWith("//"))
      .join("\n");
  }

  it("raakt geen databank en geen Express aan", () => {
    // Dezelfde eis als bij normprofiel.ts en beslisregels.ts: bij een bezwaar
    // tegen een uitslag moet de weg van item naar score reproduceerbaar zijn, en
    // dat kan alleen als er geen verborgen invoer is.
    const code = zonderCommentaar(bron);
    for (const verboden of [
      "better-sqlite3",
      "express",
      "drizzle",
      "./storage",
      "db.prepare",
      "fetch(",
    ]) {
      expect(code, `itembank.ts verwijst naar ${verboden}`).not.toContain(verboden);
    }
  });

  it("gebruikt geen datum of toeval", () => {
    // Een validatie die van de datum afhangt, keurt hetzelfde item vandaag goed
    // en morgen af. Toeval maakt een uitkomst onherhaalbaar.
    const code = zonderCommentaar(bron);
    for (const verboden of ["new Date", "Date.now", "Math.random"]) {
      expect(code, `itembank.ts gebruikt ${verboden}`).not.toContain(verboden);
    }
  });

  it("houdt de twee sleutelwoorden van juist en onjuist op één plaats", () => {
    // Zou dit paar op meerdere plaatsen staan, dan is een derde schrijfwijze een
    // kwestie van tijd.
    expect(JUISTFOUT_SLEUTELS).toEqual(["juist", "onjuist"]);
  });
});
