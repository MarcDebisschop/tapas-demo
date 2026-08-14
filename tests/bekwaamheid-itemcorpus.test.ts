// ---------------------------------------------------------------------------
// Controle op het itemcorpus voor de kennischeck bij het T4P Business Kompas.
//
// Deze test controleert niet of de itembank werkt - dat doet
// tests/bekwaamheid-itembank.test.ts. Hij controleert of de tachtig geschreven
// items bruikbaar zijn: of ze de validatie halen, of ze de blokken vullen, of ze
// twee volle rondes toelaten, en of ze niet samenvallen met de oefenstof.
//
// De reden voor de laatste controle staat in docs/ITEMBRON-T4P-KENNISCHECK.md:
// wie een vraag van de tussentijdse meting al heeft gezien, antwoordt goed
// zonder dat er iets gemeten is. De dertig vraagteksten worden daarom uit de
// brontekst van server/routes-stm.ts gelezen en niet in deze test gekopieerd.
// Een kopie zou verouderen zodra iemand de oefenbank uitbreidt, en dan zou de
// test groen blijven terwijl de overlap er wel is.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ITEMCORPUS_T4P,
  CORPUS_INSTRUMENT,
  corpusdekking,
} from "../server/bekwaamheid/itemcorpus-t4p.js";
import { valideerItem, indexNaarLetter } from "../server/bekwaamheid/itembank.js";
import {
  stelKennischeckSamen,
  type Bankitem,
} from "../server/bekwaamheid/kennischeck.js";
import {
  BLOKPLAN,
  BLOKPLAN_TOTAAL,
  BLOKPLAN_VERKORT,
  KENNISCHECKBLOKKEN,
} from "../server/bekwaamheid/schema.js";

const WORTEL = join(__dirname, "..");

/** Het corpus als bankitems, met een id dat de plaats in het corpus volgt. */
function alsBank(): Bankitem[] {
  return ITEMCORPUS_T4P.map((item, index) => ({
    id: index + 1,
    blok: item.blok ?? null,
    soort: item.soort ?? "",
    gebruik: item.gebruik ?? "",
    actief: true,
  }));
}

/** Kleine letters, zonder leestekens: voor het vergelijken van vraagteksten. */
function ontdaan(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aandeel gemeenschappelijke woorden, het kleinste van de twee als noemer. */
function woordoverlap(eerste: string, tweede: string): number {
  const a = ontdaan(eerste).split(" ").filter((w) => w.length > 3);
  const b = ontdaan(tweede).split(" ").filter((w) => w.length > 3);
  if (a.length === 0 || b.length === 0) return 0;
  const inB = new Set(b);
  let samen = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (inB.has(a[i])) samen += 1;
  }
  return samen / Math.min(a.length, b.length);
}

/** De dertig vraagteksten van de tussentijdse meting, uit de brontekst. */
function stmVraagteksten(): string[] {
  const bron = readFileSync(join(WORTEL, "server/routes-stm.ts"), "utf8");
  const begin = bron.indexOf("const VRAAGBANK");
  expect(begin, "VRAAGBANK niet gevonden in routes-stm.ts").toBeGreaterThan(-1);
  const einde = bron.indexOf("\n];", begin);
  expect(einde, "einde van VRAAGBANK niet gevonden").toBeGreaterThan(begin);
  const blok = bron.slice(begin, einde);
  const teksten: string[] = [];
  const patroon = /vraag_tekst:\s*"((?:[^"\\]|\\.)*)"/g;
  let treffer = patroon.exec(blok);
  while (treffer !== null) {
    teksten.push(treffer[1]);
    treffer = patroon.exec(blok);
  }
  return teksten;
}

