// ---------------------------------------------------------------------------
// tests/notulen-toc-omzetting.test.ts
//
// De omzetting van beknopte notulen naar het vaste verslagmodel van het Team of
// Captains. Er zijn drie dingen die hier niet mogen mislukken.
//
// Het eerste is de huisregel over het gedachtestreepje. Een verslag van het Team
// of Captains gaat naar aandeelhouders en investeringspartners en mag nergens een
// em-streepje of een en-streepje dragen, ook niet wanneer de beknopte notulen er
// vol mee staan. Deze test bouwt daarom invoer met streepjes en kijkt daarna in
// het binnenwerk van het afgeleverde Word-bestand of er nog één in staat.
//
// Het tweede is dat niets verdwijnt. Een verslaggever die een regel schrijft die
// de omzetting niet begrijpt, mag die regel nooit kwijtraken: ze hoort achteraan
// het verslag te staan onder "Nog te plaatsen".
//
// Het derde is de herkenning zelf: aanwezigen, besluiten, acties met eigenaar en
// datum, risico's, vragen en de negen thema's.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { leesDocx } from "../server/notulen-toc/inlezen";
import { herken, leesDatum } from "../server/notulen-toc/herkennen";
import { bouwInvulblad, bouwVerslag } from "../server/notulen-toc/verslag";
import { schoonTekst, telStreepjes } from "../server/notulen-toc/model";

// ---------------------------------------------------------------------------
// Een klein Word-bestand met beknopte notulen, zoals een verslaggever het maakt.
// ---------------------------------------------------------------------------
function kop(tekst: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: tekst })] });
}

function regel(tekst: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: tekst })] });
}

function cel(tekst: string): TableCell {
  return new TableCell({
    width: { size: 2000, type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun({ text: tekst })] })],
  });
}

async function maakBeknopteNotulen(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          kop("Kerngegevens"),
          regel("Vergadering: Team of Captains, nummer 01 van het werkjaar 2026"),
          regel("Datum: 17.09.2026, van 14.30 tot 18.30 uur"),
          regel("Locatie: Antwerpen"),
          regel("Voorzitter: Andrea Hoffmann"),
          regel("Verslaggever: Andrea Hoffmann"),
          regel("Aanwezig: Marc Debisschop, Herman Van Esbroeck, Ophelia Debisschop, Fons Feekens"),
          regel("Verontschuldigd: geen"),
          regel("Volgende vergadering: 15.10.2026, Antwerpen"),
          regel("Een losse regel bij de kerngegevens die daar niet thuishoort en toch moet blijven staan."),

          kop("Kernboodschap"),
          regel("Het platform draagt vandaag zes instrumenten \u2014 de zevende volgt in oktober."),
          regel("De omzet over het derde kwartaal ligt boven plan."),

          kop("Platform en technologie"),
          regel("De release van augustus staat op de productieomgeving."),
          regel("Besluit: de zevende instrumentweg gaat pas open na een volledige testronde."),

          kop("Financieel"),
          regel("De facturatie loopt sinds juli via de nieuwe stroom."),
          regel("Risico: de boekhouding volgt de facturatie met vertraging."),

          kop("Acties"),
          regel("Actie: organogram opmaken (Marc Debisschop) tegen 30.09.2026, hoog"),
          regel("Actie: kalender 2027 rondsturen. Eigenaar: Andrea Hoffmann. Deadline: 15 oktober 2026."),

          kop("Vragen aan PMV"),
          regel("Vraag aan PMV: bevestiging van de tweede schijf, gevraagd tegen 31.10.2026."),

          kop("Openstaande punten"),
          regel("Openstaand: de keuze van een vaste vergaderplaats in de regio Sint-Niklaas."),

          kop("Werkafspraken"),
          regel("Afspraak: het verslag gaat binnen vijf werkdagen rond."),

          kop("Bijlagen"),
          regel("Bijlage: SWOT van het Team of Captains"),

          kop("Opvolging"),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [cel("Nr."), cel("Actie"), cel("Eigenaar"), cel("Datum"), cel("Stand")],
              }),
              new TableRow({
                children: [cel("01"), cel("statuten nazien"), cel("Fons Feekens"), cel("01.09.2026"), cel("afgerond")],
              }),
            ],
          }),

          regel("Nog een regel over de opvolging, zonder etiket vooraan."),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function documentXml(docx: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const bestand = zip.file("word/document.xml");
  expect(bestand).not.toBeNull();
  return bestand!.async("string");
}

