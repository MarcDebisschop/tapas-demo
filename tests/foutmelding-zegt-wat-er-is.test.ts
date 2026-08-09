// =============================================================================
// De foutmelding moet zeggen wat er werkelijk aan de hand is.
//
// De Regiekamer toonde bij ELKE fout "Verbindingsprobleem", ook wanneer de
// verbinding prima was en de server een keurig antwoord had gegeven. Wie niet
// aangemeld was, kreeg te horen dat hij zijn internet moest nakijken. Dat stuurt
// een mens de verkeerde kant op.
//
// Deze reeks bewaakt twee dingen:
//   1. de duiding zelf: welke fout leidt tot welke boodschap (echte eenheden);
//   2. dat het scherm die duiding ook gebruikt in plaats van vast "netwerk".
// =============================================================================
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  duidFout,
  leesStatuscode,
  leesServerboodschap,
  opnieuwProberenHeeftZin,
} from "../client/src/lib/foutduiding";

const wortel = resolve(__dirname, "..");
const lees = (pad: string) => readFileSync(resolve(wortel, pad), "utf8");

// Zo maakt queryClient.ts een fout van een antwoord dat niet in orde is:
//   throw new Error(`${res.status}: ${text}`)
const alsAntwoord = (status: number, romp: unknown) =>
  new Error(`${status}: ${JSON.stringify(romp)}`);

describe("de statuscode uit een fout lezen", () => {
  it("leest de code uit de vorm die queryClient maakt", () => {
    expect(leesStatuscode(alsAntwoord(403, { error: "Nee." }))).toBe(403);
    expect(leesStatuscode(alsAntwoord(404, { error: "Niet gevonden." }))).toBe(404);
    expect(leesStatuscode(alsAntwoord(500, { error: "Stuk." }))).toBe(500);
  });

  it("geeft niets terug wanneer er geen code in staat", () => {
    expect(leesStatuscode(new Error("Netwerk niet bereikbaar. Probeer opnieuw."))).toBeNull();
    expect(leesStatuscode(new Error("van alles en nog wat"))).toBeNull();
    expect(leesStatuscode(null)).toBeNull();
    expect(leesStatuscode(undefined)).toBeNull();
    expect(leesStatuscode("zomaar tekst")).toBeNull();
  });

  it("houdt een jaartal of ander getal in de tekst niet voor een statuscode", () => {
    expect(leesStatuscode(new Error("in 2026: er ging iets mis"))).toBeNull();
    expect(leesStatuscode(new Error("42: te klein"))).toBeNull();
    expect(leesStatuscode(new Error("999: bestaat niet"))).toBeNull();
  });
});

describe("de boodschap van de server eruit halen", () => {
  it("haalt de zin uit het veld error", () => {
    expect(leesServerboodschap(alsAntwoord(403, { error: "Dit dossier is niet van u." })))
      .toBe("Dit dossier is niet van u.");
  });

  it("geeft niets terug bij een romp zonder bruikbare zin", () => {
    expect(leesServerboodschap(alsAntwoord(500, "<html>Bad Gateway</html>"))).toBeNull();
    expect(leesServerboodschap(alsAntwoord(400, { error: { veld: ["fout"] } }))).toBeNull();
    expect(leesServerboodschap(alsAntwoord(400, { error: "   " }))).toBeNull();
    expect(leesServerboodschap(new Error("Netwerk niet bereikbaar."))).toBeNull();
  });

  it("neemt geen eindeloos lange romp over in het scherm", () => {
    const lang = "a".repeat(5000);
    const uitkomst = leesServerboodschap(alsAntwoord(400, { error: lang }));
    expect(uitkomst).not.toBeNull();
    expect((uitkomst as string).length).toBeLessThanOrEqual(300);
  });
});

