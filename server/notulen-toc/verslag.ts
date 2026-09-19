// ---------------------------------------------------------------------------
// server/notulen-toc/verslag.ts  -  NIEUW BESTAND
//
// Stap drie van de omzetting: de herkende inhoud wordt een Word-document in de
// vorm van het vaste verslagmodel. Dertien rubrieken, altijd alle dertien, ook
// wanneer er niets te melden is. Die vaste opbouw is de hele reden van het
// model: wie twee verslagen naast elkaar legt, vindt een onderwerp op dezelfde
// plaats.
//
// Waar de beknopte notulen niets zeggen, schrijft het verslag "nog te bepalen"
// of "niet behandeld in dit overleg". Een lege cel zou de lezer laten denken dat
// het punt niet bestaat; een zichtbare leemte is een werkpunt voor de volgende
// vergadering.
//
// Dit bestand maakt ook het invulblad voor beknopte notulen. Dat blad draagt
// precies de koppen en etiketten die de herkenning leest, zodat een verslaggever
// die het blad gebruikt, een omzetting krijgt zonder restjes.
// ---------------------------------------------------------------------------
import { Paragraph, TextRun } from "docx";
import {
  body,
  buildDoc,
  bullet,
  callout,
  fillLine,
  GREY,
  h1,
  h2,
  hint,
  label,
  logoParagraph,
  metaTable,
  pageBreak,
  rich,
  spacer,
  table,
  titleBlock,
  baseline,
  type Blok,
} from "./huisstijl";
import {
  KERNVELD_LABEL,
  KERNVELDEN,
  THEMAS,
  schoonTekst,
  type Kernveld,
  type VerslagInhoud,
} from "./model";

const NIETS_BEPAALD = "nog te bepalen";
const NIET_BEHANDELD = "Niet behandeld in dit overleg.";

/** Invulhulp per kernveld, gebruikt wanneer het veld ontbreekt. */
const KERN_HULP: Record<Kernveld, string> = {
  vergadering: "Team of Captains (TOC), nummer nog te bepalen",
  datumEnUur: "datum en uur nog te bepalen",
  locatie: "locatie nog te bepalen",
  voorzitter: NIETS_BEPAALD,
  verslaggever: NIETS_BEPAALD,
  aanwezig: NIETS_BEPAALD,
  verontschuldigd: "geen",
  gast: "geen",
  verspreiding: "Team of Captains, raad van bestuur, PMV",
  status: "ontwerp ter nalezing",
  vertrouwelijkheid: "vertrouwelijk, uitsluitend voor aandeelhouders en investeringspartners",
  volgende: NIETS_BEPAALD,
};

export interface VerslagOpties {
  /** Regel rechts in de hoofding, bijvoorbeeld "Verslag TOC 17.09.2026". */
  headerRight?: string;
  /** Regel links in de voetregel. */
  footerLeft?: string;
}

