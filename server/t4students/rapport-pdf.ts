// ---------------------------------------------------------------------------
// server/t4students/rapport-pdf.ts
//
// Het tekenwerk. Dit bestand zet de pagina's en blokken die
// server/t4students/rapport-contract.ts beschrijft om in een PDF, en beslist
// verder niets. Welke pagina op welk blad komt en welke tekst erop staat, is al
// bepaald voor dit bestand aan de beurt is.
//
// GEEN TWEEDE NAMENLIJST
// Ook hier staat geen enkele constructnaam uitgeschreven. De tekenaar krijgt de
// namen binnen als gegevens en drukt ze af zoals ze aankomen.
//
// TWEE MATEN, TWEE VORMEN
// Herkenning en energie zijn verschillende dingen en krijgen daarom een andere
// vorm. Herkenning is een rij van drie blokjes die van links naar rechts vollopen
// en van 0 tot 3 gaat. Energie is een balkje dat in het midden begint en naar
// twee kanten kan uitslaan. Ze zijn nooit in elkaar om te rekenen en zien er
// nooit hetzelfde uit.
//
// HOOGTE WORDT GEMETEN, NIET GESCHAT
// Elk blok meldt eerst hoe hoog het wordt. Past het niet meer op het blad, dan
// begint een nieuw blad met dezelfde titel en het woord vervolg. Zo kan er geen
// tekst wegvallen onder de voetregel. Alleen de one-page is aan een blad
// vastgezet: die hoort op een blad te passen en meldt het in het verslag als dat
// niet lukt.
//
// SCHUINE LETTER
// De ingesloten letterfamilies hebben geen eigen cursief. Waar de blauwdruk om
// cursief vraagt, wordt de rechte letter scheefgetrokken. Dat is geen echte
// cursief; het staat in het verslag.
// ---------------------------------------------------------------------------

import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import {
  KLEUR,
  groepeerOpAandeel,
  type T4SBlok,
  type T4SGroep,
  type T4SPagina,
  type T4SRapport,
  type T4SRij,
  type T4SVorm,
} from "./rapport-contract";
import { F, registerFonts } from "../hdd/pdf/theme";

// ── Bladmaat en marges, uit blauwdruk 3.6 ───────────────────────────────────
const BLAD_B = 595.2756;
const BLAD_H = 841.8898;
const MARGE = 52;
const TEKST_B = 491;
const KOP_Y = 34;
const VOET_Y = BLAD_H - 46;
const BODEM = VOET_Y - 16;
/** De hoogte waarop de inhoud van een blad begint, onder de titel en de filet. */
const INHOUD_TOP = 150;

const VOETREGEL = "Een momentopname, geen oordeel of beslissing. · TaPasCity";

/** Zoveel wordt de rechte letter scheefgetrokken waar de blauwdruk cursief vraagt. */
const SCHUIN = 11;

export interface T4SPdfOpties {
  /** Het pad naar de coverfoto. Ontbreekt die, dan komt er een vlak in de plaats. */
  coverfoto?: string;
}

type Doc = PDFKit.PDFDocument;

// ── Kleine tekenhulpjes ─────────────────────────────────────────────────────

function vulRechthoek(doc: Doc, x: number, y: number, b: number, h: number, kleur: string, straal = 0): void {
  if (straal > 0) doc.roundedRect(x, y, b, h, straal).fill(kleur);
  else doc.rect(x, y, b, h).fill(kleur);
}

function lijn(doc: Doc, x1: number, y1: number, x2: number, y2: number, kleur: string, dikte = 0.6): void {
  doc.save().lineWidth(dikte).strokeColor(kleur).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
}

/** Kapitalen met wat luchtruimte ertussen, voor de kleine koppen. */
function kapitalen(doc: Doc, tekst: string, x: number, y: number, grootte: number, kleur: string): number {
  doc.font(F.dmBold).fontSize(grootte).fillColor(kleur);
  const ruimte = grootte * 0.09;
  meet(doc, tekst.toUpperCase(), MARGE + TEKST_B - x - ruimte * tekst.length, "kleine kop");
  doc.text(tekst.toUpperCase(), x, y, { characterSpacing: ruimte, width: TEKST_B, lineBreak: false });
  return grootte * 1.5;
}

function hoogteVan(doc: Doc, tekst: string, font: string, grootte: number, breedte: number, regelruimte = 3): number {
  doc.font(font).fontSize(grootte);
  return doc.heightOfString(tekst, { width: breedte, lineGap: regelruimte });
}

function schrijf(
  doc: Doc,
  tekst: string,
  x: number,
  y: number,
  breedte: number,
  font: string,
  grootte: number,
  kleur: string,
  regelruimte = 3,
  schuin = false,
): number {
  doc.font(font).fontSize(grootte).fillColor(kleur);
  const h = doc.heightOfString(tekst, { width: breedte, lineGap: regelruimte });
  doc.text(tekst, x, y, { width: breedte, lineGap: regelruimte, ...(schuin ? { oblique: SCHUIN } : {}) });
  return h;
}

function getal1(x: number): string {
  return x.toFixed(1).replace(".", ",");
}

/**
 * Toont herkenning met het aantal decimalen dat de rangorde nodig heeft
 * (T4SRij.weergavePrecisie / T4SBlok constructblok.weergavePrecisie). Zie
 * server/t4students/rapport-contract.ts, wijsPrecisieToe.
 */
function getalMetPrecisie(x: number, precisie: 1 | 2): string {
  return x.toFixed(precisie).replace(".", ",");
}

function getalMetTeken(x: number): string {
  const s = getal1(Math.abs(x));
  if (x > 0.049) return "+" + s;
  if (x < -0.049) return "-" + s;
  return "0,0";
}

