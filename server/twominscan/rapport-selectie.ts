// ---------------------------------------------------------------------------
// 2MINSCAN — Selectie van het vooraf ontwikkelde energetische rapport-PDF.
//
// WAAROM DIT BESTAAT
// De 2MINSCAN is een ENERGETISCH GEDRAGSPROFIEL (met knipoog naar Insights
// Discovery en MBTI). Het heeft NIETS te maken met het TaPas talentprofiel of
// met drivers (Taibi Kahler). De 24 profielen zijn reeds volledig ontwikkeld
// en in eigen layout omgezet in 5 talen (nl/fr/en/es/ru) = 120 statische PDF's
// onder client/public/twominscan-rapporten/{taal}/.
//
// Deze module vertaalt een EG-code (bv. "RgEEO-a" of de rauwe "RgXO-a" met X)
// naar het exacte PDF-bestand. De mapping is deterministisch bewezen:
// 24 client-profielen -> 24 bestanden, 100% dekking, nul mismatch.
//
// Naamgevingsregel (bewezen):
//   bestand = {kleur}_{code}_{taal}.pdf
//   waarbij code = egCode met  X -> {EE|II|IE},  "/" -> "_",  "-" -> "_"
// ---------------------------------------------------------------------------

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

export type Taal = "nl" | "fr" | "en" | "es" | "ru";
export const TALEN: Taal[] = ["nl", "fr", "en", "es", "ru"];

// De 24 geijkte profielen: rauwe EG-code (met X) -> {kleur, ieStand}.
// ieStand is de CONCRETE stand die in de bestandsnaam staat (bewezen in de
// mapping-verificatie: per profiel geeft precies één van EE/II/IE een bestand).
// KLEURVOLGORDE-SLEUTEL (bewezen bron van waarheid)
// -------------------------------------------------
// Elk van de 24 profielen heeft een UNIEKE volledige kleurvolgorde én een
// VASTE X-stand (EE/II/IE) die al in de bestandsnaam vervat zit. De 2MINSCAN
// meet twee dingen APART: (1) de kleurvolgorde, (2) de energetische stand
// (introvert II / extravert EE / ambivert IE). Samen wijzen die naar precies
// één van de 24 profielen. De kleurvolgorde identificeert het profiel volledig;
// de X-stand bevestigt de energetische band en dient als tie-breaker.
//
// BELANGRIJK: de X is GEEN vrije variabele die je zomaar in een kleur-gekozen
// code duwt. Er bestaan exact 24 profielen (niet 24×3). Daarom matchen we op de
// gemeten kleurvolgorde tegen de 24 echte profielen, zodat er ALTIJD een geldig
// bestaand rapport uitkomt — nooit een onbestaande combinatie zoals "RgEEN-a".
type KleurId = "rood" | "geel" | "groen" | "blauw";

interface ProfielMap {
  egCodeRaw: string;          // met X, zoals in client/src/twominscan/profielen.ts
  kleur: string;              // band-kleur = hoogste kleur (rood/geel/groen/blauw)
  ieStand: "EE" | "II" | "IE"; // VASTE stand uit de bestandsnaam
  volgorde: KleurId[];        // volledige 4-kleurenvolgorde (uniek per profiel)
}