/** Datum uit de kerngegevens in de vorm dd.mm.jjjj, of een lege tekst. */
function datumKort(inhoud: VerslagInhoud): string {
  const ruw = inhoud.kerngegevens.datumEnUur ?? "";
  const m = ruw.match(/([0-3]?\d)[\.\/\-]([01]?\d)[\.\/\-](\d{4})/);
  if (m) return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`;
  return "";
}

/** Bestandsnaam voor het afgewerkte verslag. */
export function bestandsnaamVoor(inhoud: VerslagInhoud): string {
  const datum = datumKort(inhoud).replace(/\./g, "-");
  const staart = datum === "" ? "zonder-datum" : datum;
  return `TaPasCity-Verslag-Team-of-Captains-${staart}.docx`;
}

/**
 * Bouwt het volledige verslag volgens het vaste model en levert de docx-buffer.
 */
export async function bouwVerslag(inhoud: VerslagInhoud, opties: VerslagOpties = {}): Promise<Buffer> {
  const datum = datumKort(inhoud);
  const kinderen: Blok[] = [];

  kinderen.push(
    logoParagraph(),
    titleBlock({
      kicker: "Team of Captains (TOC)",
      title: "Verslag Team of Captains",
      subtitle:
        datum === ""
          ? "Verslag voor de opvolging door aandeelhouders en investeringspartners"
          : `Vergadering van ${datum}, verslag voor de opvolging door aandeelhouders en investeringspartners`,
    }),
    spacer(240),
  );

  // ---------------------------------------------------------------- 1
  kinderen.push(h1("1", "Kerngegevens van de vergadering"), spacer(80));
  kinderen.push(
    metaTable(
      KERNVELDEN.map((veld) => {
        const waarde = (inhoud.kerngegevens[veld] ?? "").trim();
        const label = KERNVELD_LABEL[veld];
        if (waarde === "") return [label, { text: KERN_HULP[veld], placeholder: true }] as [string, { text: string; placeholder: boolean }];
        return [label, schoonTekst(waarde)] as [string, string];
      }),
    ),
  );

  // ---------------------------------------------------------------- 2
  kinderen.push(h1("2", "Doel en leeswijzer"));
  if (inhoud.doel.length > 0) {
    for (const regel of inhoud.doel) kinderen.push(body(afgerond(regel)));
  } else {
    kinderen.push(
      hint("Twee tot vier zinnen over de aanleiding van dit overleg en over wat de lezer hier mag verwachten."),
      ...fillLine(3),
    );
  }
  kinderen.push(
    body(
      "Dit verslag volgt het vaste verslagmodel van het Team of Captains. Elke rubriek blijft staan, ook wanneer er niets te melden is, zodat twee verslagen naast elkaar leesbaar blijven.",
      { size: 19, color: GREY },
    ),
  );

  // ---------------------------------------------------------------- 3
  kinderen.push(h1("3", "Kernboodschap voor aandeelhouders en investeringspartners"));
  if (inhoud.kernboodschap.length > 0) {
    for (const punt of inhoud.kernboodschap.slice(0, 6)) kinderen.push(bullet(afgerond(punt)));
  } else {
    kinderen.push(
      hint("Maximaal vijf punten: voortgang, besluit met gevolg, risico met maatregel, vraag aan de investeerder."),
      ...fillLine(3),
    );
  }

  // ---------------------------------------------------------------- 4
  kinderen.push(h1("4", "Vorig verslag en opvolging van de acties"));
  const vaststelling =
    inhoud.vaststellingVorigVerslag.length > 0
      ? inhoud.vaststellingVorigVerslag.map(afgerond)
      : [
          "De beknopte notulen zeggen hier niets over. Vul dit punt aan, of vermeld dat dit de eerste vergadering van het Team of Captains is.",
        ];
  kinderen.push(callout(vaststelling, { kop: "Vaststelling" }), spacer(200));
  if (inhoud.opvolging.length > 0) {
    kinderen.push(
      table(
        ["Nr.", "Actie uit vorig verslag", "Eigenaar", "Afgesproken datum", "Stand"],
        inhoud.opvolging.map((r) => [r.nr, r.actie, r.eigenaar, r.datum, r.stand]),
        [700, 4438, 1400, 1550, 1550],
      ),
    );
  } else {
    kinderen.push(
      body("Er zijn geen acties uit een vorig verslag om op te volgen.", { color: GREY, size: 19 }),
    );
  }

  // ---------------------------------------------------------------- 5
  kinderen.push(pageBreak(), h1("5", "Bespreking per thema"));
  kinderen.push(
    body(
      "Negen vaste thema's, elk in drie blokken: de stand van zaken, de bespreking, en het besluit of de afspraak.",
      { color: GREY, size: 19 },
    ),
  );
  THEMAS.forEach((thema, idx) => {
    const blok = inhoud.themas[thema.letter];
    const leeg = blok.stand.length + blok.bespreking.length + blok.besluiten.length === 0;
    kinderen.push(h2(`5.${idx + 1}  ${thema.letter}. ${thema.titel}`));
    if (leeg) {
      kinderen.push(body(NIET_BEHANDELD, { color: GREY, italics: true }));
      return;
    }
    if (blok.stand.length > 0) {
      kinderen.push(label("Stand van zaken"));
      for (const regel of blok.stand) kinderen.push(body(afgerond(regel)));
    }
    if (blok.bespreking.length > 0) {
      kinderen.push(label("Bespreking"));
      for (const regel of blok.bespreking) kinderen.push(bullet(afgerond(regel)));
    }
    if (blok.besluiten.length > 0) {
      kinderen.push(
        spacer(80),
        callout(
          blok.besluiten.map((b) => `Besluit: ${afgerond(b)}`),
          { kop: "Besluit of afspraak" },
        ),
        spacer(140),
      );
    }
  });

  // ---------------------------------------------------------------- 6
  kinderen.push(pageBreak(), h1("6", "Besluitenregister"));
  if (inhoud.besluiten.length > 0) {
    kinderen.push(
      table(
        ["Nr.", "Besluit", "Thema", "Eigenaar"],
        inhoud.besluiten.map((b) => [b.nr, afgerond(b.tekst), b.thema, b.eigenaar]),
        [900, 5188, 2000, 1550],
      ),
    );
  } else {
    kinderen.push(leegRegister("Er is in dit overleg geen enkel besluit vastgelegd."));
  }

  // ---------------------------------------------------------------- 7
  kinderen.push(h1("7", "Actieregister"));
  if (inhoud.acties.length > 0) {
    kinderen.push(
      table(
        ["Nr.", "Actie", "Eigenaar", "Deadline", "Prioriteit"],
        inhoud.acties.map((a) => [a.nr, afgerond(a.tekst), a.eigenaar, a.deadline, a.prioriteit]),
        [800, 4338, 1400, 1550, 1550],
      ),
    );
  } else {
    kinderen.push(leegRegister("Er is in dit overleg geen enkele actie afgesproken."));
  }

  // ---------------------------------------------------------------- 8
  kinderen.push(h1("8", "Openstaande punten en te nemen beslissingen"));
  if (inhoud.openPunten.length > 0) {
    kinderen.push(
      table(
        ["Punt", "Wat ontbreekt om te beslissen", "Terug op de agenda"],
        inhoud.openPunten.map((p) => [afgerond(p.punt), p.ontbreekt, p.terug]),
        [3000, 4638, 2000],
      ),
    );
  } else {
    kinderen.push(leegRegister("Er staan geen punten open."));
  }

  // ---------------------------------------------------------------- 9
  kinderen.push(h1("9", "Risico's en beheersmaatregelen"));
  if (inhoud.risicos.length > 0) {
    kinderen.push(
      table(
        ["Risico", "Mogelijk gevolg", "Beheersmaatregel", "Eigenaar"],
        inhoud.risicos.map((r) => [afgerond(r.risico), r.gevolg, r.maatregel, r.eigenaar]),
        [2600, 2200, 3288, 1550],
      ),
    );
  } else {
    kinderen.push(leegRegister("Er zijn in dit overleg geen risico's benoemd."));
  }

  // ---------------------------------------------------------------- 10
  kinderen.push(h1("10", "Vraag en verwachting richting de investeringspartner"));
  if (inhoud.vragen.length > 0) {
    kinderen.push(
      table(
        ["Vraag", "Waarom nu", "Gevraagd tegen"],
        inhoud.vragen.map((v) => [afgerond(v.vraag), v.waarom, v.tegen]),
        [3400, 4238, 2000],
      ),
    );
  } else {
    kinderen.push(leegRegister("Er ligt vandaag geen vraag bij de investeringspartner."));
  }

  // ---------------------------------------------------------------- 11
  kinderen.push(h1("11", "Werkafspraken en vergaderkalender"));
  if (inhoud.werkafspraken.length > 0) {
    for (const afspraak of inhoud.werkafspraken) kinderen.push(bullet(afgerond(afspraak)));
  } else {
    kinderen.push(body("Er zijn geen nieuwe werkafspraken vastgelegd.", { color: GREY, size: 19 }));
  }
  const volgende = (inhoud.kerngegevens.volgende ?? "").trim();
  kinderen.push(
    bullet(volgende === "" ? "Volgende vergadering: nog te bepalen." : `Volgende vergadering: ${afgerond(volgende)}`),
  );

  // ---------------------------------------------------------------- 12
  kinderen.push(h1("12", "Goedkeuring"));
  kinderen.push(
    body(
      "Dit verslag is goedgekeurd wanneer geen van de aanwezigen binnen vijf werkdagen na verzending een aanpassing vraagt.",
    ),
    spacer(160),
  );
  const goedkeurders =
    inhoud.goedkeurders.length > 0
      ? inhoud.goedkeurders.map((g) => [g.naam, g.rol, g.op === "" ? "" : g.op])
      : [
          [inhoud.kerngegevens.voorzitter ?? "", "voorzitter", ""],
          [inhoud.kerngegevens.verslaggever ?? "", "verslaggever", ""],
          ["", "", ""],
        ];
  kinderen.push(table(["Naam", "Rol", "Goedgekeurd op"], goedkeurders, [3600, 3838, 2200]));

  // ---------------------------------------------------------------- 13
  kinderen.push(h1("13", "Bijlagen"));
  if (inhoud.bijlagen.length > 0) {
    inhoud.bijlagen.forEach((b, i) => kinderen.push(bullet(`Bijlage ${i + 1}: ${afgerond(b)}`)));
  } else {
    kinderen.push(body("Bij dit verslag hoort geen bijlage.", { color: GREY, size: 19 }));
  }

  // -------------------------------------------------- restje, alleen indien nodig
  if (inhoud.nietGeplaatst.length > 0) {
    kinderen.push(
      pageBreak(),
      h1("14", "Nog te plaatsen uit de beknopte notulen"),
      body(
        "De omzetting kon deze regels niet met zekerheid in een rubriek plaatsen. Ze staan hier letterlijk, zodat niets verloren gaat. Geef ze een plaats en verwijder daarna deze rubriek.",
        { color: GREY, size: 19 },
      ),
    );
    for (const regel of inhoud.nietGeplaatst) kinderen.push(bullet(regel));
  }

  kinderen.push(spacer(320), baseline());

  const kopRechts = opties.headerRight ?? (datum === "" ? "Verslag TOC" : `Verslag TOC ${datum}`);
  const voetLinks =
    opties.footerLeft ??
    `Vertrouwelijk \u2022 TaPasCity, Team of Captains \u2022 ${datum === "" ? "verslag" : `verslag ${datum}`}`;

  return buildDoc({
    docTitle: "Verslag Team of Captains",
    headerRight: kopRechts,
    footerLeft: voetLinks,
    children: kinderen,
  });
}

function leegRegister(boodschap: string): Paragraph {
  return new Paragraph({
    spacing: { after: 130, line: 276 },
    children: [new TextRun({ text: boodschap, font: "Calibri", size: 19, color: GREY, italics: true })],
  });
}

/** Zorgt voor een punt achteraan een regel, zonder een bestaande punt te verdubbelen. */
function afgerond(ruw: string): string {
  const t = schoonTekst(ruw);
  if (t === "") return t;
  if (/[.!?:;]$/.test(t)) return t;
  return `${t}.`;
}

// ---------------------------------------------------------------------------
// Het invulblad voor beknopte notulen.
// ---------------------------------------------------------------------------

/**
 * Een kort Word-blad waarop een verslaggever tijdens de vergadering schrijft.
 * De koppen en de etiketten zijn precies die welke de omzetting leest, dus wie
 * dit blad gebruikt, krijgt een verslag zonder restjes.
 */
export async function bouwInvulblad(): Promise<Buffer> {
  const kinderen: Blok[] = [
    logoParagraph(),
    titleBlock({
      kicker: "Team of Captains (TOC)",
      title: "Beknopte notulen",
      subtitle: "Invulblad voor de vergadering, wordt in TAPAS CORE omgezet naar het vaste verslagmodel",
    }),
    spacer(240),
    rich([
      { t: "Zo werkt dit blad. ", b: true },
      {
        t: "Schrijf tijdens de vergadering kort mee onder de koppen hieronder. Laat de koppen staan zoals ze zijn, want de omzetting leest die koppen. Begin een regel met Besluit, Actie, Risico, Openstaand of Vraag, en de regel komt in het juiste register terecht. Bij een actie hoort een naam en een datum op dezelfde regel.",
      },
    ]),
    rich([
      { t: "Wat u niet hoeft te doen. ", b: true },
      {
        t: "U hoeft niets op te maken en u hoeft geen volledige zinnen te schrijven voor de registers. De opmaak, de nummering en de huisstijl komen uit de omzetting. Een regel die de omzetting niet begrijpt, verdwijnt nooit: die komt achteraan het verslag onder Nog te plaatsen.",
      },
    ]),
    spacer(200),
    h1("1", "Kerngegevens"),
    hint("Eén gegeven per regel, met een dubbele punt ertussen. Laat weg wat u niet weet."),
    metaTable(
      KERNVELDEN.map(
        (veld) =>
          [KERNVELD_LABEL[veld], { text: KERN_HULP[veld], placeholder: true }] as [
            string,
            { text: string; placeholder: boolean },
          ],
      ),
    ),
    h1("2", "Doel van dit overleg"),
    ...fillLine(2),
    h1("3", "Kernboodschap"),
    hint("Hoogstens vijf regels: wat een investeerder moet weten wanneer hij niets anders leest."),
    ...fillLine(4),
    h1("4", "Opvolging vorig verslag"),
    hint("Per regel: nummer, actie, eigenaar, afgesproken datum, stand. Of laat leeg bij een eerste vergadering."),
    ...fillLine(3),
    pageBreak(),
    h1("5", "Per thema"),
    hint(
      "Laat de negen koppen staan. Schrijf onder een kop wat besproken is. Begin een regel met Besluit om er een besluit van te maken.",
    ),
  ];

  for (const thema of THEMAS) {
    kinderen.push(h2(`${thema.letter}. ${thema.titel}`), ...fillLine(2));
  }

  kinderen.push(
    pageBreak(),
    h1("6", "Besluiten"),
    hint("Eén besluit per regel. Begin met Besluit: en zet er de eigenaar tussen ronde haakjes achter."),
    ...fillLine(4),
    h1("7", "Acties"),
    hint("Eén actie per regel, in de vorm: Actie: wat gebeurt er (naam) tegen dd.mm.jjjj."),
    ...fillLine(5),
    h1("8", "Openstaande punten"),
    hint("Begin met Openstaand: en vermeld wat ontbreekt om te kunnen beslissen."),
    ...fillLine(3),
    h1("9", "Risico's"),
    hint("Begin met Risico: en benoem het risico in gewone taal."),
    ...fillLine(3),
    h1("10", "Vragen aan de investeringspartner"),
    hint("Begin met Vraag aan PMV: en zet erbij tegen wanneer u het antwoord nodig hebt."),
    ...fillLine(3),
    h1("11", "Werkafspraken"),
    hint("Begin met Afspraak: . Vermeld hier ook de datum van de volgende vergadering."),
    ...fillLine(3),
    h1("12", "Bijlagen"),
    hint("Begin met Bijlage: en geef de titel."),
    ...fillLine(2),
    spacer(280),
    baseline(),
  );

  return buildDoc({
    docTitle: "Beknopte notulen, invulblad",
    headerRight: "Invulblad beknopte notulen",
    footerLeft: "Vertrouwelijk \u2022 TaPasCity, Team of Captains \u2022 invulblad versie 1.0",
    children: kinderen,
  });
}