// ── De bewaking op afgebroken tekst ─────────────────────────────────────────
//
// Een regel die niet mag afbreken en toch breder is dan de plaats die ze heeft,
// loopt over haar buurman of over de bladrand heen. Dat is met het blote oog
// makkelijk te missen, dus wordt het gemeten. Elke overschrijding komt in het
// verslag terecht.

let MELDINGEN: string[] = [];
let HUIDIG_BLAD = "";

/** Meet een regel die niet mag afbreken en meldt het wanneer ze niet past. */
function meet(doc: Doc, tekst: string, breedte: number, waar: string): void {
  if (!tekst) return;
  const b = doc.widthOfString(tekst);
  if (b > breedte + 0.5) {
    MELDINGEN.push(
      `${HUIDIG_BLAD}: de regel "${tekst}" is ${Math.round(b)} punten breed en heeft er ` +
        `${Math.round(breedte)} (${waar}). Ze loopt over haar plaats heen.`,
    );
  }
}

// ── De twee meetvormen ──────────────────────────────────────────────────────

const HERK_B = 92;
const ENERGIE_B = 92;
const BALK_H = 7.5;

/** Drie blokjes die van links naar rechts vollopen. Nul tot drie. */
function tekenHerkenning(doc: Doc, x: number, y: number, waarde: number | null, kleur: string): void {
  const gat = 3;
  const cel = (HERK_B - 2 * gat) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (cel + gat);
    vulRechthoek(doc, cx, y, cel, BALK_H, KLEUR.lijn, 1.2);
    if (waarde == null) continue;
    const deel = Math.max(0, Math.min(1, waarde - i));
    if (deel > 0.01) vulRechthoek(doc, cx, y, cel * deel, BALK_H, kleur, 1.2);
  }
}

/** Een balkje dat in het midden begint en naar twee kanten kan uitslaan. */
function tekenEnergie(doc: Doc, x: number, y: number, waarde: number | null, kleur: string): void {
  const midden = x + ENERGIE_B / 2;
  vulRechthoek(doc, x, y + BALK_H / 2 - 0.7, ENERGIE_B, 1.4, KLEUR.lijn);
  lijn(doc, midden, y - 1, midden, y + BALK_H + 1, KLEUR.inktZacht, 0.8);
  if (waarde == null) return;
  const halve = ENERGIE_B / 2 - 2;
  const lengte = Math.min(1, Math.abs(waarde) / 2) * halve;
  if (lengte < 0.8) {
    vulRechthoek(doc, midden - 1.2, y, 2.4, BALK_H, KLEUR.inktZacht, 1);
    return;
  }
  const vulkleur = waarde >= 0 ? kleur : KLEUR.accentDiep;
  if (waarde >= 0) vulRechthoek(doc, midden, y, lengte, BALK_H, vulkleur, 1.2);
  else vulRechthoek(doc, midden - lengte, y, lengte, BALK_H, vulkleur, 1.2);
}

/**
 * De vorm voor het energiesaldo van een driver: een driehoek omhoog voor
 * gaspedaal, een driehoek omlaag voor remmend, een liggend streepje voor
 * neutraal. Vorm en niet kleur draagt de betekenis, zodat de pagina ook leesbaar
 * blijft in zwart-wit en voor wie kleuren niet uit elkaar houdt.
 */
function tekenVorm(doc: Doc, x: number, y: number, vorm: T4SVorm, kleur: string): void {
  if (vorm === "geen") return;
  const b = 5.4;
  const h = 4.8;
  if (vorm === "vlak") {
    vulRechthoek(doc, x, y + h / 2 - 0.9, b, 1.8, KLEUR.inktZacht);
    return;
  }
  const omhoog = vorm === "stijgend";
  doc.save();
  doc.fillColor(omhoog ? kleur : KLEUR.accentDiep);
  if (omhoog) doc.moveTo(x + b / 2, y).lineTo(x + b, y + h).lineTo(x, y + h);
  else doc.moveTo(x, y).lineTo(x + b, y).lineTo(x + b / 2, y + h);
  doc.closePath().fill();
  doc.restore();
}

// ── Een rij in een rangorde ─────────────────────────────────────────────────

const RIJ_H = 27;
// Herstelronde 2, punt B: de kolom met het genummerde plaatscijfer (KOL_RANG)
// is vervallen. De constructnaam begint nu waar vroeger het cijfer begon, en
// KOL_NAAM_TOTAAL is de opgetelde breedte zodat de rest van de rij (herkenning,
// energie) op precies dezelfde plaats blijft staan als voorheen.
const KOL_NAAM_TOTAAL = 168;
const KOL_GAT = 11;

function tekenRijkoppen(doc: Doc, x: number, y: number): number {
  const xHerk = x + KOL_NAAM_TOTAAL;
  const xEner = xHerk + HERK_B + KOL_GAT;
  doc.font(F.dmBold).fontSize(6.6).fillColor(KLEUR.inktZacht);
  doc.text("HERKENNING", xHerk, y, { width: HERK_B, characterSpacing: 0.5, lineBreak: false });
  doc.text("ENERGIE VANDAAG", xEner, y, { width: ENERGIE_B + 40, characterSpacing: 0.5, lineBreak: false });
  return 11;
}

