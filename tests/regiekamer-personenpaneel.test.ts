import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bouwRolInhoud,
  kringTekst,
  leesServermelding,
  ROLKEUZES,
  rolTekst,
  vraagtWerkstroom,
} from "@/lib/regiekamer-personen";

const wortel = resolve(__dirname, "..");
const lees = (pad: string) => readFileSync(resolve(wortel, pad), "utf8");

const paneelBron = lees("client/src/pages/regiekamer-personen.tsx");
const schermBron = lees("client/src/pages/traject-scherm.tsx");

describe("de rolkeuze van het personenpaneel", () => {
  it("kent de zeven rollen en noemt ze in gewone taal", () => {
    expect(ROLKEUZES).toHaveLength(7);
    for (const keuze of ROLKEUZES) {
      expect(rolTekst(keuze)).not.toContain("_");
      expect(rolTekst(keuze).length).toBeGreaterThan(3);
    }
    expect(rolTekst("werkstroomleider")).toBe("Leider van een werkstroom");
    expect(rolTekst("ankerpunt_investeerder")).toBe(
      "Ankerpunt van de investeerder",
    );
  });

  it("vraagt alleen bij een werkstroomleider om een werkstroom", () => {
    expect(vraagtWerkstroom("werkstroomleider")).toBe(true);
    for (const keuze of ROLKEUZES.filter(
      (rol) => rol !== "werkstroomleider",
    )) {
      expect(vraagtWerkstroom(keuze)).toBe(false);
    }
  });

  it("stuurt de werkstroom alleen mee bij een werkstroomleider", () => {
    expect(bouwRolInhoud("werkstroomleider", 4)).toEqual({
      rol: "werkstroomleider",
      werkstroomId: 4,
    });
    expect(bouwRolInhoud("adviseur", 4)).toEqual({ rol: "adviseur" });
    expect(bouwRolInhoud("adviseur", null)).toEqual({ rol: "adviseur" });
  });

  it("zegt de kring in gewone taal, ook wanneer er geen is", () => {
    expect(kringTekst(0)).toBe("Kring 0");
    expect(kringTekst(2)).toBe("Kring 2");
    expect(kringTekst(null)).toBe("Nog geen kring");
  });
});

describe("de melding van de server op het scherm", () => {
  it("neemt de zin van de server letterlijk over", () => {
    expect(
      leesServermelding(
        '400: {"error":"Een werkstroomleider heeft een werkstroom nodig."}',
      ),
    ).toBe("Een werkstroomleider heeft een werkstroom nodig.");
    expect(leesServermelding('404: {"error":"Niet gevonden."}')).toBe(
      "Niet gevonden.",
    );
  });

  it("zet ook een melding met meerdere velden om in leesbare tekst", () => {
    const ruw =
      '400: {"error":{"formErrors":["Onbekend veld."],' +
      '"fieldErrors":{"email":["Dit adres bestaat al in dit traject."]}}}';
    const melding = leesServermelding(ruw);
    expect(melding).toContain("Onbekend veld.");
    expect(melding).toContain("Dit adres bestaat al in dit traject.");
    expect(melding).not.toContain("fieldErrors");
  });

  it("houdt onleesbare antwoorden leesbaar zonder er iets bij te verzinnen", () => {
    expect(leesServermelding("500: <html>fout</html>")).toBe(
      "<html>fout</html>",
    );
    expect(leesServermelding("")).toBe(
      "De server gaf geen uitleg bij deze weigering.",
    );
  });
});

describe("het paneel met de mensen en hun rollen", () => {
  it("haalt de lijst bij de server op en toont haar zoals ze komt", () => {
    expect(paneelBron).toContain(
      'queryKey: ["/api/traject/trajecten", trajectId, "personen"]',
    );
    expect(paneelBron).toContain("personen.map(");
    expect(paneelBron).not.toContain("personen.filter(");
    expect(paneelBron).toContain("persoon.naam");
    expect(paneelBron).toContain("persoon.partijNaam");
    expect(paneelBron).toContain("kringTekst(persoon.kring)");
    expect(paneelBron).toContain("persoon.rollen");
  });

  it("laat wie niet meer meedoet in de lijst staan met de aanduiding van de server", () => {
    expect(paneelBron).toContain("persoon.aanduiding");
    expect(paneelBron).toContain('data-testid="persoon-niet-meer-actief"');
  });

  it("kan iemand toevoegen, op inactief zetten, een rol geven en een rol intrekken", () => {
    expect(paneelBron).toContain(
      "`/api/traject/trajecten/${trajectId}/personen`",
    );
    expect(paneelBron).toContain(
      "`/api/traject/personen/${persoonId}/inactief`",
    );
    expect(paneelBron).toContain("`/api/traject/personen/${persoonId}/rollen`");
    expect(paneelBron).toContain("`/api/traject/rollen/${rolId}/intrekken`");
    expect(paneelBron).toContain('data-testid="persoon-toevoegen"');
  });

  it("toont de keuze van de werkstroom enkel bij een werkstroomleider", () => {
    expect(paneelBron).toContain("vraagtWerkstroom(gekozenRol)");
    expect(paneelBron).toContain('data-testid="werkstroomkeuze"');
    expect(paneelBron).toMatch(
      /vraagtWerkstroom\(gekozenRol\) \? \([\s\S]{0,600}data-testid="werkstroomkeuze"/,
    );
  });

  it("zet de weigering van de server op de plaats van de handeling", () => {
    expect(paneelBron).toContain("leesServermelding");
    expect(paneelBron).toContain('data-testid="melding-weigering"');
    expect(paneelBron).toContain('data-testid="melding-weigering-toevoegen"');
  });

  it("laat de opmerking over belang staan tot de gebruiker ze wegklikt", () => {
    expect(paneelBron).toContain('data-testid="melding-waarschuwing"');
    expect(paneelBron).toContain("antwoord.waarschuwing");
    expect(paneelBron).toContain("zetWaarschuwing(null)");
    // De opmerking verdwijnt niet van zichzelf: geen tijdslot in dit paneel.
    expect(paneelBron).not.toContain("setTimeout");
  });

  it("geeft de opmerking een ander gezicht dan een weigering", () => {
    const waarschuwing = paneelBron.slice(
      paneelBron.indexOf('data-testid="melding-waarschuwing"'),
      paneelBron.indexOf('data-testid="melding-waarschuwing"') + 900,
    );
    const weigering = paneelBron.slice(
      paneelBron.indexOf('data-testid="melding-weigering"'),
      paneelBron.indexOf('data-testid="melding-weigering"') + 900,
    );
    expect(waarschuwing).toContain("var(--regie-lopend)");
    expect(waarschuwing).toContain("Ik heb het gelezen");
    expect(weigering).toContain("var(--regie-aandacht)");
    expect(weigering).not.toContain("Ik heb het gelezen");
  });

  it("toont rustig wanneer iemand welke rol kreeg", () => {
    expect(paneelBron).toContain("rol.toegekendOp");
    expect(paneelBron).toContain("Gekregen op");
  });

  it("hangt aan het hoofdscherm van een dossier en blijft leesbaar op een smal venster", () => {
    expect(schermBron).toContain("PersonenPaneel");
    expect(schermBron).toContain('data-testid="knop-personen"');
    expect(paneelBron).toContain("w-full");
    expect(paneelBron).toContain("md:w-[40vw]");
  });

  it("rekent zelf niet na wie wat mag zien", () => {
    expect(paneelBron).not.toContain("isPrior");
    expect(paneelBron).not.toContain("indruk");
    expect(paneelBron).not.toContain("SOORTEN_MET_BELANG");
  });
});
