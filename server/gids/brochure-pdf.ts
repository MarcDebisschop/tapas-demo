// =============================================================================
// server/gids/brochure-pdf.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Het VLAGGENSCHIP van De Instrumentengids: één drukklare brochure-PDF met
// alle negen instrumenten, gegroepeerd per oriëntatie (business & education,
// business, education). Hoogste kwaliteitslat — cover, inhoudsopgave, intro,
// per-instrument secties en een afsluiter.
//
// Herbruikt de zelfstandige pdf-engine (die de gevalideerde HDD-fonts/geometrie
// hergebruikt). Inhoud uit server/gids/data.ts + admin-overrides per taal.
// =============================================================================
import {
  nieuwGidsDocument,
  tekenCover,
  GidsLayout,
  sectieKop,
  veldKop,
  calloutBox,
  kleurVoor,
  orientatieLabelPdf,
  MM,
  MARGIN,
  CONTENT_W,
  PAGE_W,
  PAGE_H,
  F,
  INK,
  INK2,
  SUB,
  GOLD,
  LINE,
  WHITE,
  WERK,
  STUDIE,
  SURFACE2,
  type Orientatie,
} from "./pdf-engine";
import { INSTRUMENTENGIDS, type GidsInstrument } from "./data";
import { instrumentMetOverrides } from "./fiche-pdf";

function nlDatum(): string {
  const d = new Date();
  const maanden = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ];
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
}

interface Groep {
  orientatie: Orientatie;
  titel: string;
  kicker: string;
  intro: string;
  instrumenten: GidsInstrument[];
}

function bouwGroepen(taal: string): Groep[] {
  const opgelost = INSTRUMENTENGIDS.map((i) => instrumentMetOverrides(i, taal));
  const per = (o: Orientatie) => opgelost.filter((i) => i.orientatie === o);
  return [
    {
      orientatie: "beide",
      titel: "Voor business én onderwijs",
      kicker: "Universeel inzetbaar",
      intro:
        "Deze instrumenten werken even goed in een bedrijfscontext als in het onderwijs. Ze vormen de ruggengraat van het platform: van het volledige talentprofiel tot een snelle energiecheck en collectieve teamdynamiek.",
      instrumenten: per("beide"),
    },
    {
      orientatie: "business",
      titel: "Voor business",
      kicker: "Selectie, board & governance",
      intro:
        "Specifiek voor recruitment, leiderschap en bestuurlijke doorlichting. Hier zit ook het vlaggenschip Human Due Diligence — de diepste analyse in het TaPas-arsenaal.",
      instrumenten: per("business"),
    },
    {
      orientatie: "education",
      titel: "Voor onderwijs & sport",
      kicker: "Studiekeuze, jongeren & atleten",
      intro:
        "Afgestemd op leerlingen, studenten en atleten — met leeftijdsspecifieke taal en focus op studiekeuze, loopbaanstart en mentaal talent onder druk.",
      instrumenten: per("education"),
    },
  ];
}

/** Rijke per-instrument sectie binnen de brochure. */
function tekenInstrument(L: GidsLayout, instr: GidsInstrument) {
  const accent = kleurVoor(instr.orientatie as Orientatie);
  const c = L.doc;

  // Zorg dat kop + eerste alinea samen op één pagina beginnen.
  L.guardMm(48);

  // Naam-kop met oriëntatie-badge rechts
  c.font(F.dmBold).fontSize(16).fillColor(INK);
  const naamH = c.heightOfString(instr.naam, { width: CONTENT_W - 40 * MM });
  c.text(instr.naam, MARGIN, L.y, { width: CONTENT_W - 40 * MM });

  // badge
  const badge = orientatieLabelPdf(instr.orientatie as Orientatie);
  c.font(F.interSemi).fontSize(7);
  const badgeW = c.widthOfString(badge) + 16;
  const badgeX = MARGIN + CONTENT_W - badgeW;
  c.roundedRect(badgeX, L.y + 1, badgeW, 15, 7.5).fill(accent);
  c.fillColor(WHITE).text(badge, badgeX + 8, L.y + 5, { lineBreak: false });

  L.advance(naamH + 4);
  c.font(F.interSemi).fontSize(8.5).fillColor(accent);
  c.text(instr.eyebrow.toUpperCase(), MARGIN, L.y, { lineBreak: false });
  L.advance(11);
  c.lineWidth(1.2).strokeColor(accent);
  c.moveTo(MARGIN, L.y).lineTo(MARGIN + CONTENT_W, L.y).stroke();
  L.advance(10);

  L.paragraph(instr.omschrijving, { after: 10 });

  if (instr.leeftijdsfocus) {
    calloutBox(L, "Leeftijdsfocus", instr.leeftijdsfocus, accent);
  }

  veldKop(L, "Welke vragen beantwoordt het?", accent);
  L.paragraph(instr.beantwoordt, { after: 9 });

  veldKop(L, "Hoe kan ik het verder gebruiken?", accent);
  L.paragraph(instr.gebruik, { after: 9 });

  veldKop(L, "Voor wie?", accent);
  L.paragraph(instr.doelgroep, { after: 9 });

  calloutBox(L, "Wat je terugkrijgt", instr.rapportTeaser, accent);

  // starter-regel
  c.font(F.interSemi).fontSize(9).fillColor(accent);
  L.guardMm(10);
  c.text(`▶  ${instr.start.label}`, MARGIN, L.y, { lineBreak: false });
  c.font(F.inter).fontSize(8.5).fillColor(SUB);
  c.text(`   ${instr.start.route}`, MARGIN + c.widthOfString(`▶  ${instr.start.label}`) + 6, L.y, {
    lineBreak: false,
  });
  L.advance(24);
}