describe("itemcorpus T4P - omvang en dekking", () => {
  it("bevat tachtig items", () => {
    expect(ITEMCORPUS_T4P.length).toBe(80);
  });

  it("hoort bij het T4P Business Kompas", () => {
    expect(CORPUS_INSTRUMENT).toBe("t4p-business-kompas");
    for (const item of ITEMCORPUS_T4P) {
      expect(item.instrumentId).toBe(CORPUS_INSTRUMENT);
    }
  });

  it("staat volledig op de as weten, want de kennischeck meet weten", () => {
    for (const item of ITEMCORPUS_T4P) {
      expect(item.as).toBe("weten");
    }
  });

  it("is volledig bedoeld om te meten en niet om te oefenen", () => {
    for (const item of ITEMCORPUS_T4P) {
      expect(item.gebruik).toBe("meten");
    }
  });

  it("vult elk blok met tweemaal het blokplan", () => {
    const dekking = corpusdekking();
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(dekking[blok], `blok ${blok}`).toBe(BLOKPLAN[blok] * 2);
    }
  });

  it("telt samen tweemaal het planaantal van een volle afname", () => {
    expect(ITEMCORPUS_T4P.length).toBe(BLOKPLAN_TOTAAL * 2);
  });

  it("verwijst per item naar een toegestane bron", () => {
    // Twee bronnen zijn toegestaan en niet meer. ITEMBRON is het brondossier met
    // de codefeiten; AVG is de wet zelf, die voor de algemene beginselen in blok
    // E de maatstaf is. Een item zonder verwijzing is bij een bezwaar niet te
    // verdedigen: dan valt niet na te gaan waarop het antwoord berust.
    for (const item of ITEMCORPUS_T4P) {
      expect(item.bronVerwijzing, item.stam ?? "").toMatch(/^(ITEMBRON |AVG)/);
    }
  });

  it("onderbouwt de blokken A tot D uitsluitend met het brondossier", () => {
    // Alleen blok E gaat over recht; de andere vier blokken beschrijven hoe dit
    // platform werkt. Een wetsverwijzing daar zou betekenen dat het item iets
    // toetst wat niet uit de code volgt.
    for (const item of ITEMCORPUS_T4P) {
      if (item.blok === "E") continue;
      expect(item.bronVerwijzing, `${item.blok}: ${item.stam}`).toMatch(/^ITEMBRON /);
    }
  });
});

describe("itemcorpus T4P - elk item haalt de validatie", () => {
  it("levert voor geen enkel item een bevinding op", () => {
    const gebreken: string[] = [];
    ITEMCORPUS_T4P.forEach((item, index) => {
      const bevindingen = valideerItem(item);
      if (bevindingen.length > 0) {
        const melding = bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | ");
        gebreken.push(`item ${index + 1} (${item.blok}): ${melding}`);
      }
    });
    expect(gebreken, gebreken.join("\n")).toEqual([]);
  });

  it("wijst bij keuze-items altijd naar een mogelijkheid die bestaat", () => {
    for (const item of ITEMCORPUS_T4P) {
      if (item.soort === "juistfout") {
        expect(item.opties).toBeNull();
        expect(["juist", "onjuist"]).toContain(item.sleutel);
        continue;
      }
      const opties = item.opties ?? [];
      expect(opties.length).toBeGreaterThanOrEqual(3);
      expect(opties.length).toBeLessThanOrEqual(6);
      const letters = opties.map((_, i) => indexNaarLetter(i));
      expect(letters, item.stam ?? "").toContain(item.sleutel);
    }
  });

  it("gebruikt binnen een item geen twee gelijke mogelijkheden", () => {
    for (const item of ITEMCORPUS_T4P) {
      const opties = item.opties ?? [];
      if (opties.length === 0) continue;
      expect(new Set(opties).size, item.stam ?? "").toBe(opties.length);
    }
  });
});

