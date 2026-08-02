import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  inhoudsVingerafdruk,
  inhoudsVersie,
  basisVersieVan,
} from "../server/instrument-inhoudsversie";

// ---------------------------------------------------------------------------
// Ronde C, punt 1. Het versienummer van T4Professional stond als vaste tekst in
// server/data/instrument.json en bewoog niet mee met de inhoud. Een beheerder
// kon de tekst van een vraag wijzigen en een ontwikkelaar kon een item
// toevoegen, zonder dat het nummer opschoof. Twee afnames met hetzelfde nummer
// konden dus een andere vragenlijst geweest zijn.
//
// Deze test toont aan dat het nummer nu wel meebeweegt, dat het niet verspringt
// op zaken die de meting niet raken, en dat een afname het nummer meedraagt.
// ---------------------------------------------------------------------------

const wortel = path.resolve(__dirname, "..");

function verseDefinitie(): any {
  return JSON.parse(readFileSync(path.join(wortel, "server/data/instrument.json"), "utf-8"));
}

describe("inhoudsversie: het nummer volgt de inhoud", () => {
  it("geeft hetzelfde nummer voor dezelfde inhoud", () => {
    expect(inhoudsVersie(verseDefinitie())).toBe(inhoudsVersie(verseDefinitie()));
  });

  it("houdt het handmatige nummer uit het databestand vooraan", () => {
    const def = verseDefinitie();
    const versie = inhoudsVersie(def);
    expect(basisVersieVan(versie)).toBe(def.version);
    expect(versie).toMatch(/^\d+\.\d+\.\d+\+i[0-9a-f]{8}$/);
  });

  it("schuift op zodra een itemtekst wijzigt", () => {
    const voor = verseDefinitie();
    const na = verseDefinitie();
    const item = na.sections.find((s: any) => s.sectionId === "main").blocks[0].items[0];
    item.text.nl = `${item.text.nl} (aangepast door de beheerder)`;
    expect(inhoudsVersie(na)).not.toBe(inhoudsVersie(voor));
  });

  it("schuift op wanneer een item toegevoegd of verwijderd wordt", () => {
    const basis = verseDefinitie();
    const minderItems = verseDefinitie();
    const blok = minderItems.sections.find((s: any) => s.sectionId === "main").blocks[0];
    blok.items.pop();
    expect(inhoudsVersie(minderItems)).not.toBe(inhoudsVersie(basis));
  });

  it("schuift op wanneer de volgorde van de blokken wijzigt", () => {
    const basis = verseDefinitie();
    const omgedraaid = verseDefinitie();
    const hoofd = omgedraaid.sections.find((s: any) => s.sectionId === "main");
    hoofd.blocks.reverse();
    expect(inhoudsVersie(omgedraaid)).not.toBe(inhoudsVersie(basis));
  });

  it("schuift op wanneer een antwoordoptie of de schaal wijzigt", () => {
    const basis = verseDefinitie();
    const andereOptie = verseDefinitie();
    andereOptie.responseScales.energy.options[0].label.nl = "Vreet aan me";
    expect(inhoudsVersie(andereOptie)).not.toBe(inhoudsVersie(basis));

    const andereSchaal = verseDefinitie();
    andereSchaal.responseScales.energy.min = -3;
    expect(inhoudsVersie(andereSchaal)).not.toBe(inhoudsVersie(basis));
  });

  it("schuift op wanneer een verbindingsvraag wijzigt", () => {
    const basis = verseDefinitie();
    const gewijzigd = verseDefinitie();
    const vraag = gewijzigd.sections.find((s: any) => s.sectionId === "connection").questions[0];
    vraag.text.nl = "Een andere vraag";
    expect(inhoudsVersie(gewijzigd)).not.toBe(inhoudsVersie(basis));
  });

  it("schuift op wanneer een beheerder een itemtekst overschrijft", () => {
    const def = verseDefinitie();
    const zonder = inhoudsVersie(def, new Map());
    const met = inhoudsVersie(
      def,
      new Map([["1.1", { nl: "Een door de beheerder aangepaste vraag" }]]),
    );
    expect(met).not.toBe(zonder);

    // Een tweede, andere overschrijving op hetzelfde item geeft opnieuw een
    // ander nummer. Een teller die enkel het aantal wijzigingen bijhoudt, zou
    // hier blijven staan.
    const nogEens = inhoudsVersie(
      def,
      new Map([["1.1", { nl: "Alweer een andere vraag" }]]),
    );
    expect(nogEens).not.toBe(met);
  });

  it("verspringt niet op zaken die de meting niet raken", () => {
    const basis = verseDefinitie();
    const cosmetisch = verseDefinitie();
    cosmetisch.name = "Een andere naam voor hetzelfde instrument";
    cosmetisch.description = "Een andere omschrijving";
    cosmetisch.translationStatus = { nl: "onbekend" };
    expect(inhoudsVingerafdruk(cosmetisch)).toBe(inhoudsVingerafdruk(basis));
  });

  it("verspringt niet wanneer enkel de volgorde van sleutels wijzigt", () => {
    const basis = verseDefinitie();
    const omgekeerdeSleutels = verseDefinitie();
    const hoofd = omgekeerdeSleutels.sections.find((s: any) => s.sectionId === "main");
    const item = hoofd.blocks[0].items[0];
    hoofd.blocks[0].items[0] = Object.fromEntries(Object.entries(item).reverse());
    expect(inhoudsVingerafdruk(omgekeerdeSleutels)).toBe(inhoudsVingerafdruk(basis));
  });
});

describe("de afname draagt het versienummer mee", () => {
  it("het generator-contract legt de inhoudsversie vast", async () => {
    const { buildGeneratorContract } = await import("../server/scoring");
    const { huidigeInhoudsVersie } = await import("../server/instrument");

    const contract = buildGeneratorContract({
      respondentCode: "R-001",
      name: "Test Deelnemer",
      responses: {},
      baseline: 6,
      connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
      taal: "nl",
    });

    expect(contract.instrumentVersie).toBe(huidigeInhoudsVersie());
    expect(contract.instrumentVersie).toMatch(/^\d+\.\d+\.\d+\+i[0-9a-f]{8}$/);
    // Het nummer in het contract hoort bij de vragenlijst zoals die op het
    // databestand staat, en dus bij hetzelfde nummer dat het register toont.
    expect(basisVersieVan(contract.instrumentVersie)).toBe(verseDefinitie().version);
  });

  it("het register toont hetzelfde nummer als de afname", async () => {
    const { getDefaultDescriptor } = await import("../server/registry");
    const { huidigeInhoudsVersie } = await import("../server/instrument");
    expect(getDefaultDescriptor().version).toBe(huidigeInhoudsVersie());
  });
});