describe("welke fout welke boodschap krijgt", () => {
  it("noemt alleen een verbindingsprobleem wanneer de server echt onbereikbaar was", () => {
    const duiding = duidFout(new Error("Netwerk niet bereikbaar. Probeer opnieuw."));
    expect(duiding.soort).toBe("netwerk");
  });

  it("herkent ook de bewoording die de browser zelf gebruikt", () => {
    // Elke browser kondigt een mislukte oproep anders aan.
    for (const zin of [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "Load failed",
    ]) {
      expect(duidFout(new TypeError(zin)).soort).toBe("netwerk");
    }
  });

  it("zegt bij een niet aangemelde bezoeker dat hij zich moet aanmelden", () => {
    const duiding = duidFout(
      alsAntwoord(403, { error: "Een aangemelde beheerder is vereist." }),
    );
    expect(duiding.soort).toBe("sessie-verlopen");
    expect(duiding.titel).toBeUndefined();
  });

  it("dekt bij de bewaking op organisatiegegevens beide mogelijke oorzaken", () => {
    // Gemeten in server/scope-guard.ts: deze ene zin komt terug wanneer er
    // niemand aangemeld is EN wanneer een aangemelde beheerder geen organisatie
    // heeft. De server maakt dat onderscheid niet, dus de melding mag niet doen
    // alsof ze weet welke van de twee het is.
    const duiding = duidFout(
      alsAntwoord(403, { error: "Geen toegang tot organisatiegegevens." }),
    );
    expect(duiding.soort).toBe("geen-toegang");
    const tekst = `${duiding.titel ?? ""} ${duiding.beschrijving ?? ""}`.toLowerCase();
    expect(tekst).toContain("aangemeld");
    expect(tekst).toContain("organisatie");
    // De kale serverzin doorgeven zegt de lezer niets over wat hij moet doen.
    expect(duiding.beschrijving).not.toBe("Geen toegang tot organisatiegegevens.");
  });

  it("de zin waarop die duiding steunt, staat werkelijk in de bewaking", () => {
    // Wordt de zin in de server ooit hernoemd, dan valt deze test om in plaats
    // van dat het scherm stilletjes een vage boodschap gaat tonen.
    const bewaking = lees("server/scope-guard.ts");
    expect(bewaking).toContain('"Geen toegang tot organisatiegegevens."');
  });

  it("zegt bij een andere 403 dat het dossier niet voor deze mens is", () => {
    const duiding = duidFout(alsAntwoord(403, { error: "Dit dossier is niet van u." }));
    expect(duiding.soort).toBe("geen-toegang");
    expect(duiding.beschrijving).toContain("Dit dossier is niet van u.");
  });

  it("zegt bij 404 dat het dossier niet bestaat, en niet dat het internet stuk is", () => {
    const duiding = duidFout(alsAntwoord(404, { error: "Niet gevonden." }));
    expect(duiding.soort).toBe("niet-gevonden");
  });

  it("zegt bij een serverfout dat het aan de server ligt", () => {
    for (const code of [500, 502, 503]) {
      expect(duidFout(alsAntwoord(code, { error: "Stuk." })).soort).toBe("serverfout");
    }
  });

  it("toont bij een afgewezen aanvraag de zin van de server zelf", () => {
    const duiding = duidFout(alsAntwoord(400, { error: "Kies een geldige soort." }));
    expect(duiding.soort).toBe("algemeen");
    expect(duiding.beschrijving).toContain("Kies een geldige soort.");
  });

  it("valt terug op een algemene boodschap zonder ooit over verbinding te liegen", () => {
    for (const geval of [null, undefined, "los stuk tekst", new Error("")]) {
      const duiding = duidFout(geval);
      expect(duiding.soort).toBe("algemeen");
    }
  });

  it("noemt in geen enkel geval buiten een echte netwerkfout het woord verbinding", () => {
    const gevallen: unknown[] = [
      alsAntwoord(400, { error: "Kies een geldige soort." }),
      alsAntwoord(403, { error: "Een aangemelde beheerder is vereist." }),
      alsAntwoord(403, { error: "Dit dossier is niet van u." }),
      alsAntwoord(404, { error: "Niet gevonden." }),
      alsAntwoord(500, { error: "Stuk." }),
      null,
    ];
    for (const geval of gevallen) {
      const duiding = duidFout(geval);
      expect(duiding.soort).not.toBe("netwerk");
      const tekst = `${duiding.titel ?? ""} ${duiding.beschrijving ?? ""}`.toLowerCase();
      expect(tekst).not.toContain("internetverbinding");
    }
  });

  it("laat een leeg antwoord zonder fout niet doorgaan voor een verbindingsprobleem", () => {
    // Het scherm kent ook het geval: geen fout, maar ook geen gegevens.
    const duiding = duidFout(null, { gegevensOntbreken: true });
    expect(duiding.soort).not.toBe("netwerk");
    expect(duiding.soort).toBe("algemeen");
  });
});

describe("een knop die niets oplost, wordt niet aangeboden", () => {
  it("biedt opnieuw proberen aan wanneer dat werkelijk kan helpen", () => {
    for (const soort of ["netwerk", "serverfout", "algemeen"] as const) {
      expect(opnieuwProberenHeeftZin(soort)).toBe(true);
    }
  });

  it("biedt het niet aan wanneer herhalen tot precies hetzelfde leidt", () => {
    // Een dossier dat niet bestaat, bestaat na opnieuw laden nog steeds niet.
    // Een rechtenkwestie lost zich ook niet op door te herhalen.
    for (const soort of [
      "niet-gevonden",
      "geen-toegang",
      "sessie-verlopen",
      "token-ongeldig",
      "onvoldoende-credits",
    ] as const) {
      expect(opnieuwProberenHeeftZin(soort)).toBe(false);
    }
  });
});

describe("het scherm gebruikt de duiding ook echt", () => {
  const schermBron = lees("client/src/pages/traject-scherm.tsx");

  it("zet nergens meer een vaste netwerkmelding neer", () => {
    expect(schermBron).not.toContain('type="netwerk"');
  });

  it("roept de duiding aan op beide plaatsen waar een fout getoond wordt", () => {
    const aantal = schermBron.split("duidFout(").length - 1;
    expect(aantal).toBeGreaterThanOrEqual(2);
    expect(schermBron).toContain('from "@/lib/foutduiding"');
  });

  it("dringt geen knop opnieuw laden op waar die niets oplost", () => {
    const aantal = schermBron.split("opnieuwProberenHeeftZin(").length - 1;
    expect(aantal).toBeGreaterThanOrEqual(2);
  });
});

describe("de foutkaart kent de nieuwe soorten", () => {
  const kaartBron = lees("client/src/components/BrandedError.tsx");

  it("heeft een eigen, zichtbare tekst voor geen toegang, niet gevonden en serverfout", () => {
    // Dat elke soort een ingang heeft, dwingt de typecontrole al af. Hier gaat
    // het om wat de lezer werkelijk te zien krijgt.
    expect(kaartBron).toContain("Dit dossier is niet voor jou");
    expect(kaartBron).toContain("Dit dossier bestaat niet");
    expect(kaartBron).toContain("De server liep vast");
  });

  it("blijft de bestaande soorten aanbieden", () => {
    for (const soort of ["sessie-verlopen", "onvoldoende-credits", "netwerk", "token-ongeldig"]) {
      expect(kaartBron).toContain(soort);
    }
  });

  it("houdt het woord internetverbinding uitsluitend bij de netwerksoort", () => {
    const aantal = kaartBron.split("internetverbinding").length - 1;
    expect(aantal).toBe(1);
  });
});