function tekenRij(doc: Doc, rij: T4SRij, x: number, y: number, kleur: string): number {
  const xHerk = x + KOL_NAAM_TOTAAL;
  const xEner = xHerk + HERK_B + KOL_GAT;
  const xWoord = xEner + ENERGIE_B + KOL_GAT;
  const woordB = TEKST_B - (xWoord - x);
  const midden = y + RIJ_H / 2;

  // Herstelronde 2, punt B: geen genummerd plaatscijfer meer voor de naam. De
  // groep (sterk aanwezig / middenveld / minder aanwezig) staat als kopje
  // boven een reeks rijen, niet meer als cijfer per rij.
  doc.font(rij.ingevuld ? F.dmMed : F.dm).fontSize(8.3).fillColor(rij.ingevuld ? KLEUR.inkt : KLEUR.inktZacht);
  meet(doc, rij.construct, KOL_NAAM_TOTAAL - 6, "constructnaam in een rangorde");
  doc.text(rij.construct, x, midden - 8.7, { width: KOL_NAAM_TOTAAL - 6, lineBreak: false, ellipsis: false });

  // Onderdeel C: de gewone omschrijving komt als kleiner lijntje onder de
  // constructnaam, zodat elke rangorde in het rapport zowel de vaste naam als
  // een gewone toelichting toont.
  if (rij.omschrijving) {
    doc.font(F.dm).fontSize(6.9).fillColor(KLEUR.inktZacht);
    meet(doc, rij.omschrijving, KOL_NAAM_TOTAAL - 6, "omschrijving in een rangorde");
    doc.text(rij.omschrijving, x, midden + 1.8, { width: KOL_NAAM_TOTAAL - 6, lineBreak: false, ellipsis: false });
  }

  if (!rij.ingevuld) {
    doc.font(F.dm).fontSize(7.4).fillColor(KLEUR.inktZacht);
    doc.text("Te weinig antwoorden", xHerk, midden - 3.8, { width: TEKST_B - (xHerk - x), lineBreak: false });
    return RIJ_H;
  }

  tekenHerkenning(doc, xHerk, midden - BALK_H / 2, rij.herkenning, kleur);
  tekenEnergie(doc, xEner, midden - BALK_H / 2, rij.energie, kleur);

  const cijfers =
    (rij.herkenning != null ? getalMetPrecisie(rij.herkenning, rij.weergavePrecisie) : "") +
    (rij.energie != null ? "  " + getalMetTeken(rij.energie) : "");
  doc.font(F.dm).fontSize(6.8).fillColor(KLEUR.inktZacht);
  doc.text(cijfers, xWoord, midden - 7.4, { width: woordB, lineBreak: false });
  const vormB = rij.vorm === "geen" ? 0 : 8;
  tekenVorm(doc, xWoord, midden + 1.4, rij.vorm, kleur);
  doc.font(F.dmMed).fontSize(7.2).fillColor(KLEUR.inkt);
  meet(doc, rij.leeswoord, woordB - vormB, "leeswoord in een rangorde");
  doc.text(rij.leeswoord, xWoord + vormB, midden + 0.4, { width: woordB - vormB, lineBreak: false });
  return RIJ_H;
}

/**
 * De haak links van twee of meer namen die even sterk zijn. Een haak per groep,
 * zodat het er niet uitziet als losse tekens naast elke naam apart.
 */
function tekenHaken(doc: Doc, rijen: T4SRij[], x: number, y: number): void {
  let i = 0;
  while (i < rijen.length) {
    if (!rijen[i].evenSterk) {
      i++;
      continue;
    }
    let eind = i;
    while (eind + 1 < rijen.length && rijen[eind + 1].evenSterk) eind++;
    const top = y + i * RIJ_H + 3;
    const bodem = y + (eind + 1) * RIJ_H - 3;
    doc.save().lineWidth(0.9).strokeColor(KLEUR.accent);
    doc.moveTo(x - 6, top).lineTo(x - 9, top).lineTo(x - 9, bodem).lineTo(x - 6, bodem).stroke();
    doc.restore();
    i = eind + 1;
  }
}

function hoogteRijen(rijen: T4SRij[]): number {
  return rijen.length * RIJ_H;
}

// Herstelronde 2, punt B: de titel van een van de drie groepen (sterk
// aanwezig, middenveld, minder aanwezig), boven een reeks rijen. Vervangt het
// genummerde plaatscijfer dat vroeger per rij stond.
const GROEPKOP_H = 18;

function tekenGroepkop(doc: Doc, groep: T4SGroep, x: number, y: number): number {
  const titel = groep.titel.charAt(0).toUpperCase() + groep.titel.slice(1);
  doc.font(F.dmBold).fontSize(8.6).fillColor(KLEUR.accentDiep);
  doc.text(titel, x, y + 2, { width: TEKST_B, characterSpacing: 0.3, lineBreak: false });
  return GROEPKOP_H + tekenRijkoppen(doc, x, y + GROEPKOP_H - 11);
}

// ── De hoogte van een blok, voor het getekend wordt ─────────────────────────

