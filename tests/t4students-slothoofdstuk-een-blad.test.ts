import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import { duidingVan, sterksteUitGroep, rangschik, FAM_FOCI } from "../server/t4students/rapport-contract";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Opmaakherstel-2, punt 5: het slothoofdstuk "Een zin om mee te nemen" liep
// over twee bladen, waarbij het tweede blad alleen de dankkaart bevatte met
// veel wit eronder. Dat moet één blad worden. Ruimte wordt gewonnen door:
//
// a) het citaatvlak met de samenvattende zin te herleiden tot wat het in het
//    referentiebeeld is: een ingetogen vlak met alleen de zin, schuin gezet,
//    tussen aanhalingstekens, gecentreerd, ZONDER opschriftje en ZONDER kop
//    (dus geen dubbele bewerking: geen opschrift + kop + versierd
//    aanhalingsteken tegelijk);
// b) de twee losse verklarende regels (gelijkspel/middenveld-toelichting en
//    de vaste slotregel) samen te voegen tot één kleine regel in de kleinere
//    tekstgrootte van voetnoten/labels, zonder de tekst zelf te wijzigen.
//
// Lukt dat niet, dan mag het over twee bladen blijven staan, maar dan moet
// het tweede blad ook de kaart "wat nog sterker kan" bevatten en niet alleen
// de dankkaart. Deze test meet eerst of het op één blad past (de eis); de
// render-meldingen mogen geen "past niet op een blad"-vermelding voor dit
// hoofdstuk bevatten.
// ---------------------------------------------------------------------------

function bouwRapport(variant: "verdieping" | "basis") {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, variant, {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: I.version,
  });
}

function vindSlot(paginas: T4SPagina[]): T4SPagina {
  const p = paginas.find((pg) => /een zin om mee te nemen/i.test(pg.titel));
  expect(p, "geen slothoofdstuk gevonden").toBeDefined();
  return p!;
}

describe("het slothoofdstuk Een zin om mee te nemen past op één blad", () => {
  it("de render-meldingen bevatten geen 'past niet op een blad' voor Een zin om mee te nemen (verdieping)", () => {
    const rapport = bouwRapport("verdieping");
    const { meldingen } = renderT4StudentsRapport(rapport);
    const treffers = meldingen.filter(
      (m) => m.includes("Een zin om mee te nemen") && m.includes("past niet op een blad"),
    );
    expect(treffers, `meldingen: ${JSON.stringify(meldingen)}`).toHaveLength(0);
  });

  it("de render-meldingen bevatten geen 'past niet op een blad' voor Een zin om mee te nemen (basis)", () => {
    const rapport = bouwRapport("basis");
    const { meldingen } = renderT4StudentsRapport(rapport);
    const treffers = meldingen.filter(
      (m) => m.includes("Een zin om mee te nemen") && m.includes("past niet op een blad"),
    );
    expect(treffers, `meldingen: ${JSON.stringify(meldingen)}`).toHaveLength(0);
  });
});

describe("het citaatvlak met de samenvattende zin is het rustige, ongeversierde vlak", () => {
  it("draagt geen opschriftje en geen kop (alleen de zin zelf)", () => {
    const rapport = bouwRapport("verdieping");
    const slot = vindSlot(rapport.paginas);
    // De zin staat niet langer als "citaat" met opschrift/kop, maar als het
    // rustigere blok (bijvoorbeeld "zinvlak") zonder die twee velden.
    const zinBlok = slot.blokken.find(
      (b) =>
        "tekst" in b &&
        typeof (b as unknown as { tekst?: string }).tekst === "string" &&
        (b as unknown as { tekst?: string }).tekst!.includes("Jij komt het sterkst tot je recht"),
    ) as unknown as { opschrift?: string; kop?: string } | undefined;
    expect(zinBlok, "geen blok met de samenvattende zin gevonden").toBeDefined();
    expect("opschrift" in (zinBlok as object), "het zin-vlak heeft nog een opschrift-veld").toBe(false);
    expect("kop" in (zinBlok as object), "het zin-vlak heeft nog een kop-veld").toBe(false);
  });
});

describe("de gelijkspel/middenveld-toelichting en de vaste slotregel staan samen als één kleine regel", () => {
  it("staan niet meer als losse gewone alinea's tussen het citaatvlak en de kaarten", () => {
    const rapport = bouwRapport("verdieping");
    const slot = vindSlot(rapport.paginas);
    // De vaste slotregel-tekst mag niet meer voorkomen als een blok van het
    // gewone "alinea"-soort (met de normale tekstgrootte); ze hoort voortaan
    // in een klein label-blok samen met de eventuele gelijkspel-toelichting.
    const D_SLOTREGEL =
      "Deze zin is samengesteld uit de drie onderdelen die in jouw antwoorden het sterkst naar voren " +
      "komen. Hij vat je niet samen als persoon.";
    const alsGewoneAlinea = slot.blokken.some((b) => b.soort === "alinea" && b.tekst === D_SLOTREGEL);
    expect(alsGewoneAlinea, "de vaste slotregel staat nog als een gewone, losse alinea").toBe(false);
    // De letterlijke tekst moet wel nog ergens op het blad staan (niet
    // gewijzigd, niet verwijderd), maar dan in het samengevoegde kleine blok.
    const ergensAanwezig = slot.blokken.some(
      (b) => "tekst" in b && typeof (b as unknown as { tekst?: string }).tekst === "string" && (b as unknown as { tekst?: string }).tekst!.includes(D_SLOTREGEL),
    );
    expect(ergensAanwezig, "de letterlijke tekst van de vaste slotregel is nergens meer te vinden").toBe(true);
  });
});

describe("de kaart WAT AL STERK IS toont ook de gewone omschrijving naast de naam", () => {
  it("het kaartvlak heeft een niet-lege omschrijving naast de constructnaam, net als op de andere bladen", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const foci = rangschik(I, resultaat, VOORBEELDAFNAME.antwoorden, FAM_FOCI);
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const slot = vindSlot(rapport.paginas);
    const kaart = slot.blokken.find(
      (b) => (b as unknown as { opschrift?: string }).opschrift === "WAT AL STERK IS",
    ) as (T4SBlok & { omschrijving?: string }) | undefined;
    expect(kaart, "geen kaart met opschrift WAT AL STERK IS gevonden").toBeDefined();
    const { constructen } = sterksteUitGroep(foci);
    expect(constructen.length).toBeGreaterThan(0);
    expect(
      (kaart as unknown as { omschrijving?: string }).omschrijving,
      "de kaart WAT AL STERK IS mist het omschrijving-veld",
    ).toBe(constructen[0].omschrijving);
  });
});
