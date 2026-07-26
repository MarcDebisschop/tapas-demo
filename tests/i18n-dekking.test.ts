// ---------------------------------------------------------------------------
// tests/i18n-dekking.test.ts - de vertaaltabel sluitend houden.
//
// Achtergrond: `iz_drempel_stand` en `iz_drempel_beschikbaar_vanaf` werden in
// admin-inzichten.tsx opgevraagd maar bestonden niet in `shared/i18n.ts`. De
// gebruiker zag daardoor de kale sleutelnaam op het scherm.
//
// Waarom de compiler dat niet ving: `t()` is wel getypeerd op `StringSleutel`,
// maar dat scherm krijgt zijn vertaalfunctie als PROP binnen, getypeerd als
// `(s: string) => string`. Daarmee valt de sleutelcontrole weg. En omdat `t()`
// bewust defensief is (een onbekende sleutel geeft de sleutelnaam terug in
// plaats van te crashen) faalt er ook niets luidruchtig. Precies de combinatie
// waar een test voor nodig is.
//
// Drie faalwijzen worden hier vastgelegd:
//   1. Een sleutel die de code gebruikt maar de tabel niet kent.
//   2. Een taal die een sleutel mist die een andere taal wel heeft.
//   3. Een vertaling die een accolade-plaatshouder laat vallen. Dan verdwijnt
//      er stil een getal uit de tekst; erger dan een zichtbare fout.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STRINGS, TALEN, t, STANDAARD_TAAL } from "@shared/i18n";

const TABEL = STRINGS as unknown as Record<string, Record<string, string>>;
const SLEUTELS = Object.keys(TABEL);

/** Alle .ts/.tsx-bestanden onder de opgegeven mappen. */
function bronbestanden(mappen: string[]): string[] {
  const uit: string[] = [];
  const loop = (map: string) => {
    for (const item of readdirSync(map, { withFileTypes: true })) {
      const pad = join(map, item.name);
      if (item.isDirectory()) {
        if (item.name !== "node_modules") loop(pad);
      } else if (/\.tsx?$/.test(item.name)) {
        uit.push(pad);
      }
    }
  };
  mappen.forEach(loop);
  return uit;
}

function plaatshouders(tekst: string): string[] {
  return [...tekst.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("i18n: elke gebruikte sleutel bestaat", () => {
  it("kent elke sleutel die de code via t(\"...\") opvraagt", () => {
    // Enkel letterlijke aanroepen; een sleutel die uit een variabele komt is
    // hier niet te zien en wordt dus niet gecontroleerd.
    const gebruikt = new Map<string, Set<string>>();
    for (const pad of bronbestanden(["client", "server", "shared"])) {
      const bron = readFileSync(pad, "utf8");
      for (const m of bron.matchAll(/\bt\(\s*"([a-z_][a-z0-9_]*)"/gi)) {
        if (!gebruikt.has(m[1])) gebruikt.set(m[1], new Set());
        gebruikt.get(m[1])!.add(pad);
      }
    }
    // Vangnet onder het vangnet: vindt de scan niets, dan is de regex stuk en
    // zou de test altijd slagen zonder iets te controleren.
    expect(gebruikt.size).toBeGreaterThan(100);

    const ontbreekt = [...gebruikt.entries()]
      .filter(([sleutel]) => !(sleutel in TABEL))
      .map(([sleutel, waar]) => `${sleutel} (gebruikt in ${[...waar].join(", ")})`);
    expect(ontbreekt, `ontbrekende i18n-sleutels:\n${ontbreekt.join("\n")}`).toEqual([]);
  });

  it("kent de twee sleutels van de drempelkaart", () => {
    // De concrete regressie die deze suite aanleiding gaf.
    for (const sleutel of ["iz_drempel_stand", "iz_drempel_beschikbaar_vanaf"]) {
      expect(TABEL[sleutel], sleutel).toBeDefined();
      // `t()` valt bij een onbekende sleutel terug op de sleutelnaam. Krijgen we
      // de naam terug, dan bestaat de vertaling niet echt.
      expect(t(sleutel as never, STANDAARD_TAAL)).not.toBe(sleutel);
    }
  });
});

describe("i18n: dezelfde sleutelset in elke taal", () => {
  it("heeft voor elke sleutel alle talen gevuld", () => {
    const gaten: string[] = [];
    for (const sleutel of SLEUTELS) {
      for (const taal of TALEN) {
        const waarde = TABEL[sleutel][taal];
        if (typeof waarde !== "string" || waarde.trim() === "") {
          gaten.push(`${sleutel}.${taal}`);
        }
      }
    }
    expect(gaten, `lege of ontbrekende vertalingen:\n${gaten.join("\n")}`).toEqual([]);
  });

  it("heeft geen taal met een sleutel die een andere taal mist", () => {
    // Andersom geformuleerd dan hierboven: per taal de sleutelset vergelijken.
    // Zo staat de eis ook expliciet in de suite, los van de vulling.
    const perTaal = new Map<string, Set<string>>();
    for (const taal of TALEN) {
      perTaal.set(
        taal,
        new Set(SLEUTELS.filter((s) => typeof TABEL[s][taal] === "string")),
      );
    }
    const referentie = perTaal.get(STANDAARD_TAAL)!;
    for (const taal of TALEN) {
      const set = perTaal.get(taal)!;
      const mist = [...referentie].filter((s) => !set.has(s));
      const extra = [...set].filter((s) => !referentie.has(s));
      expect(mist, `${taal} mist: ${mist.join(", ")}`).toEqual([]);
      expect(extra, `${taal} heeft extra: ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("telt evenveel sleutels als de tabel groot is", () => {
    expect(SLEUTELS.length).toBeGreaterThan(1200);
  });
});

describe("i18n: plaatshouders blijven overeind in elke taal", () => {
  it("gebruikt in elke taal dezelfde accolade-plaatshouders als het Nederlands", () => {
    // Valt {benodigd} weg in een vertaling, dan verdwijnt er stil een getal uit
    // de tekst. Dat is erger dan een zichtbare fout, want niemand merkt het.
    const afwijkingen: string[] = [];
    for (const sleutel of SLEUTELS) {
      const basis = plaatshouders(TABEL[sleutel][STANDAARD_TAAL] ?? "").join(",");
      for (const taal of TALEN) {
        if (taal === STANDAARD_TAAL) continue;
        const hier = plaatshouders(TABEL[sleutel][taal] ?? "").join(",");
        if (hier !== basis) {
          afwijkingen.push(`${sleutel}: ${STANDAARD_TAAL}[${basis}] tegenover ${taal}[${hier}]`);
        }
      }
    }
    expect(afwijkingen, `plaatshouders lopen uiteen:\n${afwijkingen.join("\n")}`).toEqual([]);
  });

  it("houdt de plaatshouders van de drempelkaart in alle talen", () => {
    // De client vult deze met een letterlijke replace(). Ontbreekt de
    // plaatshouder, dan blijft het getal weg zonder foutmelding.
    for (const taal of TALEN) {
      expect(TABEL.iz_drempel_stand[taal], `stand ${taal}`).toContain("{huidig}");
      expect(TABEL.iz_drempel_stand[taal], `stand ${taal}`).toContain("{benodigd}");
      expect(TABEL.iz_drempel_beschikbaar_vanaf[taal], `vanaf ${taal}`).toContain("{benodigd}");
    }
  });
});