function blokHoogte(doc: Doc, blok: T4SBlok): number {
  switch (blok.soort) {
    case "intro":
      return hoogteVan(doc, blok.tekst, F.dm, 9.4, TEKST_B - 16, 3.4) + 22;
    case "alinea":
      return hoogteVan(doc, blok.tekst, F.dm, 9.2, TEKST_B, 3.6) + 9;
    case "tussenkop":
      return hoogteVan(doc, blok.tekst, F.dmBold, 9.6, TEKST_B, 2) + 14;
    case "banden": {
      let h = 0;
      for (const band of blok.banden) {
        h += 17 + 11 + hoogteRijen(band.rijen) + 13;
        if (band.noot) h += 11;
      }
      for (const r of blok.legende) h += hoogteVan(doc, r, F.dm, 7.6, TEKST_B, 2.4) + 3;
      for (const r of blok.naschrift) h += hoogteVan(doc, r, F.dm, 8, TEKST_B, 2.8) + 5;
      return h + 8;
    }
    case "rangtabel": {
      // Herstelronde 2, punt B: geen platte rijenlijst meer, maar drie
      // groepen (sterk aanwezig, middenveld, minder aanwezig), elk met een
      // eigen kopje. Een lege groep telt niet mee.
      const groepen = groepeerOpAandeel(blok.rijen);
      let h = 0;
      for (const g of groepen) h += GROEPKOP_H + hoogteRijen(g.rijen) + 8;
      // De niet-ingevulde rijen (T4SDimensie.zonderOordeel) staan altijd al
      // in blok.rijen mee (rangschik() voegt ze aan het eind toe) en horen
      // bij geen van de drie groepen; ze blijven zichtbaar onder een vierde,
      // ongetitelde sectie met dezelfde rijhoogte.
      const nietIngevuld = blok.rijen.filter((r) => r.groep == null);
      if (nietIngevuld.length > 0) h += hoogteRijen(nietIngevuld) + 8;
      for (const r of blok.naschrift) h += hoogteVan(doc, r, F.dm, 8.2, TEKST_B, 2.8) + 5;
      return h;
    }
    case "constructblok": {
      const h = hoogteVan(doc, blok.duiding, F.dm, 9, TEKST_B - 32, 3.4);
      return h + 46 + (blok.omschrijving ? 12 : 0);
    }
    case "citaat": {
      let h = 30;
      for (const r of blok.regels) {
        h += hoogteVan(doc, r.vraag, F.dm, 9.4, TEKST_B - 44, 2.8) + 4;
        h += hoogteVan(doc, r.herkenning || "", F.dmMed, 8.5, TEKST_B - 124, 1.5) + 3;
        if (r.energie) h += 11;
        if (r !== blok.regels[blok.regels.length - 1]) h += 5;
      }
      return h + 10;
    }
    case "batterij":
      return hoogteVan(doc, blok.zin, F.dm, 9.2, TEKST_B, 3.4) + 44;
    case "kolommen": {
      const kolB = (TEKST_B - 20) / 2;
      const kol = (rr: typeof blok.links): number => {
        let h = 0;
        for (const r of rr) {
          h += hoogteVan(doc, r.vraag, F.dm, 8.2, kolB - 10, 2) + 1.5;
          h += hoogteVan(doc, r.herkenning || "", F.dmMed, 8, kolB - 10, 1.5) + 3;
          if (r.energie) h += hoogteVan(doc, r.energie, F.dm, 7.6, kolB - 10, 1.5) + 2;
          h += 7;
        }
        return h;
      };
      return 16 + Math.max(kol(blok.links), kol(blok.rechts)) + 8;
    }
    case "opsomming": {
      let h = blok.kop ? 15 : 0;
      for (const p of blok.punten) h += hoogteVan(doc, p, F.dm, 9.2, TEKST_B - 18, 3) + 7;
      return h + 6;
    }
    case "kader":
      return hoogteVan(doc, blok.tekst, F.dm, 9, TEKST_B - 32, 3.2) + 40;
    case "paren": {
      const kolB = (TEKST_B - 12) / 2;
      let h = 0;
      for (let i = 0; i < blok.paren.length; i += 2) {
        const rij = blok.paren.slice(i, i + 2);
        h += Math.max(...rij.map((p) => hoogteVan(doc, p.waarde, F.dmMed, 10.5, kolB - 28, 2))) + 34;
      }
      return h + 4;
    }
    case "vragen": {
      let h = 16;
      for (const v of blok.vragen) h += hoogteVan(doc, v, F.dmMed, 9.2, TEKST_B - 16, 2.6) + 26;
      return h + 4;
    }
    case "ruimte":
      return blok.hoogte;
  }
}

// ── Het tekenen van een blok ────────────────────────────────────────────────

