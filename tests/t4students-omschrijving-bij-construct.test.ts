import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { omschrijvingVan } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel C van de opdracht "Studiekompas persoonlijk maken".
//
// Overal waar een constructnaam in het rapport verschijnt, komt er een
// gewone, niet-technische omschrijving naast. De omschrijvingen staan letterlijk
// in de opdracht en worden hier op één plek vastgelegd: omschrijvingVan().
//
// De twee TaPas-BEELD-constructen (Helderheid/zingeving en Energie-status)
// kregen in de opdracht geen omschrijving. Voor die twee mag deze functie
// dus leeg teruggeven; er wordt niets verzonnen.
//
// Vóór de bouw is dit rood: de functie bestaat niet.
// ---------------------------------------------------------------------------

describe("omschrijvingVan geeft de letterlijke, vaste omschrijving per construct", () => {
  const verwacht: Record<string, string> = {
    "Functioneel Innovatief": "creatief probleemoplossen",
    "Artistiek Innovatief": "artistiek en beeldend denken",
    "Complexiteit/Conceptueel": "conceptueel en analytisch denken",
    "Systematisch/Uitvoerend": "systematisch en nauwgezet werken",
    "Sociaal Interactief": "samenwerken in groepsverband",
    "Overdrachtelijk Interactief": "kennis overbrengen en uitleggen",
    Analyse: "analyseren en doordenken",
    "Individueel ondersteunend": "iemand persoonlijk verder helpen",
    Groepsondersteunend: "een groep laten werken",
    Impact: "anderen in beweging brengen",
    Resultaat: "gericht op resultaat",
    "Constructief onderscheidend": "een eigen, onderscheidende aanpak",
    "Be Perfect": "het goed willen doen",
    "Please Others": "het goed willen doen voor anderen",
    // De omschrijving bij Try Hard volgt de vaste constructdefinitie van de
    // opdrachtgever. Try Hard is niet "hard blijven proberen" in het algemeen:
    // het is iets uitzonderlijks willen doen voor iemand naar wie je opkijkt en
    // van wie je weet dat die in je gelooft. Zonder die persoon in de tekst
    // valt het construct samen met gewone inzet, en dat meet het niet. Deze
    // korte regel staat in een kolom van 162 punten en mag niet afbreken; het
    // vertrouwen van die persoon staat daarom in het item en in de
    // duidingstekst, waar de ruimte er wel is.
    "Try Hard": "uitblinken voor iemand naar wie je opkijkt",
    "Hurry Up": "snel vooruit willen",
    "Be Strong": "het alleen willen dragen",
    Autonomie: "zelf kunnen bepalen",
    Competentie: "merken dat je het kan",
    Verbondenheid: "er samen aan werken",
    Erkenning: "gezien worden voor wat je doet",
    Verwachting: "voldoen aan wat er van je verwacht wordt",
    Realistisch: "werken met dingen, techniek en handen",
    Investigative: "uitzoeken en onderzoeken",
    Artistiek: "vormgeven en verbeelden",
    Sociaal: "met en voor mensen werken",
    Ondernemend: "overtuigen en initiatief nemen",
    Conventioneel: "ordenen en overzicht houden",
  };

  for (const [construct, tekst] of Object.entries(verwacht)) {
    it(`geeft de juiste omschrijving voor ${construct}`, () => {
      expect(omschrijvingVan(construct)).toBe(tekst);
    });
  }

  it("geeft een lege tekst voor een construct zonder opgegeven omschrijving", () => {
    expect(omschrijvingVan("Helderheid/zingeving")).toBe("");
    expect(omschrijvingVan("Energie-status")).toBe("");
  });

  it("geeft een lege tekst voor een onbestaand construct, in plaats van te gokken", () => {
    expect(omschrijvingVan("Iets Dat Niet Bestaat")).toBe("");
  });
});

describe("elk construct dat in scoring meetelt, buiten TaPas-BEELD, heeft een omschrijving", () => {
  it("voorkomt dat een nieuw construct stil zonder omschrijving blijft", () => {
    const zonder: string[] = [];
    for (const fam of T4STUDENTS_INSTRUMENT.families) {
      if (fam.id === "TaPas-BEELD") continue; // bewust niet opgegeven in de opdracht
      for (const con of fam.constructs) {
        if (!omschrijvingVan(con)) zonder.push(`${fam.id} / ${con}`);
      }
    }
    expect(zonder).toEqual([]);
  });
});