export const PROFIEL_BESTAND_MAP: ProfielMap[] = [
  { egCodeRaw: "TbXO-g",   kleur: "rood",  ieStand: "EE", volgorde: ["rood","blauw","groen","geel"] },
  { egCodeRaw: "T/RbXO-g", kleur: "rood",  ieStand: "II", volgorde: ["rood","groen","blauw","geel"] },
  { egCodeRaw: "TbXO-z",   kleur: "rood",  ieStand: "IE", volgorde: ["rood","blauw","geel","groen"] },
  { egCodeRaw: "TbXN-z",   kleur: "rood",  ieStand: "EE", volgorde: ["rood","geel","blauw","groen"] },
  { egCodeRaw: "T/RbXN-a", kleur: "rood",  ieStand: "II", volgorde: ["rood","groen","geel","blauw"] },
  { egCodeRaw: "TbXN-a",   kleur: "rood",  ieStand: "IE", volgorde: ["rood","geel","groen","blauw"] },
  { egCodeRaw: "RgXN-z",   kleur: "geel",  ieStand: "EE", volgorde: ["geel","rood","blauw","groen"] },
  { egCodeRaw: "R/TgXN-z", kleur: "geel",  ieStand: "II", volgorde: ["geel","blauw","rood","groen"] },
  { egCodeRaw: "RgXN-a",   kleur: "geel",  ieStand: "IE", volgorde: ["geel","rood","groen","blauw"] },
  { egCodeRaw: "RgXO-a",   kleur: "geel",  ieStand: "EE", volgorde: ["geel","groen","rood","blauw"] },
  { egCodeRaw: "T/RbXN-g", kleur: "geel",  ieStand: "II", volgorde: ["geel","blauw","groen","rood"] },
  { egCodeRaw: "RgXO-b",   kleur: "geel",  ieStand: "IE", volgorde: ["geel","groen","blauw","rood"] },
  { egCodeRaw: "RzXN-a",   kleur: "groen", ieStand: "EE", volgorde: ["groen","geel","rood","blauw"] },
  { egCodeRaw: "R/TzXN-a", kleur: "groen", ieStand: "II", volgorde: ["groen","rood","geel","blauw"] },
  { egCodeRaw: "RzXN-b",   kleur: "groen", ieStand: "IE", volgorde: ["groen","geel","blauw","rood"] },
  { egCodeRaw: "RzXO-b",   kleur: "groen", ieStand: "EE", volgorde: ["groen","blauw","geel","rood"] },
  { egCodeRaw: "R/TzXO-g", kleur: "groen", ieStand: "II", volgorde: ["groen","rood","blauw","geel"] },
  { egCodeRaw: "RzXO-g",   kleur: "groen", ieStand: "IE", volgorde: ["groen","blauw","rood","geel"] },
  { egCodeRaw: "TaXO-b",   kleur: "blauw", ieStand: "EE", volgorde: ["blauw","groen","geel","rood"] },
  { egCodeRaw: "T/RaXO-b", kleur: "blauw", ieStand: "II", volgorde: ["blauw","geel","groen","rood"] },
  { egCodeRaw: "TaXO-g",   kleur: "blauw", ieStand: "IE", volgorde: ["blauw","groen","rood","geel"] },
  { egCodeRaw: "TaXN-b",   kleur: "blauw", ieStand: "EE", volgorde: ["blauw","rood","groen","geel"] },
  { egCodeRaw: "T/RaXN-z", kleur: "blauw", ieStand: "II", volgorde: ["blauw","geel","rood","groen"] },
  { egCodeRaw: "TaXN-z",   kleur: "blauw", ieStand: "IE", volgorde: ["blauw","rood","geel","groen"] },
];

// Normaliseer een taalcode naar een ondersteunde 2MINSCAN-taal (fallback nl).
export function normaliseer2msTaal(taal: unknown): Taal {
  const t = String(taal ?? "nl").toLowerCase().slice(0, 2);
  return (TALEN as string[]).includes(t) ? (t as Taal) : "nl";
}