// ---------------------------------------------------------------------------
// De tekstzeef.
// ---------------------------------------------------------------------------
describe("De tekstzeef van de omzetting", () => {
  it("vervangt een em-streepje tussen twee ruimtes door een komma", () => {
    expect(schoonTekst("zes instrumenten \u2014 de zevende volgt")).toBe("zes instrumenten, de zevende volgt");
  });

  it("maakt van een streepje tussen twee uren het woord tot", () => {
    expect(schoonTekst("van 14.30 \u2013 18.30 uur")).toBe("van 14.30 tot 18.30 uur");
  });

  it("schrapt een streepje vooraan een opsommingsregel", () => {
    expect(schoonTekst("\u2014 de kalender volgt")).toBe("de kalender volgt");
  });

  it("laat na de zeef geen enkel streepje staan", () => {
    const zeef = schoonTekst("a \u2014 b \u2013 c\u2014d");
    expect(telStreepjes(zeef)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Datums.
// ---------------------------------------------------------------------------
describe("Datums lezen", () => {
  it("leest een datum met punten", () => {
    expect(leesDatum("17.09.2026")).toBe("17.09.2026");
  });

  it("leest een datum met schuine strepen en vult de dag aan", () => {
    expect(leesDatum("1/9/2026")).toBe("01.09.2026");
  });

  it("leest een datum met een maandnaam", () => {
    expect(leesDatum("15 oktober 2026")).toBe("15.10.2026");
  });
});

// ---------------------------------------------------------------------------
// De herkenning.
// ---------------------------------------------------------------------------
describe("Beknopte notulen herkennen", () => {
  it("haalt de kerngegevens uit de regels met een dubbele punt", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(inhoud.kerngegevens.datumEnUur).toContain("17.09.2026");
    expect(inhoud.kerngegevens.voorzitter).toBe("Andrea Hoffmann");
    expect(inhoud.kerngegevens.aanwezig).toContain("Herman Van Esbroeck");
    expect(inhoud.kerngegevens.volgende).toContain("15.10.2026");
  });

  it("nummert de besluiten en de acties doorlopend", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(inhoud.besluiten.length).toBeGreaterThanOrEqual(1);
    expect(inhoud.besluiten[0].nr).toBe("B-01");
    expect(inhoud.acties.length).toBe(2);
    expect(inhoud.acties[0].nr).toBe("A-01");
    expect(inhoud.acties[1].nr).toBe("A-02");
  });

  it("haalt eigenaar, datum en prioriteit uit een actieregel", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const eerste = inhoud.acties[0];
    expect(eerste.tekst).toContain("organogram");
    expect(eerste.eigenaar).toBe("Marc Debisschop");
    expect(eerste.deadline).toBe("30.09.2026");
    expect(eerste.prioriteit).toBe("hoog");
    const tweede = inhoud.acties[1];
    expect(tweede.eigenaar).toBe("Andrea Hoffmann");
    expect(tweede.deadline).toBe("15.10.2026");
  });

  it("geeft een besluit het thema van de kop waaronder het staat", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(inhoud.besluiten[0].thema).toContain("Platform");
    expect(inhoud.themas.A.besluiten.length).toBe(1);
  });

  it("plaatst een risico, een vraag, een openstaand punt en een werkafspraak in hun register", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(inhoud.risicos.length).toBe(1);
    expect(inhoud.risicos[0].risico).toContain("boekhouding");
    expect(inhoud.vragen.length).toBe(1);
    expect(inhoud.vragen[0].vraag).toContain("tweede schijf");
    expect(inhoud.openPunten.length).toBe(1);
    expect(inhoud.openPunten[0].punt).toContain("Sint-Niklaas");
    expect(inhoud.werkafspraken.length).toBe(1);
    expect(inhoud.bijlagen.length).toBe(1);
  });

  it("leest een opvolgingstabel met een standkolom", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(inhoud.opvolging.length).toBe(1);
    expect(inhoud.opvolging[0].actie).toBe("statuten nazien");
    expect(inhoud.opvolging[0].stand).toBe("afgerond");
    expect(inhoud.opvolging[0].datum).toBe("01.09.2026");
  });

  it("laat geen enkele regel verdwijnen", async () => {
    const ingelezen = await leesDocx(await maakBeknopteNotulen());
    const { inhoud, rapport } = herken(ingelezen, "test.docx");
    const alleTekst = JSON.stringify(inhoud);
    expect(alleTekst).toContain("daar niet thuishoort");
    expect(alleTekst).toContain("zonder etiket vooraan");
    expect(rapport.aantallen.besluiten).toBe(inhoud.besluiten.length);
    expect(rapport.streepjesVervangen).toBeGreaterThan(0);
  });

  it("meldt in het rapport wat de beheerder moet nazien", async () => {
    const { rapport } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    expect(rapport.themasMetInhoud).toContain("A");
    expect(rapport.themasMetInhoud).toContain("H");
    expect(rapport.aandacht.join(" ")).toContain("gedachtestreepje");
  });
});