function tekenBlok(doc: Doc, blok: T4SBlok, y: number): number {
  const x = MARGE;
  switch (blok.soort) {
    case "intro": {
      const h = hoogteVan(doc, blok.tekst, F.dm, 9.4, TEKST_B - 16, 3.4);
      vulRechthoek(doc, x, y, TEKST_B, h + 16, KLEUR.papier2, 3);
      vulRechthoek(doc, x, y, 2.4, h + 16, KLEUR.accent, 1.2);
      schrijf(doc, blok.tekst, x + 13, y + 8, TEKST_B - 26, F.dm, 9.4, KLEUR.inkt, 3.4);
      return h + 22;
    }
    case "alinea":
      return schrijf(doc, blok.tekst, x, y, TEKST_B, F.dm, 9.2, KLEUR.inkt, 3.6) + 9;
    case "tussenkop": {
      const h = schrijf(doc, blok.tekst, x, y + 5, TEKST_B, F.dmBold, 9.6, KLEUR.accentDiep, 2);
      return h + 14;
    }
    case "banden": {
      let yy = y;
      for (const band of blok.banden) {
        doc.circle(x + 6, yy + 6.5, 6.5).fill(band.kleur);
        doc.font(F.dmBold).fontSize(7.4).fillColor("#FFFFFF");
        doc.text(String(band.nummer), x + 2.6, yy + 3.7, { width: 7, align: "center", lineBreak: false });
        doc.font(F.dmBold).fontSize(11).fillColor(band.kleur);
        meet(doc, band.titel, TEKST_B - 18, "bandkop");
        doc.text(band.titel, x + 18, yy + 2.2, { width: TEKST_B - 18, lineBreak: false });
        yy += 15;
        doc.font(F.dm).fontSize(8.2).fillColor(KLEUR.inktZacht);
        doc.text(band.onderschrift, x + 18, yy, { width: TEKST_B - 18, lineBreak: false, oblique: SCHUIN });
        yy += 12;
        if (band.noot) {
          doc.font(F.dm).fontSize(7.8).fillColor(KLEUR.inktZacht);
          doc.text(band.noot, x + 18, yy, { width: TEKST_B - 18, lineBreak: false, oblique: SCHUIN });
          yy += 11;
        }
        yy += tekenRijkoppen(doc, x, yy) - 11;
        yy += 11;
        tekenHaken(doc, band.rijen, x, yy);
        for (const rij of band.rijen) yy += tekenRij(doc, rij, x, yy, band.kleur);
        yy += 3;
        lijn(doc, x, yy, x + TEKST_B, yy, KLEUR.lijn);
        yy += 10;
      }
      for (const r of blok.naschrift) yy += schrijf(doc, r, x, yy, TEKST_B, F.dm, 8, KLEUR.inkt, 2.8) + 5;
      for (const r of blok.legende) yy += schrijf(doc, r, x, yy, TEKST_B, F.dm, 7.6, KLEUR.inktZacht, 2.4) + 3;
      return yy - y + 8;
    }
    case "rangtabel": {
      let yy = y;
      const groepen = groepeerOpAandeel(blok.rijen);
      for (const g of groepen) {
        yy += tekenGroepkop(doc, g, x, yy);
        tekenHaken(doc, g.rijen, x, yy);
        for (const rij of g.rijen) yy += tekenRij(doc, rij, x, yy, blok.kleur);
        yy += 8;
      }
      const nietIngevuld = blok.rijen.filter((r) => r.groep == null);
      if (nietIngevuld.length > 0) {
        for (const rij of nietIngevuld) yy += tekenRij(doc, rij, x, yy, blok.kleur);
        yy += 8;
      }
      for (const r of blok.naschrift) yy += schrijf(doc, r, x, yy, TEKST_B, F.dm, 8.2, KLEUR.inktZacht, 2.8) + 5;
      return yy - y;
    }
    case "constructblok": {
      const verschuiving = blok.omschrijving ? 12 : 0;
      const h = hoogteVan(doc, blok.duiding, F.dm, 9, TEKST_B - 32, 3.4);
      const totaal = h + 40 + verschuiving;
      vulRechthoek(doc, x, y, TEKST_B, totaal, KLEUR.kaart, 4);
      vulRechthoek(doc, x, y, 3, totaal, blok.kleur, 1.5);
      doc.save().lineWidth(0.5).strokeColor(KLEUR.lijn).roundedRect(x, y, TEKST_B, totaal, 4).stroke().restore();

      // Herstelronde 2, punt B: geen genummerd plaatscijfer meer voor de
      // naam; de constructnaam begint waar vroeger het cijfer stond.
      doc.font(F.dmBold).fontSize(11).fillColor(KLEUR.inkt);
      meet(doc, blok.construct, TEKST_B - 214, "constructnaam in een constructblok");
      doc.text(blok.construct, x + 14, y + 11, { width: TEKST_B - 214, lineBreak: false });

      // Onderdeel C: de gewone omschrijving komt als kleiner lijntje onder de
      // constructnaam, net als in de rangordes. Het blok wordt hoger gemaakt
      // (verschuiving) zodat dit extra lijntje niet over de duiding heen valt.
      if (blok.omschrijving) {
        doc.font(F.dm).fontSize(7.4).fillColor(KLEUR.inktZacht);
        meet(doc, blok.omschrijving, TEKST_B - 214, "omschrijving in een constructblok");
        doc.text(blok.omschrijving, x + 14, y + 24.5, { width: TEKST_B - 214, lineBreak: false });
      }

      const xHerk = x + TEKST_B - 14 - HERK_B - KOL_GAT - ENERGIE_B;
      if (blok.ingevuld) {
        tekenHerkenning(doc, xHerk, y + 12, blok.herkenning, blok.kleur);
        tekenEnergie(doc, xHerk + HERK_B + KOL_GAT, y + 12, blok.energie, blok.kleur);
        doc.font(F.dm).fontSize(6.6).fillColor(KLEUR.inktZacht);
        doc.text(
          "HERKENNING " + (blok.herkenning != null ? getalMetPrecisie(blok.herkenning, blok.weergavePrecisie) : ""),
          xHerk,
          y + 22.5,
          { width: HERK_B, lineBreak: false },
        );
        doc.text(
          "ENERGIE " + (blok.energie != null ? getalMetTeken(blok.energie) : ""),
          xHerk + HERK_B + KOL_GAT,
          y + 22.5,
          { width: ENERGIE_B, lineBreak: false },
        );
      } else {
        doc.font(F.dm).fontSize(7.6).fillColor(KLEUR.inktZacht);
        doc.text("Te weinig antwoorden", xHerk, y + 14, { width: HERK_B + ENERGIE_B + KOL_GAT, lineBreak: false });
      }
      schrijf(doc, blok.duiding, x + 16, y + 32 + verschuiving, TEKST_B - 32, F.dm, 9, KLEUR.inkt, 3.4);
      return totaal + 6;
    }
    case "citaat": {
      let h = 20;
      for (const r of blok.regels) {
        h += hoogteVan(doc, r.vraag, F.dm, 9.4, TEKST_B - 44, 2.8) + 4;
        h += hoogteVan(doc, r.herkenning || "", F.dmMed, 8.5, TEKST_B - 124, 1.5) + 3;
        if (r.energie) h += 11;
        if (r !== blok.regels[blok.regels.length - 1]) h += 5;
      }
      vulRechthoek(doc, x, y, TEKST_B, h, KLEUR.okerZacht, 3);
      vulRechthoek(doc, x, y, 2.2, h, blok.kleur, 1.1);
      kapitalen(doc, blok.kop, x + 16, y + 9, 6.8, KLEUR.oker);
      doc.font(F.dmBold).fontSize(20).fillColor(KLEUR.oker);
      doc.text("“", x + 12, y + 17, { width: 20, lineBreak: false });
      let yy = y + 22;
      blok.regels.forEach((r, i) => {
        const vh = hoogteVan(doc, r.vraag, F.dm, 9.4, TEKST_B - 44, 2.8);
        doc.font(F.dm).fontSize(9.4).fillColor(KLEUR.inkt);
        doc.text(r.vraag, x + 30, yy, { width: TEKST_B - 44, lineGap: 2.8, oblique: SCHUIN });
        yy += vh + 4;
        doc.font(F.dmBold).fontSize(8.5).fillColor(KLEUR.inktZacht);
        doc.text("Jouw antwoord:", x + 30, yy, { width: 78, lineBreak: false });
        yy += schrijf(doc, r.herkenning || "", x + 110, yy, TEKST_B - 124, F.dmMed, 8.5, KLEUR.inkt, 1.5) + 3;
        if (r.energie) {
          doc.font(F.dmBold).fontSize(8.5).fillColor(KLEUR.inktZacht);
          doc.text("En dat:", x + 30, yy, { width: 78, lineBreak: false });
          doc.font(F.dmMed).fontSize(8.5).fillColor(KLEUR.inkt);
          doc.text(r.energie, x + 110, yy, { width: TEKST_B - 124, lineBreak: false });
          yy += 11;
        }
        if (i < blok.regels.length - 1) {
          lijn(doc, x + 30, yy, x + TEKST_B - 16, yy, KLEUR.lijn);
          yy += 5;
        }
      });
      return h + 10;
    }
    case "batterij": {
      const b = 176;
      const h = 22;
      vulRechthoek(doc, x, y, b, h, KLEUR.kaart, 3);
      doc.save().lineWidth(1).strokeColor(KLEUR.inktZacht).roundedRect(x, y, b, h, 3).stroke().restore();
      vulRechthoek(doc, x + b + 2, y + h / 2 - 4, 4, 8, KLEUR.inktZacht, 1);
      const deel = blok.waarde == null ? 0 : Math.max(0, Math.min(1, blok.waarde / 10));
      if (deel > 0)
        vulRechthoek(doc, x + 3, y + 3, (b - 6) * deel, h - 6, deel >= 0.5 ? KLEUR.salie : KLEUR.oker, 2);
      for (let i = 1; i < 10; i++) lijn(doc, x + 3 + ((b - 6) / 10) * i, y + 4, x + 3 + ((b - 6) / 10) * i, y + h - 4, KLEUR.papier, 0.5);
      doc.font(F.dmBold).fontSize(10).fillColor(KLEUR.inkt);
      doc.text(blok.waarde == null ? "nog niet ingevuld" : `${blok.waarde} op 10`, x + b + 14, y + 6, {
        width: 120,
        lineBreak: false,
      });
      const zh = schrijf(doc, blok.zin, x, y + h + 10, TEKST_B, F.dm, 9.2, KLEUR.inkt, 3.4);
      return h + 10 + zh + 10;
    }
    case "kolommen": {
      const kolB = (TEKST_B - 20) / 2;
      kapitalen(doc, blok.kopLinks, x, y, 6.8, KLEUR.salie);
      kapitalen(doc, blok.kopRechts, x + kolB + 20, y, 6.8, KLEUR.accent);
      const teken = (regels: typeof blok.links, kx: number): number => {
        let yy = y + 14;
        for (const r of regels) {
          yy += schrijf(doc, r.vraag, kx, yy, kolB - 10, F.dm, 8.2, KLEUR.inkt, 2) + 1.5;
          yy += schrijf(doc, r.herkenning || "", kx, yy, kolB - 10, F.dmMed, 8, KLEUR.accentDiep, 1.5) + 3;
          if (r.energie) yy += schrijf(doc, r.energie, kx, yy, kolB - 10, F.dm, 7.6, KLEUR.inktZacht, 1.5) + 2;
          yy += 7;
        }
        return yy;
      };
      const links = teken(blok.links, x);
      const rechts = teken(blok.rechts, x + kolB + 20);
      lijn(doc, x + kolB + 10, y + 12, x + kolB + 10, Math.max(links, rechts) - 4, KLEUR.lijn);
      return Math.max(links, rechts) - y + 8;
    }
    case "opsomming": {
      let yy = y;
      if (blok.kop) yy += kapitalen(doc, blok.kop, x, yy, 7, KLEUR.accentDiep) + 4;
      for (const p of blok.punten) {
        doc.circle(x + 3.2, yy + 4.6, 1.9).fill(KLEUR.accent);
        const h = schrijf(doc, p, x + 14, yy, TEKST_B - 18, F.dm, 9.2, KLEUR.inkt, 3);
        yy += h + 7;
      }
      return yy - y + 6;
    }
    case "kader": {
      const h = hoogteVan(doc, blok.tekst, F.dm, 9, TEKST_B - 32, 3.2);
      const totaal = h + 36;
      vulRechthoek(doc, x, y, TEKST_B, totaal, KLEUR.papier2, 3);
      vulRechthoek(doc, x, y, 2.6, totaal, blok.kleur, 1.3);
      kapitalen(doc, blok.kop, x + 16, y + 10, 7, blok.kleur);
      schrijf(doc, blok.tekst, x + 16, y + 23, TEKST_B - 32, F.dm, 9, KLEUR.inkt, 3.2);
      return totaal + 6;
    }
    case "paren": {
      const kolB = (TEKST_B - 12) / 2;
      let yy = y;
      for (let i = 0; i < blok.paren.length; i += 2) {
        const rij = blok.paren.slice(i, i + 2);
        const kaartH = Math.max(...rij.map((p) => hoogteVan(doc, p.waarde, F.dmMed, 10.5, kolB - 28, 2))) + 30;
        rij.forEach((p, k) => {
          const kx = x + k * (kolB + 12);
          vulRechthoek(doc, kx, yy, kolB, kaartH, KLEUR.kaart, 3);
          doc.save().lineWidth(0.5).strokeColor(KLEUR.lijn).roundedRect(kx, yy, kolB, kaartH, 3).stroke().restore();
          vulRechthoek(doc, kx, yy, 2.4, kaartH, KLEUR.oker, 1.2);
          doc.font(F.dmBold).fontSize(6.6).fillColor(KLEUR.inktZacht);
          doc.text(p.label.toUpperCase(), kx + 14, yy + 9, { width: kolB - 24, characterSpacing: 0.6, lineBreak: false });
          schrijf(doc, p.waarde, kx + 14, yy + 19, kolB - 28, F.dmMed, 10.5, KLEUR.inkt, 2);
        });
        yy += kaartH + 8;
      }
      return yy - y + 4;
    }
    case "vragen": {
      let yy = y + kapitalen(doc, blok.kop, x, y, 7, KLEUR.accentDiep) + 4;
      for (const v of blok.vragen) {
        const h = schrijf(doc, v, x, yy, TEKST_B - 16, F.dmMed, 9.2, KLEUR.inkt, 2.6);
        yy += h + 6;
        lijn(doc, x, yy + 7, x + TEKST_B, yy + 7, KLEUR.lijn);
        lijn(doc, x, yy + 21, x + TEKST_B, yy + 21, KLEUR.lijn);
        yy += 26;
      }
      return yy - y + 4;
    }
    case "ruimte":
      return blok.hoogte;
  }
}

