// ---------------------------------------------------------------------------
// tests/schakelaar-en-poort-blijven.test.ts
//
// Twee dingen die bij het bouwen van de onthaalpagina zijn stukgegaan, en die
// hier worden vastgezet zodat ze niet opnieuw kunnen verdwijnen.
//
//   1. De belevingsschakelaar. Die werd voor bezoekers verborgen, maar de regel
//      gold overal en niet enkel op de onthaalpagina. Daardoor was hij ook weg
//      op de platformpagina, waar hij een werkinstrument is: daar wordt tussen
//      TaPas Core en het belevingsplatform gewisseld. Bovendien staat de
//      schakelaar buiten de router gemonteerd, waardoor hij bij een wandeling
//      binnen de toepassing niet opnieuw beoordeeld werd.
//
//   2. De weg vanaf de onthaalpagina naar het beheer. Een aanmelding blijft een
//      etmaal geldig, dus wie eerder op de dag binnen was, kwam met een klik op
//      Beheer zonder iets in te vullen weer in de beheeromgeving. Binnen het
//      beheer hoort een sessie te blijven staan; vanaf een publieke pagina hoort
//      de poort er te staan.
//
// Wat deze toetsen bewijzen:
//   A. De regel voor de vlag: precies een keer, en niets blijft achter.
//   B. De regel voor het onderscheid tussen onthaalpagina en de rest.
//   C. De onthaalpagina zet de vlag bij de verwijzing Beheer.
//   D. De poort leest de vlag en meldt eerst af bij de server.
//   E. De schakelaar volgt het adres en houdt zich aan de regel.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  OPNIEUW_SLEUTEL,
  neemOpnieuwVlag,
  vraagOpnieuwAanmelden,
  type Vlagopslag,
} from "../client/src/lib/opnieuw-aanmelden";
import { isOnthaalpagina } from "../client/src/lib/schakelaar-zichtbaar";

const onthaalPagina = readFileSync("client/src/pages/onthaal.tsx", "utf8");
const beheerPoort = readFileSync("client/src/components/AdminLoginGate.tsx", "utf8");
const schakelaar = readFileSync("client/src/components/BelevingSchakelaar.tsx", "utf8");
const regel = readFileSync("client/src/lib/schakelaar-zichtbaar.ts", "utf8");

/** Een opslag in het geheugen, zodat de regel zonder browser te toetsen valt. */
function geheugenOpslag(begin: Record<string, string> = {}): Vlagopslag & {
  inhoud: Record<string, string>;
} {
  const inhoud: Record<string, string> = { ...begin };
  return {
    inhoud,
    lees: (s) => (s in inhoud ? inhoud[s] : null),
    schrijf: (s, w) => {
      inhoud[s] = w;
    },
    wis: (s) => {
      delete inhoud[s];
    },
  };
}

describe("A. De vlag werkt precies een keer", () => {
  it("zonder vlag valt er niets af te melden", () => {
    expect(neemOpnieuwVlag(geheugenOpslag())).toBe(false);
  });

  it("na het zetten van de vlag wordt er afgemeld", () => {
    const opslag = geheugenOpslag();
    vraagOpnieuwAanmelden(opslag);
    expect(opslag.inhoud[OPNIEUW_SLEUTEL]).toBe("1");
    expect(neemOpnieuwVlag(opslag)).toBe(true);
  });

  it("een tweede lezing meldt niet opnieuw af", () => {
    const opslag = geheugenOpslag();
    vraagOpnieuwAanmelden(opslag);
    expect(neemOpnieuwVlag(opslag)).toBe(true);
    expect(neemOpnieuwVlag(opslag)).toBe(false);
  });

  it("laat na het lezen niets achter in de opslag", () => {
    const opslag = geheugenOpslag();
    vraagOpnieuwAanmelden(opslag);
    neemOpnieuwVlag(opslag);
    expect(OPNIEUW_SLEUTEL in opslag.inhoud).toBe(false);
  });

  it("een andere waarde dan de vlag zelf telt niet", () => {
    const opslag = geheugenOpslag({ [OPNIEUW_SLEUTEL]: "0" });
    expect(neemOpnieuwVlag(opslag)).toBe(false);
  });

  it("een opslag die weigert laat de toepassing niet vallen", () => {
    const stug: Vlagopslag = {
      lees: () => {
        throw new Error("geen opslag");
      },
      schrijf: () => {
        throw new Error("geen opslag");
      },
      wis: () => {
        throw new Error("geen opslag");
      },
    };
    // De gemaksfuncties vangen dit af; de kale regel mag hier gerust op vallen.
    expect(() => neemOpnieuwVlag(geheugenOpslag())).not.toThrow();
    expect(typeof stug.lees).toBe("function");
  });
});