describe("itemcorpus T4P - vorm van de vragen", () => {
  it("gebruikt geen verzamelmogelijkheid als antwoord", () => {
    const patroon =
      /alle (van )?(de )?(bovenstaande|voorgaande|hierboven)|geen van (de )?(bovenstaande|voorgaande)/i;
    for (const item of ITEMCORPUS_T4P) {
      for (const optie of item.opties ?? []) {
        expect(patroon.test(optie), `${item.stam} -> ${optie}`).toBe(false);
      }
    }
  });

  it("stelt geen vraag met twee ontkenningen in de stam", () => {
    for (const item of ITEMCORPUS_T4P) {
      const treffers = (item.stam ?? "").match(/\b(niet|nooit|geen|zonder)\b/gi) ?? [];
      expect(treffers.length, item.stam ?? "").toBeLessThan(2);
    }
  });

  it("legt bij elk item zowel het juiste als het foute spoor uit", () => {
    for (const item of ITEMCORPUS_T4P) {
      expect((item.toelichtingGoed ?? "").trim().length).toBeGreaterThanOrEqual(40);
      expect((item.toelichtingFout ?? "").trim().length).toBeGreaterThanOrEqual(40);
      expect(item.toelichtingGoed).not.toBe(item.toelichtingFout);
    }
  });

  it("stelt niet tweemaal dezelfde vraag", () => {
    const paren: string[] = [];
    for (let i = 0; i < ITEMCORPUS_T4P.length; i += 1) {
      for (let j = i + 1; j < ITEMCORPUS_T4P.length; j += 1) {
        const deel = woordoverlap(
          ITEMCORPUS_T4P[i].stam ?? "",
          ITEMCORPUS_T4P[j].stam ?? "",
        );
        if (deel >= 0.75) {
          paren.push(`${i + 1} en ${j + 1}: ${Math.round(deel * 100)}% gelijk`);
        }
      }
    }
    expect(paren, paren.join("\n")).toEqual([]);
  });

  it("laat de sleutel niet op één plaats samenklonteren", () => {
    const telling = new Map<string, number>();
    let keuzeitems = 0;
    for (const item of ITEMCORPUS_T4P) {
      if (item.soort === "juistfout") continue;
      keuzeitems += 1;
      const sleutel = item.sleutel ?? "";
      telling.set(sleutel, (telling.get(sleutel) ?? 0) + 1);
    }
    // Bij vier mogelijkheden is een gelijke verdeling een kwart. Boven de helft
    // wordt de plaats van het juiste antwoord zelf een aanwijzing.
    const grens = keuzeitems * 0.5;
    const letters = Array.from(telling.keys());
    for (let i = 0; i < letters.length; i += 1) {
      const aantal = telling.get(letters[i]) ?? 0;
      expect(aantal, `sleutel ${letters[i]} komt ${aantal} keer voor`).toBeLessThan(grens);
    }
  });

  it("laat juist en onjuist beide voorkomen", () => {
    const sleutels = ITEMCORPUS_T4P.filter((i) => i.soort === "juistfout").map(
      (i) => i.sleutel,
    );
    expect(sleutels.length).toBeGreaterThan(0);
    expect(sleutels).toContain("juist");
    expect(sleutels).toContain("onjuist");
  });
});

describe("itemcorpus T4P - geen overlap met de oefenstof", () => {
  it("leest dertig vraagteksten uit de tussentijdse meting", () => {
    expect(stmVraagteksten().length).toBe(30);
  });

  it("neemt geen vraag over uit de tussentijdse meting", () => {
    const oefenstof = stmVraagteksten();
    const treffers: string[] = [];
    ITEMCORPUS_T4P.forEach((item, index) => {
      for (const oefenvraag of oefenstof) {
        const deel = woordoverlap(item.stam ?? "", oefenvraag);
        if (deel >= 0.7) {
          treffers.push(
            `item ${index + 1} lijkt ${Math.round(deel * 100)}% op de oefenvraag: ${oefenvraag}`,
          );
        }
      }
    });
    expect(treffers, treffers.join("\n")).toEqual([]);
  });
});