// ── De bladen ───────────────────────────────────────────────────────────────

function tekenKopEnVoet(doc: Doc, rapport: T4SRapport, bladnr: number): void {
  doc.font(F.dm).fontSize(7.5).fillColor(KLEUR.inktZacht);
  doc.text(`${rapport.naam} · ${rapport.code}`, MARGE, KOP_Y, { width: TEKST_B * 0.6, lineBreak: false });
  doc.text(rapport.datum, MARGE, KOP_Y, { width: TEKST_B, align: "right", lineBreak: false });
  lijn(doc, MARGE, KOP_Y + 12, MARGE + TEKST_B, KOP_Y + 12, KLEUR.lijn);

  doc.font(F.dm).fontSize(7.5).fillColor(KLEUR.inktZacht);
  doc.text(VOETREGEL, MARGE, VOET_Y, { width: TEKST_B * 0.75, lineBreak: false });
  doc.font(F.dmMed).fontSize(7.5).fillColor(KLEUR.inktZacht);
  doc.text(String(bladnr), MARGE, VOET_Y, { width: TEKST_B, align: "right", lineBreak: false });
}

function tekenPaginakop(doc: Doc, pagina: T4SPagina, vervolg: boolean): number {
  const y = 72;
  doc.circle(MARGE + 11, y + 11, 11).fill(KLEUR.accent);
  doc.font(F.dmBold).fontSize(10).fillColor("#FFFFFF");
  doc.text(String(pagina.nr), MARGE + 3, y + 6.5, { width: 16, align: "center", lineBreak: false });

  const titel = vervolg ? `${pagina.titel} (vervolg)` : pagina.titel;
  doc.font(F.dmBold).fontSize(19).fillColor(KLEUR.inkt);
  const th = doc.heightOfString(titel, { width: TEKST_B - 32, lineGap: 0 });
  doc.text(titel, MARGE + 32, y - 1, { width: TEKST_B - 32, lineGap: 0 });
  let yy = y + Math.max(24, th) + 3;

  if (pagina.ondertitel) {
    doc.font(F.dm).fontSize(10.2).fillColor(KLEUR.inktZacht);
    const oh = doc.heightOfString(pagina.ondertitel, { width: TEKST_B - 32, lineGap: 1.5 });
    doc.text(pagina.ondertitel, MARGE + 32, yy, { width: TEKST_B - 32, lineGap: 1.5, oblique: SCHUIN });
    yy += oh + 8;
  }
  vulRechthoek(doc, MARGE, yy, 64, 2, KLEUR.accent);
  return yy + 16;
}