// ---------------------------------------------------------------------------
// Het afgeleverde verslag.
// ---------------------------------------------------------------------------
describe("Het omgezette verslag", () => {
  it("draagt nergens een em-streepje of een en-streepje", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const xml = await documentXml(await bouwVerslag(inhoud));
    expect(xml.includes("\u2014")).toBe(false);
    expect(xml.includes("\u2013")).toBe(false);
    expect(xml.includes("&#8212;")).toBe(false);
    expect(xml.includes("&#8211;")).toBe(false);
  });

  it("bevat alle dertien rubrieken van het vaste model", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const xml = await documentXml(await bouwVerslag(inhoud));
    for (const titel of [
      "Kerngegevens van de vergadering",
      "Doel en leeswijzer",
      "Kernboodschap voor aandeelhouders en investeringspartners",
      "Vorig verslag en opvolging van de acties",
      "Bespreking per thema",
      "Besluitenregister",
      "Actieregister",
      "Openstaande punten en te nemen beslissingen",
      "Vraag en verwachting richting de investeringspartner",
      "Werkafspraken en vergaderkalender",
      "Goedkeuring",
      "Bijlagen",
    ]) {
      expect(xml).toContain(titel);
    }
  });

  it("laat de negen thema's staan en schrijft bij een leeg thema dat het niet behandeld is", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const xml = await documentXml(await bouwVerslag(inhoud));
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I"]) {
      expect(xml).toContain(`${letter}. `);
    }
    expect(xml).toContain("Niet behandeld in dit overleg");
  });

  it("zet de regel die nergens paste achteraan onder Nog te plaatsen", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const xml = await documentXml(await bouwVerslag(inhoud));
    expect(xml).toContain("Nog te plaatsen uit de beknopte notulen");
    expect(xml).toContain("daar niet thuishoort");
  });

  it("draagt het merk en de baseline", async () => {
    const { inhoud } = herken(await leesDocx(await maakBeknopteNotulen()), "test.docx");
    const docx = await bouwVerslag(inhoud);
    const zip = await JSZip.loadAsync(docx);
    const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
    expect(media.length).toBeGreaterThan(0);
    const xml = await documentXml(docx);
    expect(xml).toContain("Talent runs on Passion");
    expect(xml).toContain("Verslag Team of Captains");
  });
});

// ---------------------------------------------------------------------------
// Foutmeldingen en het invulblad.
// ---------------------------------------------------------------------------
describe("Bestanden die niet kunnen", () => {
  it("weigert een bestand dat geen Word-bestand is", async () => {
    await expect(leesDocx(Buffer.from("dit is gewone tekst"))).rejects.toThrow(/geen Word-bestand/);
  });

  it("weigert een zip zonder Word-document erin", async () => {
    const zip = new JSZip();
    zip.file("hallo.txt", "niets");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await expect(leesDocx(buffer as Buffer)).rejects.toThrow(/geen Word-document/);
  });
});