// Zet een EG-code (rauw met X, OF al ingevuld met EE/II/IE) om naar het
// bestandsnaam-fragment: X -> ieStand, "/" -> "_", "-" -> "_".
function codeNaarFragment(egCodeRaw: string, ieStand: "EE" | "II" | "IE"): string {
  return egCodeRaw
    .replace("X", ieStand)
    .replace(/\//g, "_")
    .replace(/-/g, "_");
}

// Zoek het profiel op basis van een EG-code. Accepteert:
//   - rauwe code met X:      "RgXO-a"
//   - ingevulde code:        "RgEEO-a" / "RgIEO-b" / "R_TzIIN_a" (bestandsstijl)
//   - profielCode (= egCode) zoals client/src/twominscan/profielen.ts
export function vindProfiel(egCode: string): ProfielMap | null {
  if (!egCode) return null;
  const genormaliseerd = egCode.trim();

  // 1) Directe match op rauwe code (met X).
  const direct = PROFIEL_BESTAND_MAP.find((p) => p.egCodeRaw === genormaliseerd);
  if (direct) return direct;

  // 2) Match op ingevulde code: vervang de X-positie door de ieStand van elk
  //    profiel en vergelijk. Tolerant voor "/" vs "_" en "-" vs "_".
  const doel = genormaliseerd.replace(/\//g, "_").replace(/-/g, "_").toUpperCase();
  for (const p of PROFIEL_BESTAND_MAP) {
    const ingevuld = codeNaarFragment(p.egCodeRaw, p.ieStand).toUpperCase();
    if (ingevuld === doel) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ROBUUSTE SELECTIE op (kleurvolgorde + gemeten X-stand).
//
// Dit is de correcte weg volgens de 2MINSCAN-methode: de vragenlijst meet de
// kleurvolgorde EN, apart, de energetische stand (II/EE/IE). Samen wijzen die
// naar precies één van de 24 profielen. De kleurvolgorde is uniek per profiel en
// dus de sterkste identifier; de X-stand bevestigt de energetische band en
// breekt de knoop bij een onvolledige kleurmatch. Er komt ALTIJD een geldig
// bestaand profiel uit — nooit een onbestaande code zoals "RgEEN-a".
// ---------------------------------------------------------------------------
export function kiesOpKleurvolgorde(
  volgorde: KleurId[],
  xStand?: "II" | "EE" | "IE" | "X" | null,
): ProfielMap {
  if (!Array.isArray(volgorde) || volgorde.length < 2) {
    throw new Error("2MINSCAN: onvolledige kleurvolgorde — kan geen profiel bepalen.");
  }
  // Normaliseer X (ambivert) naar IE; de bestanden gebruiken IE voor ambivert.
  const gewensteStand = xStand === "EE" || xStand === "II" ? xStand : xStand === "IE" ? "IE" : null;

  const beoordeeld = PROFIEL_BESTAND_MAP.map((p) => {
    let punten = 0;
    // Volledige kleurvolgorde, hoogste posities zwaarst gewogen.
    if (p.volgorde[0] === volgorde[0]) punten += 100;
    if (p.volgorde[1] === volgorde[1]) punten += 40;
    if (p.volgorde[2] === volgorde[2]) punten += 10;
    if (p.volgorde[3] === volgorde[3]) punten += 4;
    // X-stand als bevestiging/tie-breaker (lager gewicht dan de kleurvolgorde,
    // zodat de kleurvolgorde altijd leidend blijft).
    if (gewensteStand && p.ieStand === gewensteStand) punten += 3;
    return { p, punten };
  }).sort((a, b) => b.punten - a.punten);

  return beoordeeld[0].p;
}

// Bouw de kandidaat-bestandspaden (met fallbacks, spiegelt server/gids/pdf-engine.ts).
export function bestandsKandidaten(bestandsnaam: string, taal: Taal): string[] {
  const rel = path.join("twominscan-rapporten", taal, bestandsnaam);
  return [
    path.join(process.cwd(), "client", "public", rel),
    path.join(process.cwd(), "dist", "public", rel),
    path.join(process.cwd(), "public", rel),
  ];
}

export interface SelectieResultaat {
  profiel: ProfielMap;
  taal: Taal;
  bestandsnaam: string;
  pad: string;
}

// Kies het PDF-bestand voor een reeds bepaald profiel + taal (met taal-fallback).
export function bestandVoorProfiel(profiel: ProfielMap, taalIn: unknown): SelectieResultaat {
  const taal = normaliseer2msTaal(taalIn);
  const fragment = codeNaarFragment(profiel.egCodeRaw, profiel.ieStand);
  const bestandsnaam = `${profiel.kleur}_${fragment}_${taal}.pdf`;

  for (const kandidaat of bestandsKandidaten(bestandsnaam, taal)) {
    if (existsSync(kandidaat)) {
      return { profiel, taal, bestandsnaam, pad: kandidaat };
    }
  }
  // Taal-fallback naar nl als de gevraagde taal ontbreekt.
  if (taal !== "nl") {
    const nlNaam = `${profiel.kleur}_${fragment}_nl.pdf`;
    for (const kandidaat of bestandsKandidaten(nlNaam, "nl")) {
      if (existsSync(kandidaat)) {
        return { profiel, taal: "nl", bestandsnaam: nlNaam, pad: kandidaat };
      }
    }
  }
  throw new Error(`2MINSCAN: rapport-PDF niet gevonden voor "${bestandsnaam}".`);
}

// Hoofdfunctie (EG-code-pad): kies het juiste PDF-bestand voor een EG-code + taal.
// Gooit een sprekende fout als code onbekend is of het bestand ontbreekt.
export function kiesRapportBestand(egCode: string, taalIn: unknown): SelectieResultaat {
  const profiel = vindProfiel(egCode);
  if (!profiel) {
    throw new Error(`2MINSCAN: onbekende EG-code "${egCode}" — geen geijkt profiel gevonden.`);
  }
  return bestandVoorProfiel(profiel, taalIn);
}

// Lees de gekozen PDF als buffer (EG-code-pad).
export function leesRapportBuffer(egCode: string, taal: unknown): { buffer: Buffer; selectie: SelectieResultaat } {
  const selectie = kiesRapportBestand(egCode, taal);
  return { buffer: readFileSync(selectie.pad), selectie };
}

// ---------------------------------------------------------------------------
// Naam + datum injecteren op pagina 1, met behoud van de bestaande layout.
//
// De brontemplate toont op pagina 1:
//   NAAM        —            (placeholder, waarde-x ~= 153, top-y ~= 298-307)
//   DATUM       13/06/2026   (waarde-x ~= 153, top-y ~= 322-334)
// We tekenen een rechthoek in de paginakleur over de bestaande waarde en
// schrijven er de deelnemersnaam/afnamedatum overheen. De rest van het
// rapport (14 secties, eigen layout, 5 talen) blijft volledig ongemoeid.
//
// pdf-lib gebruikt een assenstelsel met oorsprong LINKSONDER; pdftotext-bbox
// gebruikt LINKSBOVEN. Conversie: y_pdf = paginaHoogte - y_top.
// ---------------------------------------------------------------------------
export interface InjectieOpties {
  naam?: string | null;
  datum?: string | null; // vrije tekst, bv. "18/07/2026"
}

// Achtergrondkleur van de PDF-template. De cover-pagina gebruikt een WITTE
// achtergrond (geverifieerd via pixel-probe op de gerenderde PDF; de crème
// #F6F4EF uit theme.ts geldt enkel voor de web-weergave). We dekken de
// placeholder af met wit zodat de overlay onzichtbaar aansluit.
const PAGINA_ACHTERGROND = { r: 1, g: 1, b: 1 };
const INKT = { r: 31 / 255, g: 42 / 255, b: 40 / 255 }; // #1F2A28 body-tekst

// Posities (top-left, uit pdftotext -bbox op de A4-template).
const WAARDE_X = 153;                 // x waar NAAM/DATUM-waarde begint
const NAAM_TOP_Y = 297.8;             // yMin van de NAAM-waardregel
const NAAM_HOOGTE = 13;               // regelhoogte om af te dekken
const DATUM_TOP_Y = 321.8;            // yMin van de DATUM-waardregel
const DATUM_HOOGTE = 13;
const DEK_BREEDTE = 380;             // breed genoeg voor lange namen

export async function injecteerNaamDatum(
  pdfBuffer: Buffer,
  opts: InjectieOpties,
): Promise<Buffer> {
  const naam = (opts.naam ?? "").trim();
  const datum = (opts.datum ?? "").trim();
  // Niets in te vullen -> geef de originele buffer terug.
  if (!naam && !datum) return pdfBuffer;

  // Dynamische import zodat de module ook zonder pdf-lib laadbaar blijft
  // (bv. in de selectie-only unit tests).
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pagina = doc.getPages()[0];
  const hoogte = pagina.getHeight();
  const achtergrond = rgb(PAGINA_ACHTERGROND.r, PAGINA_ACHTERGROND.g, PAGINA_ACHTERGROND.b);
  const inkt = rgb(INKT.r, INKT.g, INKT.b);

  const teken = (waarde: string, topY: number, dekHoogte: number, vet: boolean) => {
    // 1) Dek de bestaande placeholder af.
    pagina.drawRectangle({
      x: WAARDE_X - 2,
      y: hoogte - topY - dekHoogte + 2,
      width: DEK_BREEDTE,
      height: dekHoogte + 3,
      color: achtergrond,
    });
    // 2) Schrijf de nieuwe waarde (baseline iets boven de onderkant).
    pagina.drawText(waarde, {
      x: WAARDE_X,
      y: hoogte - topY - dekHoogte + 4,
      size: 10.5,
      font: vet ? bold : font,
      color: inkt,
    });
  };

  if (naam) teken(naam, NAAM_TOP_Y, NAAM_HOOGTE, true);
  if (datum) teken(datum, DATUM_TOP_Y, DATUM_HOOGTE, true);

  const uit = await doc.save();
  return Buffer.from(uit);
}

// Volledige helper (EG-code-pad): kies + lees + injecteer in één stap.
export async function genereer2msRapportPdf(
  egCode: string,
  taal: unknown,
  opts: InjectieOpties = {},
): Promise<{ buffer: Buffer; selectie: SelectieResultaat }> {
  const { buffer, selectie } = leesRapportBuffer(egCode, taal);
  const uit = await injecteerNaamDatum(buffer, opts);
  return { buffer: uit, selectie };
}

// ROBUUSTE helper: kies op (kleurvolgorde + X-stand) -> lees -> injecteer.
// Dit is het aanbevolen pad: het levert ALTIJD één van de 24 bestaande profielen
// en kan dus nooit een 404 op een onbestaande code veroorzaken.
export async function genereer2msRapportOpVolgorde(
  volgorde: KleurId[],
  xStand: "II" | "EE" | "IE" | "X" | null | undefined,
  taal: unknown,
  opts: InjectieOpties = {},
): Promise<{ buffer: Buffer; selectie: SelectieResultaat }> {
  const profiel = kiesOpKleurvolgorde(volgorde, xStand ?? null);
  const selectie = bestandVoorProfiel(profiel, taal);
  const buffer = readFileSync(selectie.pad);
  const uit = await injecteerNaamDatum(buffer, opts);
  return { buffer: uit, selectie };
}
