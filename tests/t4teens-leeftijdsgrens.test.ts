import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  T4TEENS_DOELGROEP,
  T4TEENS_BAND_JONGER,
  T4TEENS_BAND_OUDER,
  T4TEENS_LEEFTIJDSBEREIK,
  T4TEENS_LEEFTIJDSTEKST,
  T4TEENS_LEEFTIJDSTEKST_VOLUIT,
} from "../shared/doelgroep-leeftijd";
import { toegestaneBandenVoor } from "../shared/leeftijd";
import { t } from "../shared/i18n";

// ---------------------------------------------------------------------------
// Ronde C, punt 4. Voor een en hetzelfde instrument stonden vijf verschillende
// leeftijdsgrenzen naast elkaar: 16 tot 21 in de vragenlijst en het rapport,
// 14 tot 18 in de catalogus en de gids op de server, 13 tot 17 in de gids in de
// client en in het register, en de banden 13-15 en 16-17 in de leeftijdspoort.
// Een jongere van twintig kon de vragenlijst dus aangeboden krijgen en daarna
// bij de poort geweigerd worden.
//
// De grens staat nu in shared/doelgroep-leeftijd.ts en nergens anders. Deze
// test houdt dat zo: de banden komen aantoonbaar uit die bron, en geen enkel
// bronbestand noemt nog een van de oude grenzen.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");

function bronbestanden(): string[] {
  const gevonden: string[] = [];
  const overslaan = new Set(["node_modules", ".git", "dist", "tests", "public"]);
  (function loop(map: string) {
    for (const naam of readdirSync(map)) {
      if (overslaan.has(naam)) continue;
      const pad = path.join(map, naam);
      if (statSync(pad).isDirectory()) loop(pad);
      else if (/\.(ts|tsx)$/.test(naam)) gevonden.push(pad);
    }
  })(wortel);
  return gevonden;
}

describe("T4Teens: de doelgroepgrens komt uit een enkele bron", () => {
  it("de gekozen grens is 13 tot en met 17 jaar", () => {
    // Dit is een keuze, geen meting: het is de grens die de leeftijdspoort bij
    // een afname werkelijk afdwingt. Zie de verantwoording in
    // shared/doelgroep-leeftijd.ts.
    expect(T4TEENS_DOELGROEP.minLeeftijd).toBe(13);
    expect(T4TEENS_DOELGROEP.maxLeeftijd).toBe(17);
    expect(T4TEENS_LEEFTIJDSBEREIK).toBe("13-17");
    expect(T4TEENS_LEEFTIJDSTEKST).toBe("13-17 jaar");
    expect(T4TEENS_LEEFTIJDSTEKST_VOLUIT).toBe("13 tot en met 17 jaar");
  });

  it("de twee leeftijdsbanden zijn afgeleid en niet apart opgeschreven", () => {
    expect(T4TEENS_BAND_JONGER).toBe("13-15");
    expect(T4TEENS_BAND_OUDER).toBe("16-17");
    // De poort laat exact die twee banden toe, en haalt ze uit dezelfde bron.
    expect(toegestaneBandenVoor("t4teens")).toEqual([T4TEENS_BAND_JONGER, T4TEENS_BAND_OUDER]);
  });

  it("de band loopt van de ondergrens tot aan de bovengrens, zonder gat", () => {
    const [jongerVan, jongerTot] = T4TEENS_BAND_JONGER.split("-").map(Number);
    const [ouderVan, ouderTot] = T4TEENS_BAND_OUDER.split("-").map(Number);
    expect(jongerVan).toBe(T4TEENS_DOELGROEP.minLeeftijd);
    expect(ouderVan).toBe(jongerTot + 1);
    expect(ouderTot).toBe(T4TEENS_DOELGROEP.maxLeeftijd);
  });

  it("de labels van de banden noemen dezelfde getallen als de bron", () => {
    // De labels staan met de hand geschreven in vijf talen en worden niet
    // samengesteld uit de getallen. Deze test bewaakt dat ze niet uit de pas
    // lopen met de bron.
    expect(t("leeftijd_band_13_15", "nl")).toContain(String(T4TEENS_DOELGROEP.minLeeftijd));
    expect(t("leeftijd_band_16_17", "nl")).toContain(String(T4TEENS_DOELGROEP.maxLeeftijd));
    expect(t("leeftijd_band_16_17", "nl")).toContain(String(T4TEENS_DOELGROEP.zelfstandigVanaf));
  });

  it("de teksten naar de gebruiker noemen de gekozen grens", async () => {
    const { getDescriptor } = await import("../server/registry");
    const { INSTRUMENTENGIDS } = await import("../server/gids/data");
    const { TEMPLATES } = await import("../server/bulk-import/templates");

    expect(getDescriptor("t4teens")!.description).toContain(T4TEENS_LEEFTIJDSTEKST);

    const gids = INSTRUMENTENGIDS.find((i: { id: string }) => i.id === "t4teens")!;
    expect(gids.doelgroep).toContain(T4TEENS_LEEFTIJDSTEKST);
    expect(gids.leeftijdsfocus).toContain(T4TEENS_LEEFTIJDSTEKST);

    expect(TEMPLATES.t4teens.titel).toContain(T4TEENS_LEEFTIJDSTEKST);
  });

  it("geen enkel bronbestand noemt nog een van de oude grenzen", () => {
    // 16 tot 21 stond in de vragenlijst en het rapport, 14 tot 18 in de
    // catalogus en de gids op de server. Het lange streepje staat hier omdat de
    // oude tekst het gebruikte; zonder dat teken vindt deze test de oude grens
    // in de gids niet terug.
    const oud = /16\s*(?:-|tot)\s*21|14\s*[-–]\s*18/;
    const treffers = bronbestanden()
      .map((pad) => path.relative(wortel, pad))
      // De bron zelf mag de oude grenzen noemen: daar staat opgeschreven wat
      // er vroeger stond en waarom er nu een grens gekozen is.
      .filter((pad) => pad !== path.join("shared", "doelgroep-leeftijd.ts"))
      .filter((pad) => oud.test(readFileSync(path.join(wortel, pad), "utf-8")));
    expect(treffers, `oude leeftijdsgrens gevonden in:\n${treffers.join("\n")}`).toEqual([]);
  });
});