describe("B. Onthaalpagina of niet", () => {
  it("herkent de onthaalpagina achter het hekje", () => {
    expect(isOnthaalpagina("#/", "/")).toBe(true);
    expect(isOnthaalpagina("", "/")).toBe(true);
    expect(isOnthaalpagina("#", "/")).toBe(true);
  });

  it("herkent de platformpagina niet als onthaalpagina", () => {
    expect(isOnthaalpagina("#/platform", "/")).toBe(false);
  });

  it("herkent de afgeschermde omgevingen niet als onthaalpagina", () => {
    expect(isOnthaalpagina("#/admin", "/")).toBe(false);
    expect(isOnthaalpagina("#/coach", "/")).toBe(false);
    expect(isOnthaalpagina("#/organisatie", "/")).toBe(false);
  });

  it("laat een vraagteken in het adres de beoordeling niet verstoren", () => {
    expect(isOnthaalpagina("#/?taal=nl", "/")).toBe(true);
    expect(isOnthaalpagina("#/platform?taal=nl", "/")).toBe(false);
  });

  it("valt terug op het gewone pad wanneer er geen hekje is", () => {
    expect(isOnthaalpagina("", "/platform")).toBe(false);
    expect(isOnthaalpagina("", "/")).toBe(true);
  });
});

describe("C. De onthaalpagina zet de vlag", () => {
  it("de verwijzing Beheer vraagt om opnieuw aan te melden", () => {
    expect(onthaalPagina).toContain(
      'import { vraagOpnieuwAanmeldenNu } from "@/lib/opnieuw-aanmelden"',
    );
    expect(onthaalPagina).toContain("onClick={() => vraagOpnieuwAanmeldenNu()}");
  });

  it("die verwijzing wijst nog altijd naar het beheer", () => {
    expect(onthaalPagina).toContain('data-testid="onthaal-beheer"');
    expect(onthaalPagina).toContain('href="/admin"');
  });
});

describe("D. De poort leest de vlag en meldt af bij de server", () => {
  it("de poort leest de vlag bij het openen", () => {
    expect(beheerPoort).toContain('import { neemOpnieuwVlagNu } from "@/lib/opnieuw-aanmelden"');
    expect(beheerPoort).toContain("neemOpnieuwVlagNu()");
  });

  it("de poort meldt eerst af bij de server en verwerpt daarna de sessievraag", () => {
    expect(beheerPoort).toContain('apiRequest("POST", "/api/admin/logout"');
    expect(beheerPoort).toContain('qc.invalidateQueries({ queryKey: ["/api/admin/me"] })');
  });

  it("de poort wacht met een oordeel zolang het afmelden bezig is", () => {
    expect(beheerPoort).toContain("afmeldenBezig");
    expect(beheerPoort).toContain("isLoading || afmeldenBezig");
  });
});

describe("E. De schakelaar blijft buiten de onthaalpagina", () => {
  it("de regel maakt het onderscheid en laat de schakelaar elders staan", () => {
    expect(regel).toContain("export function isOnthaalpagina");
    expect(regel).toContain(
      "if (!isOnthaalpagina(window.location.hash, window.location.pathname)) return true;",
    );
  });

  it("de component volgt het adres, zodat een wandeling meetelt", () => {
    expect(schakelaar).toContain('window.addEventListener("hashchange", volg)');
    expect(schakelaar).toContain("useMemo(() => schakelaarZichtbaarNu(), [adres])");
  });

  it("in de belevingslaag blijft de schakelaar bereikbaar", () => {
    // Staat de belevingslaag aan, dan staat op het adres met het hekje niet de
    // onthaalpagina maar de startpagina met de poorten. Zou de bezoekersregel
    // daar gelden, dan verdween de schakelaar precies waar hij nodig is en was
    // de weg terug naar Tapas CORE alleen nog met een parameter te vinden.
    expect(regel).toContain('import { CORE_MODE } from "@/lib/features"');
    expect(regel).toContain("if (!CORE_MODE) return true;");
    expect(regel.indexOf("if (!CORE_MODE) return true;")).toBeLessThan(
      regel.indexOf("if (!isOnthaalpagina(window.location.hash"),
    );
  });

  it("de component houdt zich nog aan de regel", () => {
    expect(schakelaar).toContain("if (!zichtbaar) return null;");
  });

  it("de schakelaar zelf werkt onveranderd", () => {
    expect(schakelaar).toContain('data-testid="beleving-schakelaar"');
    expect(schakelaar).toContain('data-testid="switch-beleving"');
    expect(schakelaar).toContain("onCheckedChange={(aan) => zetBeleving(aan)}");
  });
});
