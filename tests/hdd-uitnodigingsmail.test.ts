// ---------------------------------------------------------------------------
// tests/hdd-uitnodigingsmail.test.ts  -  de uitnodigingsmail van een HDD-fase
//
// AANLEIDING. Een board-traject werd uitgestuurd naar drie mensen. Het scherm
// gaf drie namen met hun links terug, de trajectprijs ging eraf, en er kwam bij
// niemand een bericht aan. De oorzaak was niet de verzendcode en niet de
// mailleverancier: in heel het HDD-pad stond geen enkele mailaanroep. Het
// e-mailadres reisde mee als gegeven en werd nooit een geadresseerde.
//
// Deze toetsen leggen drie dingen vast: dat er per lid werkelijk een bericht
// gevraagd wordt, dat het adres van de ontvanger ook echt het adres is waarnaar
// gevraagd wordt, en dat een fase waarin niets vertrok niet als geslaagd
// terugkomt. De mailer wordt hier vervangen door een dubbelganger; wat de
// leverancier werkelijk antwoordt, bewijst de proefknop in het beheerscherm.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

const verstuurd: Array<{ naar: string; onderwerp: string; tekst: string }> = [];
let antwoord: { status: "verstuurd" | "gesimuleerd" | "fout"; melding?: string; gesimuleerd?: boolean } = {
  status: "verstuurd",
};

vi.mock("../server/bulk-import/mailer", () => ({
  verstuurBericht: vi.fn(async (input: any) => {
    verstuurd.push({ naar: input.naar, onderwerp: input.onderwerp, tekst: input.tekst });
    return { ...antwoord };
  }),
  afzenderVoor: (from?: string | null) => (from && from.trim() ? from.trim() : "info@tapascity.com"),
}));

const { mailFaseUit, absoluteLink, berichtVoorLid } = await import("../server/hdd/uitnodigingsmail");

function lid(id: number, naam: string, email: string, instrumenten: string[]) {
  return {
    lidId: id,
    naam,
    email,
    links: instrumenten.map((i) => ({
      instrumentId: i,
      token: `t-${id}-${i}`,
      link: i === "twominscan" ? `/2minscan?uitnodiging=t-${id}-${i}` : `/deelnemer/t-${id}-${i}`,
      nieuw: true,
    })),
  };
}

beforeEach(() => {
  verstuurd.length = 0;
  antwoord = { status: "verstuurd" };
});