/** Groeps-scheider (halve pagina) met grote kop. */
function tekenGroepScheider(L: GidsLayout, g: Groep) {
  L.newBodyPage();
  const c = L.doc;
  const accent = kleurVoor(g.orientatie);
  L.advance(10 * MM);
  c.font(F.interSemi).fontSize(10).fillColor(accent);
  c.text(g.kicker.toUpperCase(), MARGIN, L.y, { lineBreak: false });
  L.advance(20);
  c.font(F.dmBold).fontSize(26).fillColor(INK);
  const h = c.heightOfString(g.titel, { width: CONTENT_W });
  c.text(g.titel, MARGIN, L.y, { width: CONTENT_W });
  L.advance(h + 8);
  c.lineWidth(2).strokeColor(accent);
  c.moveTo(MARGIN, L.y).lineTo(MARGIN + 60 * MM, L.y).stroke();
  L.advance(14);
  L.paragraph(g.intro, { size: 11, leading: 17, after: 16 });
}

/** Genereer de volledige brochure-PDF-buffer. */
export async function genereerBrochurePdf(taal = "nl"): Promise<Buffer> {
  const groepen = bouwGroepen(taal);
  const doc = nieuwGidsDocument(
    "TaPas — De Instrumentengids",
    "De volledige instrumentengids van het TaPas Platform"
  );

  const chunks: Buffer[] = [];
  const klaar = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ── Cover ──
  doc.addPage();
  tekenCover(doc, {
    kicker: "De Instrumentengids",
    titel1: "De",
    titel2: "Instrumentengids",
    ondertitel:
      "Alle talentinstrumenten van het TaPas Platform in één overzicht — voor business én onderwijs.",
    accent: GOLD,
    contextLabel: "Volledige gids",
    contextTekst:
      "Negen instrumenten, gegroepeerd naar toepassing. Van het volledige TaPas Kompas tot de 2MinScan, T4Recruitment, Human Due Diligence, T4Sports, T4Teens en T4Students.",
    datum: nlDatum(),
  });

  // ── Inhoudsopgave + intro ──
  doc.addPage();
  const L = new GidsLayout(doc, "De Instrumentengids", "Volledige gids");
  L.paintChrome();

  sectieKop(L, "Welkom", "Waarom deze gids?", GOLD);
  L.paragraph(
    "Het TaPas Platform bundelt een reeks talentinstrumenten die elk een eigen vraag beantwoorden. Deze gids brengt ze samen in één overzicht: wat elk instrument doet, welke vragen het beantwoordt, hoe je het verder gebruikt, voor wie het bedoeld is en wat je terugkrijgt.",
    { after: 8 }
  );
  L.paragraph(
    "De instrumenten zijn gegroepeerd naar toepassing — universeel inzetbaar (business én onderwijs), specifiek business, of specifiek onderwijs & sport. Elke groep opent met een korte introductie.",
    { after: 14 }
  );

  // eenvoudige inhoudsopgave
  veldKop(L, "Overzicht", GOLD);
  const c = doc;
  for (const g of groepen) {
    const accent = kleurVoor(g.orientatie);
    L.guardMm(10);
    c.font(F.interSemi).fontSize(9.5).fillColor(accent);
    c.text(g.titel, MARGIN, L.y, { lineBreak: false });
    L.advance(13);
    for (const instr of g.instrumenten) {
      L.guardMm(8);
      c.font(F.inter).fontSize(9.5).fillColor(INK);
      c.text(`   •  ${instr.naam}`, MARGIN, L.y, { lineBreak: false });
      c.font(F.inter).fontSize(8.5).fillColor(SUB);
      c.text(`— ${instr.eyebrow}`, MARGIN + 150, L.y, {
        width: CONTENT_W - 150,
        lineBreak: false,
      });
      L.advance(12);
    }
    L.advance(6);
  }

  // ── Per groep: scheider + instrumenten ──
  for (const g of groepen) {
    tekenGroepScheider(L, g);
    for (const instr of g.instrumenten) {
      tekenInstrument(L, instr);
    }
  }

  // ── Afsluiter ──
  L.newBodyPage();
  L.advance(18 * MM);
  const accent = GOLD;
  c.font(F.interSemi).fontSize(10).fillColor(accent);
  c.text("TOT SLOT", MARGIN, L.y, { lineBreak: false });
  L.advance(20);
  c.font(F.dmBold).fontSize(22).fillColor(INK);
  c.text("Klaar om te starten?", MARGIN, L.y, { width: CONTENT_W });
  L.advance(34);
  L.paragraph(
    "Elk instrument is direct te openen vanuit De Instrumentengids op het platform. Twijfel je welk instrument past bij je vraag? Begin met de 2MinScan voor een snelle indicatie, of het volledige TaPas Kompas voor een diepgaand talentprofiel.",
    { size: 11, leading: 17, after: 12 }
  );
  calloutBox(
    L,
    "Contact",
    "TaPas Platform · Talentgericht ontwikkelen voor business én onderwijs. Neem contact op met je TaPas-begeleider of coach voor toegang en tarieven.",
    accent
  );

  doc.end();
  return klaar;
}
