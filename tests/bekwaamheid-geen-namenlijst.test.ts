import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Een wacht, geen gedragstest.
 *
 * Feit: `server/routes-stm.ts` bevatte een constante `EXTRA_PRACTITIONERS` met
 * eenentwintig namen. Negentien van de daarbij horende e-mailadressen bestonden
 * niet: ze eindigden op `@tapas-demo.be` of `@tapas-demo.nl`. Alle eenentwintig
 * namen stonden op dat moment al in `coach_register`.
 *
 * De namen zijn naar de databank verhuisd. Deze test bestaat om die verhuizing
 * te bewaken: een namenlijst in broncode is makkelijk opnieuw toegevoegd tijdens
 * het opsporen van een fout, en dan staan er weer echte namen van mensen in een
 * publieke repository met adressen waar niemand een bericht ontvangt.
 */

/**
 * Zelf doorlopen in plaats van een zoekpatroon: `node:fs` heeft in Node 20 geen
 * `globSync`, en hetzelfde patroon staat al in `tests/db-encryptie.test.ts`.
 */
function verzamel(map: string, achtervoegsels: string[]): string[] {
  const bestanden: string[] = [];
  const loop = (huidig: string) => {
    for (const item of readdirSync(huidig, { withFileTypes: true })) {
      const pad = join(huidig, item.name).split("\\").join("/");
      if (item.isDirectory()) {
        if (item.name !== "node_modules") loop(pad);
      } else if (achtervoegsels.some((a) => item.name.endsWith(a))) {
        bestanden.push(pad);
      }
    }
  };
  loop(map);
  return bestanden;
}

const SERVERBESTANDEN = verzamel("server", [".ts"]);
const CLIENTBESTANDEN = verzamel("client/src", [".ts", ".tsx"]);

function lees(pad: string): string {
  return readFileSync(pad, "utf8");
}

/**
 * Commentaarregels weglaten: een toelichting die het patroon beschrijft is geen
 * adres.
 *
 * Per regel, en niet met een blokcommentaarpatroon over het hele bestand: zo'n
 * patroon stopt bij de eerste `*\/` die in een gewone string staat en kan dan
 * hele stukken echte code wegnemen, waardoor deze wacht stil te ruim wordt.
 */
function zonderCommentaar(bron: string): string {
  return bron
    .split("\n")
    .filter((regel) => {
      const kaal = regel.trim();
      return !kaal.startsWith("//") && !kaal.startsWith("*") && !kaal.startsWith("/*");
    })
    .join("\n");
}

/**
 * De demo-seeds die deze adressen op dit moment nog bevatten, geteld op
 * 13 augustus 2026.
 *
 * Deze lijst is geen goedkeuring. Het zijn bestaande demo-registraties met
 * `demo: 1`, buiten de module Bekwaamheid, en ze staan op de lijst om nagekeken
 * te worden — verzonnen adressen van niet-bestaande mensen in een publieke
 * repository zijn een tekort, ook als er nooit een bericht naartoe gaat. Ze zijn
 * hier vastgelegd zodat de wacht zichtbaar maakt wat er nog staat, in plaats van
 * dat het aantal ongemerkt kan groeien.
 */
const BEKENDE_DEMO_SEEDS = [
  "server/coach-register.ts",
  "server/routes-coaches-academy-mail.ts",
] as const;

describe("de namenlijst komt niet terug in de broncode", () => {
  it("vindt serverbestanden om te doorzoeken", () => {
    // Zonder deze controle zou de test groen blijven wanneer het zoekpatroon
    // ooit stilletjes nul bestanden oplevert.
    expect(SERVERBESTANDEN.length).toBeGreaterThan(20);
    expect(CLIENTBESTANDEN.length).toBeGreaterThan(20);
  });

  it("kent geen constante EXTRA_PRACTITIONERS meer, nergens", () => {
    const treffers = [...SERVERBESTANDEN, ...CLIENTBESTANDEN].filter((pad) =>
      lees(pad).includes(["EXTRA", "PRACTITIONERS"].join("_")),
    );
    expect(treffers).toEqual([]);
  });

  it("bevat buiten de twee bekende demo-seeds geen verzonnen adressen", () => {
    const patroon = /@tapas-demo\.[a-z]{2,}/i;
    const treffers = [...SERVERBESTANDEN, ...CLIENTBESTANDEN].filter((pad) =>
      patroon.test(zonderCommentaar(lees(pad))),
    );
    // Precies gelijk, niet "ten hoogste": zo faalt deze test ook wanneer een van
    // de twee wordt opgeruimd, en dan hoort de lijst hier mee bijgewerkt te
    // worden in plaats van dat de wacht stil te ruim blijft staan.
    expect([...treffers].sort()).toEqual([...BEKENDE_DEMO_SEEDS].sort());
  });

  it("houdt de module Bekwaamheid zelf volledig vrij van adressen", () => {
    const adres = /["'`][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}["'`]/;
    const inModule = SERVERBESTANDEN.filter((pad) => pad.startsWith("server/bekwaamheid/"));
    expect(inModule.length).toBeGreaterThan(3);
    const treffers = inModule.filter((pad) => adres.test(zonderCommentaar(lees(pad))));
    expect(treffers).toEqual([]);
  });

  it("houdt het migratiescript vrij van adressen", () => {
    // Het script leest de namen en adressen uit `beheerders` en `coach_register`.
    // Zou het zelf adressen bevatten, dan was de verhuizing naar de databank
    // alleen een verplaatsing van hetzelfde probleem.
    const adres = /["'`][A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}["'`]/;
    expect(adres.test(zonderCommentaar(lees("script/migreer-bekwaamheid.mjs")))).toBe(false);
  });
});

describe("de vervanger leest uit de databank", () => {
  it("haalt de practitioners zonder account uit het coachregister", () => {
    const bron = lees("server/routes-stm.ts");
    expect(bron).toContain("practitionersZonderAccount");
    expect(bron).toContain("coach_register");
  });

  it("verzint geen adres wanneer er geen is, maar weigert leesbaar", () => {
    // Wie geen adres heeft, wordt niet aangeschreven. Dat is een zichtbaar
    // tekort in het register, geen stille aanname.
    const bron = lees("server/routes-stm.ts");
    expect(bron).toMatch(/409/);
  });
});