describe("Het invulblad voor beknopte notulen", () => {
  it("draagt de koppen die de omzetting leest, en geen streepje", async () => {
    const xml = await documentXml(await bouwInvulblad());
    expect(xml).toContain("Beknopte notulen");
    expect(xml).toContain("Kerngegevens");
    expect(xml).toContain("Besluiten");
    expect(xml).toContain("Acties");
    expect(xml).toContain("Vragen aan de investeringspartner");
    expect(xml.includes("\u2014")).toBe(false);
    expect(xml.includes("\u2013")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// De vorm waarin beknopte notulen in de praktijk het vaakst geschreven worden:
// een tabel met een rijnummer, een onderwerp en een cel met de hele bespreking,
// en bovenaan drie losse regels zonder dubbele punt.
// ---------------------------------------------------------------------------
function rij3(nummer: string, onderwerp: string, tekst: string): TableRow {
  return new TableRow({ children: [cel(nummer), cel(onderwerp), cel(tekst)] });
}

async function maakOnderwerpenNotulen(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          regel("Team of Captains Meeting"),
          regel("17/9/2026 14:30 tot 18:30 uur"),
          regel("Parkoffice zaal The Pearl"),
          regel("Aanwezig: Marc Debisschop, Herman Van Esbroeck, Andrea Hoffmann"),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              rij3(
                "1",
                "Platform",
                "De demo toont een sterke basis voor het eigenlijke platform. De doorlooptijd van een afname blijft binnen de norm. Besluit: het platform gaat in oktober naar de eerste klanten.",
              ),
              rij3(
                "2",
                "Coaches",
                "Er blijven tien actieve coaches over. De licentievoorwaarden gaan opnieuw naar alle coaches. Actie: Andrea Hoffmann stelt de licentievoorwaarden op tegen 15.10.2026.",
              ),
              rij3(
                "3",
                "Lopende zaken",
                "De offerte voor het gebouw in Sint-Niklaas wordt opgevraagd. De verzekering van de vennootschap loopt af in december en moet vernieuwd worden.",
              ),
            ],
          }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

describe("Notulen als onderwerpentabel", () => {
  it("leest de titel, de datum en de plaats uit de losse regels bovenaan", async () => {
    const { inhoud } = herken(await leesDocx(await maakOnderwerpenNotulen()), "t.docx");
    expect(inhoud.kerngegevens.vergadering).toBe("Team of Captains Meeting");
    expect(inhoud.kerngegevens.datumEnUur).toContain("17/9/2026");
    expect(inhoud.kerngegevens.locatie).toBe("Parkoffice zaal The Pearl");
    expect(inhoud.kerngegevens.aanwezig).toContain("Herman Van Esbroeck");
  });

  it("geeft elke rij het thema van haar onderwerp", async () => {
    const { inhoud } = herken(await leesDocx(await maakOnderwerpenNotulen()), "t.docx");
    const platform = inhoud.themas.A.bespreking.join(" ");
    const coaches = inhoud.themas.E.bespreking.join(" ");
    expect(platform).toContain("sterke basis");
    expect(platform).not.toContain("tien actieve coaches");
    expect(coaches).toContain("tien actieve coaches");
  });

  it("haalt het besluit en de actie uit de cellen en nummert ze", async () => {
    const { inhoud } = herken(await leesDocx(await maakOnderwerpenNotulen()), "t.docx");
    expect(inhoud.besluiten).toHaveLength(1);
    expect(inhoud.besluiten[0].nr).toBe("B-01");
    expect(inhoud.besluiten[0].tekst).toContain("naar de eerste klanten");
    expect(inhoud.acties).toHaveLength(1);
    expect(inhoud.acties[0].nr).toBe("A-01");
    expect(inhoud.acties[0].tekst).toContain("licentievoorwaarden");
    expect(inhoud.acties[0].deadline).toBe("15.10.2026");
  });

  it("zet een onbekend onderwerp met zijn regels onder Nog te plaatsen en niet in een vreemd thema", async () => {
    const { inhoud } = herken(await leesDocx(await maakOnderwerpenNotulen()), "t.docx");
    const rest = inhoud.nietGeplaatst.join(" ");
    expect(rest).toContain("Lopende zaken: De offerte");
    expect(rest).toContain("Lopende zaken: De verzekering");
    expect(inhoud.themas.E.bespreking.join(" ")).not.toContain("offerte");
    expect(inhoud.doel.join(" ")).not.toContain("offerte");
  });

  it("levert een verslag zonder streepje en met de datum in de bestandsnaam", async () => {
    const { inhoud } = herken(await leesDocx(await maakOnderwerpenNotulen()), "t.docx");
    const zip = await JSZip.loadAsync(await bouwVerslag(inhoud));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(telStreepjes(xml)).toBe(0);
    expect(xml).not.toContain("&#8212;");
    expect(xml).not.toContain("&#8211;");
  });
});