describe("een fase uitsturen verstuurt werkelijk post", () => {
  it("vraagt voor elk lid met een adres precies één bericht", async () => {
    const uitslag = await mailFaseUit({
      boardNaam: "Asterra",
      fase: 1,
      origin: "https://tapas.example",
      uitsturingen: [
        lid(1, "Herman Van Esbroeck", "herman@example.com", ["tapas-teamscan", "twominscan"]),
        lid(2, "Andrea Hoffmann", "andrea@example.com", ["tapas-teamscan", "twominscan"]),
        lid(3, "Marc Debisschop", "marc@example.com", ["tapas-teamscan", "twominscan"]),
      ],
    });

    // Dit is de toets die op 12 september had moeten falen: drie leden, drie
    // berichten, en niet nul.
    expect(verstuurd).toHaveLength(3);
    expect(verstuurd.map((v) => v.naar)).toEqual([
      "herman@example.com",
      "andrea@example.com",
      "marc@example.com",
    ]);
    expect(uitslag.aantalMailVerstuurd).toBe(3);
    expect(uitslag.mailGeslaagd).toBe(true);
    expect(uitslag.mailAlarm).toBeNull();
  });

  it("zet twee instrumenten in één bericht in plaats van twee berichten", async () => {
    await mailFaseUit({
      boardNaam: "Asterra",
      fase: 1,
      origin: "https://tapas.example",
      uitsturingen: [lid(1, "Herman Van Esbroeck", "herman@example.com", ["tapas-teamscan", "twominscan"])],
    });
    expect(verstuurd).toHaveLength(1);
    expect(verstuurd[0].tekst).toContain("Teamscan");
    expect(verstuurd[0].tekst).toContain("2MINSCAN");
  });

  it("noemt een lid zonder adres geen fout en vraagt er geen bericht voor", async () => {
    const uitslag = await mailFaseUit({
      boardNaam: "Asterra",
      fase: 1,
      origin: "https://tapas.example",
      uitsturingen: [lid(1, "Zonder Adres", "", ["twominscan"])],
    });
    expect(verstuurd).toHaveLength(0);
    expect(uitslag.leden[0].mailStatus).toBe("-");
    expect(uitslag.aantalZonderMail).toBe(0);
    expect(uitslag.mailGeslaagd).toBe(true);
  });

  it("noemt de fase niet geslaagd wanneer de mail enkel nagebootst werd", async () => {
    antwoord = { status: "gesimuleerd", gesimuleerd: true };
    const uitslag = await mailFaseUit({
      boardNaam: "Asterra",
      fase: 1,
      origin: "https://tapas.example",
      uitsturingen: [lid(1, "Herman Van Esbroeck", "herman@example.com", ["twominscan"])],
    });
    expect(uitslag.aantalMailVerstuurd).toBe(0);
    expect(uitslag.mailGeslaagd).toBe(false);
    expect(uitslag.mailAlarm).toContain("vertrok geen enkel bericht");
  });

  it("geeft de reden van de leverancier door wanneer een bericht mislukt", async () => {
    antwoord = { status: "fout", melding: "Sender is invalid" };
    const uitslag = await mailFaseUit({
      boardNaam: "Asterra",
      fase: 2,
      origin: "https://tapas.example",
      uitsturingen: [lid(1, "Herman Van Esbroeck", "herman@example.com", ["t4p-business-kompas"])],
    });
    expect(uitslag.leden[0].melding).toBe("Sender is invalid");
    expect(uitslag.mailGeslaagd).toBe(false);
    expect(uitslag.mailAlarm).toContain("vertrok niet");
  });
});

describe("de link in het bericht", () => {
  it("zet een gewoon pad achter de hash, want de client is hash-gerouteerd", () => {
    expect(absoluteLink("https://tapas.example", "/deelnemer/abc")).toBe(
      "https://tapas.example#/deelnemer/abc",
    );
  });

  it("zet het token van de 2MINSCAN in de zoekreeks vóór de hash", () => {
    // De 2MINSCAN-pagina leest window.location.search. Een zoekreeks achter de
    // hash komt daar nooit aan, en dan staat de deelnemer met een leeg formulier.
    expect(absoluteLink("https://tapas.example", "/2minscan?uitnodiging=abc")).toBe(
      "https://tapas.example/?uitnodiging=abc#/2minscan",
    );
  });

  it("laat de volledige link in het bericht staan", async () => {
    await mailFaseUit({
      boardNaam: "Asterra",
      fase: 1,
      origin: "https://tapas.example/",
      uitsturingen: [lid(7, "Herman Van Esbroeck", "herman@example.com", ["twominscan"])],
    });
    expect(verstuurd[0].tekst).toContain("https://tapas.example/?uitnodiging=t-7-twominscan#/2minscan");
  });
});

describe("de tekst van het bericht", () => {
  it("spreekt de ontvanger aan en belooft niets over de uitkomst", () => {
    const tekst = berichtVoorLid({
      naam: "Andrea Hoffmann",
      boardNaam: "Asterra",
      fase: 1,
      links: [{ instrumentId: "twominscan", link: "https://tapas.example/?uitnodiging=x#/2minscan" }],
    });
    expect(tekst).toContain("Beste Andrea Hoffmann,");
    expect(tekst).toContain("Asterra");
    expect(tekst).not.toMatch(/\u2014|\u2013/);
  });
});