function tekenCover(doc: Doc, rapport: T4SRapport, pagina: T4SPagina, opties: T4SPdfOpties): void {
  vulRechthoek(doc, 0, 0, BLAD_B, BLAD_H, KLEUR.papier);
  const beeldH = 300;
  if (opties.coverfoto && existsSync(opties.coverfoto)) {
    doc.save().rect(0, 0, BLAD_B, beeldH).clip();
    doc.image(opties.coverfoto, 0, 0, { cover: [BLAD_B, beeldH], align: "center", valign: "center" });
    doc.restore();
  } else {
    vulRechthoek(doc, 0, 0, BLAD_B, beeldH, KLEUR.tealZacht);
  }
  vulRechthoek(doc, 0, beeldH, BLAD_B, 6, KLEUR.accent);

  let y = beeldH + 76;
  kapitalen(doc, pagina.ondertitel, MARGE, y, 8.2, KLEUR.accentDiep);
  y += 22;
  doc.font(F.dmBold).fontSize(38).fillColor(KLEUR.inkt);
  doc.text("Jouw studiekompas", MARGE, y, { width: TEKST_B, lineGap: 0 });
  y += 46;
  doc.font(F.dmMed).fontSize(17).fillColor(KLEUR.accentDiep);
  meet(doc, rapport.naam, TEKST_B, "naam op de cover");
  doc.text(rapport.naam, MARGE, y, { width: TEKST_B, lineBreak: false });
  y += 30;

  const alineas = pagina.blokken.filter((b) => b.soort === "alinea");
  for (const blok of pagina.blokken) {
    if (blok.soort === "paren") {
      const kolB = TEKST_B / 3;
      blok.paren.forEach((p, i) => {
        const px = MARGE + i * kolB;
        doc.font(F.dmBold).fontSize(6.8).fillColor(KLEUR.inktZacht);
        doc.text(p.label.toUpperCase(), px, BLAD_H - 170, { width: kolB - 8, characterSpacing: 0.6, lineBreak: false });
        doc.font(F.dmMed).fontSize(10).fillColor(KLEUR.inkt);
        meet(doc, p.waarde, kolB - 8, "waarde op de cover");
        doc.text(p.waarde, px, BLAD_H - 159, { width: kolB - 8, lineBreak: false });
      });
    } else if (blok.soort === "alinea") {
      // De slotregel staat onder de drie gegevens en niet erboven, want zij sluit
      // de cover af; boven de gegevens zou zij ze inleiden.
      if (blok === alineas[alineas.length - 1] && alineas.length > 1) {
        schrijf(doc, blok.tekst, MARGE, BLAD_H - 120, TEKST_B - 40, F.dm, 8.6, KLEUR.inktZacht, 3);
      } else {
        y += schrijf(doc, blok.tekst, MARGE, y, TEKST_B - 60, F.dm, 11.4, KLEUR.inktZacht, 4.5) + 12;
      }
    }
  }
  lijn(doc, MARGE, BLAD_H - 186, MARGE + TEKST_B, BLAD_H - 186, KLEUR.lijn);
  doc.font(F.dm).fontSize(8).fillColor(KLEUR.inktZacht);
  doc.text(`Instrument ${rapport.instrumentVersie} · scoring ${rapport.scorerVersie}`, MARGE, BLAD_H - 76, {
    width: TEKST_B,
    lineBreak: false,
  });
}