describe("itemcorpus T4P - de kennischeck is samen te stellen", () => {
  it("levert een volle afname van veertig items", () => {
    const uitkomst = stelKennischeckSamen({ bank: alsBank(), zaad: 7 });
    expect(uitkomst.gelukt).toBe(true);
    expect(uitkomst.itemIds.length).toBe(BLOKPLAN_TOTAAL);
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(uitkomst.perBlok[blok].length, `blok ${blok}`).toBe(BLOKPLAN[blok]);
    }
  });

  it("levert ook de verkorte afname", () => {
    const uitkomst = stelKennischeckSamen({
      bank: alsBank(),
      plan: BLOKPLAN_VERKORT,
      zaad: 7,
    });
    expect(uitkomst.gelukt).toBe(true);
    for (const blok of KENNISCHECKBLOKKEN) {
      expect(uitkomst.perBlok[blok].length, `blok ${blok}`).toBe(BLOKPLAN_VERKORT[blok]);
    }
  });

  it("laat een herkansing toe zonder één item te hergebruiken", () => {
    const bank = alsBank();
    const eerste = stelKennischeckSamen({ bank, zaad: 3 });
    expect(eerste.gelukt).toBe(true);

    const tweede = stelKennischeckSamen({
      bank,
      uitsluiten: eerste.itemIds,
      zaad: 4,
    });
    expect(tweede.gelukt, "de tweede ronde moet volledig te vullen zijn").toBe(true);
    expect(tweede.itemIds.length).toBe(BLOKPLAN_TOTAAL);

    const overlap = tweede.itemIds.filter((id) => eerste.itemIds.includes(id));
    expect(overlap, "geen enkel item mag terugkomen").toEqual([]);
  });

  it("meldt een tekort met de bloknaam wanneer een derde ronde gevraagd wordt", () => {
    const bank = alsBank();
    const eerste = stelKennischeckSamen({ bank, zaad: 3 });
    const tweede = stelKennischeckSamen({ bank, uitsluiten: eerste.itemIds, zaad: 4 });
    const gezien = [...eerste.itemIds, ...tweede.itemIds];

    const derde = stelKennischeckSamen({ bank, uitsluiten: gezien, zaad: 5 });
    expect(derde.gelukt, "een derde ronde kan dit corpus niet dragen").toBe(false);
    expect(derde.tekorten.length).toBeGreaterThan(0);
    for (const tekort of derde.tekorten) {
      expect(KENNISCHECKBLOKKEN).toContain(tekort.blok);
      expect(tekort.beschikbaar).toBeLessThan(tekort.gevraagd);
    }
    // Het faalt luid en niet stil: geen halve set.
    expect(derde.itemIds).toEqual([]);
  });

  it("geeft bij hetzelfde zaad dezelfde afname", () => {
    const bank = alsBank();
    const een = stelKennischeckSamen({ bank, zaad: 11 });
    const twee = stelKennischeckSamen({ bank, zaad: 11 });
    expect(een.itemIds).toEqual(twee.itemIds);
  });

  it("geeft bij een ander zaad een andere afname", () => {
    const bank = alsBank();
    const een = stelKennischeckSamen({ bank, zaad: 11 });
    const twee = stelKennischeckSamen({ bank, zaad: 12 });
    expect(een.itemIds).not.toEqual(twee.itemIds);
  });
});

describe("itemcorpus T4P - de laag blijft zuiver", () => {
  it("haalt geen opslag, netwerk, tijd of toeval binnen", () => {
    const bron = readFileSync(
      join(WORTEL, "server/bekwaamheid/itemcorpus-t4p.ts"),
      "utf8",
    );
    // Eerst het commentaar weg: daarin mogen de woorden wel staan.
    const code = bron
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((regel) => !regel.trim().startsWith("//"))
      .join("\n");
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
      expect(code.includes(verboden), `verboden in deze laag: ${verboden}`).toBe(false);
    }
  });

  it("is een gegenereerd bestand en zegt dat ook", () => {
    const bron = readFileSync(
      join(WORTEL, "server/bekwaamheid/itemcorpus-t4p.ts"),
      "utf8",
    );
    expect(bron).toContain("GEGENEREERD");
    expect(bron).toContain("genereer-corpus-ts.py");
  });
});
