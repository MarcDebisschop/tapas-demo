// =============================================================================
// server/gids/fiche-pdf.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Meeneembare "fiche"-PDF per instrument: één cover-pagina + één body-pagina
// met de vijf gids-velden. Herbruikt de zelfstandige pdf-engine (die op zijn
// beurt de gevalideerde HDD-fonts/geometrie hergebruikt zonder ze aan te raken).
//
// De inhoud komt uit server/gids/data.ts (server-spiegel) en wordt per taal
// overschreven met admin-overrides via pasOverrideToe() uit ../gids-manager.
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
  F,
  INK,
  SUB,
  GOLD,
  type Orientatie,
} from "./pdf-engine";
import { INSTRUMENTENGIDS, vindInstrumentServer, type GidsInstrument } from "./data";
import { pasOverrideToe, gidsOverridesSnapshot } from "../gids-manager";

/** Instrument met toegepaste taal-overrides (velden die admin mag bewerken). */
export function instrumentMetOverrides(instr: GidsInstrument, taal: string): GidsInstrument {
  const snap = gidsOverridesSnapshot();
  const veld = (naam: string, standaard: string) =>
    pasOverrideToe(instr.id, naam, taal, standaard, snap);
  return {
    ...instr,
    omschrijving: veld("omschrijving", instr.omschrijving),
    beantwoordt: veld("beantwoordt", instr.beantwoordt),
    gebruik: veld("gebruik", instr.gebruik),
    doelgroep: veld("doelgroep", instr.doelgroep),
    rapportTeaser: veld("rapportTeaser", instr.rapportTeaser),
  };
}

function nlDatum(): string {
  const d = new Date();
  const maanden = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ];
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
}

/** Genereer een fiche-PDF-buffer voor één instrument. */
export async function genereerFichePdf(id: string, taal = "nl"): Promise<Buffer | null> {
  const basis = vindInstrumentServer(id);
  if (!basis) return null;
  const instr = instrumentMetOverrides(basis, taal);
  const accent = kleurVoor(instr.orientatie as Orientatie);

  const doc = nieuwGidsDocument(
    `TaPas Instrumentfiche — ${instr.naam}`,
    "De Instrumentengids · instrumentfiche"
  );

  const chunks: Buffer[] = [];
  const klaar = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ── Cover ──
  doc.addPage();
  tekenCover(doc, {
    kicker: "Instrumentfiche",
    titel1: instr.naam,
    ondertitel: instr.omschrijving,
    accent,
    contextLabel: orientatieLabelPdf(instr.orientatie as Orientatie),
    contextTekst: `${instr.eyebrow}  ·  Doelgroep: ${instr.doelgroep}`,
    datum: nlDatum(),
  });

  // ── Body ──
  doc.addPage();
  const L = new GidsLayout(
    doc,
    `Fiche · ${instr.naam}`,
    orientatieLabelPdf(instr.orientatie as Orientatie)
  );
  L.paintChrome();

  sectieKop(L, instr.eyebrow, "Wat is dit instrument?", accent);
  L.paragraph(instr.omschrijving, { after: 12 });

  if (instr.leeftijdsfocus) {
    calloutBox(L, "Leeftijdsfocus", instr.leeftijdsfocus, accent);
  }

  veldKop(L, "Welke vragen beantwoordt het?", accent);
  L.paragraph(instr.beantwoordt, { after: 12 });

  veldKop(L, "Hoe kan ik het verder gebruiken?", accent);
  L.paragraph(instr.gebruik, { after: 12 });

  veldKop(L, "Voor wie is het bedoeld?", accent);
  L.paragraph(instr.doelgroep, { after: 12 });

  calloutBox(L, "Wat je terugkrijgt", instr.rapportTeaser, accent);

  veldKop(L, "Hoe start je?", accent);
  L.paragraph(
    `${instr.start.label} — via ${instr.start.route}${
      instr.start.direct ? " (start meteen een afname)" : " (informatie- of aanvraagpagina)"
    }.`,
    { after: 6 }
  );

  // sluitzin
  const c = doc;
  c.font(F.inter).fontSize(8.5).fillColor(SUB);
  L.guardMm(12);
  c.text(
    "TaPas Platform · Talentgericht ontwikkelen voor business én onderwijs. " +
      "Deze fiche maakt deel uit van De Instrumentengids.",
    MARGIN,
    L.y,
    { width: CONTENT_W, lineGap: 3 }
  );

  doc.end();
  return klaar;
}

export { INSTRUMENTENGIDS };