/**
 * Tekent het rapport en meldt wat er onderweg mis dreigde te gaan. De meldingen
 * komen bij die van de rapportlaag in het verslag terecht.
 */
export function renderT4StudentsRapport(rapport: T4SRapport, opties: T4SPdfOpties = {}): {
  doc: Doc;
  meldingen: string[];
} {
  MELDINGEN = [];
  const meldingen: string[] = [];
  const doc = new PDFDocument({ size: [BLAD_B, BLAD_H], margin: 0, autoFirstPage: false, bufferPages: true });
  registerFonts(doc);

  let bladnr = 0;
  for (const pagina of rapport.paginas) {
    doc.addPage();
    bladnr++;
    HUIDIG_BLAD = `blad ${bladnr} (pagina ${pagina.nr})`;
    if (pagina.soort === "cover") {
      tekenCover(doc, rapport, pagina, opties);
      continue;
    }
    vulRechthoek(doc, 0, 0, BLAD_B, BLAD_H, KLEUR.papier);
    tekenKopEnVoet(doc, rapport, bladnr);
    let y = tekenPaginakop(doc, pagina, false);
    let vervolgen = 0;

    for (let bi = 0; bi < pagina.blokken.length; bi++) {
      const blok = pagina.blokken[bi];
      const h = blokHoogte(doc, blok);
      // Een tussenkop mag nooit alleen onderaan een blad achterblijven. Het
      // blok erna wordt altijd in zijn geheel op een blad getekend (het
      // splitst zichzelf niet), dus het volstaat te kijken of dat volgende
      // blok als geheel meer ruimte nodig heeft dan wat er na de tussenkop
      // nog over is: zo ja, dan verhuist de tussenkop zelf ook mee.
      const volgende = pagina.blokken[bi + 1];
      const volgendeHoogte = volgende ? blokHoogte(doc, volgende) : 0;
      // Als het volgende blok op geen enkel blad in zijn geheel past (groter
      // dan een heel blad), helpt vooruitschuiven niet: dan blijft de normale
      // regel gelden en krijgt dat blok verderop zijn eigen melding.
      const volgendeKanOoitPassen = volgendeHoogte <= BODEM - INHOUD_TOP;
      const volgendePast = !volgende || y + h + volgendeHoogte <= BODEM;
      const moetVerhuizen = blok.soort === "tussenkop" && volgende && volgendeKanOoitPassen && !volgendePast;
      const benodigd = moetVerhuizen ? BODEM - y + 1 : h;
      if (y + benodigd > BODEM && y > INHOUD_TOP) {
        if (h > BODEM - INHOUD_TOP) {
          meldingen.push(
            `Pagina ${pagina.nr}: een blok van het soort ${blok.soort} is hoger dan een blad ` +
              `(${Math.round(h)} punten). Het is op een eigen blad gezet en kan onderaan aflopen.`,
          );
        }
        doc.addPage();
        bladnr++;
        HUIDIG_BLAD = `blad ${bladnr} (pagina ${pagina.nr}, vervolg)`;
        vervolgen++;
        vulRechthoek(doc, 0, 0, BLAD_B, BLAD_H, KLEUR.papier);
        tekenKopEnVoet(doc, rapport, bladnr);
        y = tekenPaginakop(doc, pagina, true);
      }
      y += tekenBlok(doc, blok, y);
    }
    if (vervolgen > 0) {
      meldingen.push(
        `Pagina ${pagina.nr} (${pagina.titel}) past niet op een blad en loopt door op ` +
          `${vervolgen} vervolgblad${vervolgen === 1 ? "" : "en"}.`,
      );
    }
  }
  return { doc, meldingen: [...meldingen, ...MELDINGEN] };
}
