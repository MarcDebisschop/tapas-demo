// ---------------------------------------------------------------------------
// server/t4students/rapport-oog.ts
//
// Het Tapas-oog op het blad "Jouw talentmotor in één oogopslag" van het
// T4Students Studiekompas. De regels en de meetkunde staan in
// shared/tapas-oog.ts; hier wordt die tekening met pdfkit op het blad gezet.
//
// De padnotatie uit de gedeelde module is SVG-notatie, en doc.path() leest die
// notatie ongewijzigd. Zo tekenen het Kompas en het Studiekompas hetzelfde oog
// uit dezelfde bron, elk in zijn eigen drukmotor.
// ---------------------------------------------------------------------------

import {
  oogStatuswoordKort,
  oogTekening,
  type OogConstruct,
  type OogTekening,
} from "../../shared/tapas-oog";
import { KLEUR } from "./rapport-contract";
import { F } from "../hdd/pdf/theme";

type Doc = PDFKit.PDFDocument;

/** Het blok zoals het in het rapportcontract staat. */
export interface OogBlok {
  soort: "oog";
  kop: string;
  foci: OogConstruct[];
  versnellers: OogConstruct[];
  drivers: OogConstruct[];
  noot: string | null;
}

/**
 * De identiteitskleur per construct van het Studiekompas. De tinten zijn zo
 * gelijk gehouden als mogelijk met het Tapas-oog van het Business Kompas: waar
 * een construct daar een tegenhanger heeft, krijgt het hier exact dezelfde
 * kleur. Waar het Studiekompas een construct in twee varianten opsplitst, is de
 * kleurfamilie behouden en enkel de diepte verschoven, zodat de twee ringdelen
 * naast elkaar te onderscheiden blijven.
 *
 * De kleur hoort bij het construct en niet bij de energie: de energie verandert
 * enkel de helderheid van de vulling (zie oogVulling in shared/tapas-oog.ts).
 */
export const OOG_KLEUR_T4S: Record<string, string> = {
  // Talentfoci. Innovatief volgt Innovatie, Interactief volgt Inter-relationeel,
  // Conceptueel volgt Strategie en Uitvoerend volgt Operationeel.
  "Functioneel Innovatief": "#f7d007",
  "Artistiek Innovatief": "#d9a800",
  "Complexiteit/Conceptueel": "#4697b8",
  "Systematisch/Uitvoerend": "#ed111a",
  "Sociaal Interactief": "#43bb50",
  "Overdrachtelijk Interactief": "#2f9a45",
  // Talentversnellers. Vier namen zijn dezelfde als in het Business Kompas;
  // ondersteunend volgt Coaching en Faciliteren.
  Analyse: "#5e6da0",
  "Constructief onderscheidend": "#f59c09",
  Impact: "#b4dd21",
  Resultaat: "#c83667",
  "Individueel ondersteunend": "#44bb5a",
  Groepsondersteunend: "#45b996",
};

/** De rustige grijstint van de drivers, gelijk aan die in het Business Kompas.
 * De drivers zijn geen talent en krijgen daarom geen eigen talentkleur. */
export const OOG_KLEUR_T4S_DRIVER = "#9a968c";

/** De kleur van een construct, met dezelfde rustige terugval als in het
 * Business Kompas: liever een neutrale tint dan een verzonnen kleur. */
export function oogKleurT4S(construct: string): string {
  return OOG_KLEUR_T4S[construct] ?? OOG_KLEUR_T4S_DRIVER;
}

const OOG_B = 288;
const OOG_H = 208;
const LEG_KORPS = 7.6;
const LEG_REGEL = 10.4;
const LEG_KOP = 11.5;

const NIVEAUKLEUR: Record<number, string> = {
  3: KLEUR.salie,
  2: KLEUR.oker,
  1: KLEUR.accent,
  0: KLEUR.accentDiep,
};

/** De legenderegels, in dezelfde volgorde als de nummers in het beeld. */
function legendehoogte(tek: OogTekening): number {
  return 3 * LEG_KOP + tek.legende.length * LEG_REGEL + 8;
}

/** De hoogte van het volledige blok, gemeten vóór het tekenen. */
export function oogHoogte(doc: Doc, blok: OogBlok, tekstB: number): number {
  const tek = maakTekening(blok);
  const beeld = Math.max(OOG_H, legendehoogte(tek));
  doc.font(F.dm).fontSize(8.4);
  const alert =
    doc.heightOfString(tek.uitkomst.alertKop, { width: tekstB - 26, lineGap: 1.6 }) +
    doc.heightOfString(tek.uitkomst.alertTekst, { width: tekstB - 26, lineGap: 2.6 }) +
    16;
  let noten = 0;
  doc.font(F.dm).fontSize(7.2);
  for (const n of notenVan(blok, tek)) {
    noten += doc.heightOfString(n, { width: tekstB, lineGap: 1.8 }) + 4;
  }
  return 16 + beeld + 8 + alert + 6 + noten;
}

function maakTekening(blok: OogBlok): OogTekening {
  return oogTekening(
    { foci: blok.foci, versnellers: blok.versnellers, drivers: blok.drivers },
    OOG_B,
    OOG_H,
  );
}

function notenVan(blok: OogBlok, tek: OogTekening): string[] {
  return [
    "De ringen tonen wat er is, in de volgorde waarin het naar voren komt. Het licht zegt niets over " +
      "hoe groot je talent is, enkel of je talentpotentieel vandaag inzetbaar en dus zichtbaar is.",
    ...tek.uitkomst.meldingen,
    ...(blok.noot ? [blok.noot] : []),
  ];
}

/** Zet één vorm op het blad. */
function vorm(doc: Doc, v: OogTekening["binnen"][number], ox: number, oy: number): void {
  if (v.soort === "gloed") {
    const g = doc.radialGradient(ox + v.cx, oy + v.cy, 0, ox + v.cx, oy + v.cy, Math.max(v.r, 0.1));
    g.stop(0, "#FFC553", 0.9 * v.dekking);
    g.stop(1, "#FFC553", 0);
    doc.save().circle(ox + v.cx, oy + v.cy, v.r).fill(g).restore();
    return;
  }
  if (v.soort === "lijn") {
    doc
      .save()
      .lineWidth(v.breedte)
      .strokeOpacity(v.dekking)
      .strokeColor(v.kleur)
      .moveTo(ox + v.x1, oy + v.y1)
      .lineTo(ox + v.x2, oy + v.y2)
      .stroke()
      .restore();
    return;
  }
  if (v.soort === "pad") {
    doc.save().translate(ox, oy);
    if (v.dekking !== undefined) doc.fillOpacity(v.dekking);
    const p = doc.path(v.d);
    if (v.vul && v.rand) p.lineWidth(v.randbreedte).fillAndStroke(v.vul, v.rand);
    else if (v.vul) p.fill(v.vul);
    else if (v.rand) p.lineWidth(v.randbreedte).stroke(v.rand);
    doc.restore();
    return;
  }
  if (v.soort === "cirkel") {
    doc.save();
    const p = doc.circle(ox + v.cx, oy + v.cy, v.r);
    if (v.vul && v.rand) p.lineWidth(v.randbreedte).fillAndStroke(v.vul, v.rand);
    else if (v.vul) p.fill(v.vul);
    else if (v.rand) p.lineWidth(v.randbreedte).stroke(v.rand);
    doc.restore();
    return;
  }
  doc
    .save()
    .font(v.vet ? F.dmBold : F.dmMed)
    .fontSize(v.grootte)
    .fillColor(v.kleur)
    .text(v.tekst, ox + v.x - 20, oy + v.y - v.grootte * 0.62, {
      width: 40,
      align: "center",
      lineBreak: false,
    })
    .restore();
}

/** Tekent het blok en geeft de gebruikte hoogte terug. */
export function tekenOog(doc: Doc, blok: OogBlok, x: number, y: number, tekstB: number): number {
  const tek = maakTekening(blok);
  const u = tek.uitkomst;

  // De kopregel van het blok, in kapitalen zoals de andere opschriften.
  doc
    .save()
    .font(F.dmBold)
    .fontSize(7)
    .fillColor(KLEUR.accentDiep)
    .text(blok.kop.toUpperCase(), x, y, { width: tekstB, characterSpacing: 0.9, lineBreak: false })
    .restore();

  const beeldY = y + 14;
  const ox = x;
  const oy = beeldY;

  // Het ooglid, dan alles wat erbinnen valt, dan de ringen erover.
  doc.save().translate(ox, oy);
  doc.path(tek.lidPad).lineWidth(tek.lidBreedte).fillAndStroke("#FFFFFF", tek.lidKleur);
  doc.restore();

  doc.save().translate(ox, oy).path(tek.lidPad).clip().translate(-ox, -oy);
  for (const v of tek.binnen) vorm(doc, v, ox, oy);
  doc.restore();

  for (const v of tek.voor) vorm(doc, v, ox, oy);

  if (tek.gordijn.length) {
    doc.save().translate(ox, oy).path(tek.lidPad).clip().translate(-ox, -oy);
    for (const v of tek.gordijn) vorm(doc, v, ox, oy);
    // De nummers opnieuw, nu bovenop de stof, zodat er geen half bedekt cijfer
    // in de druk staat.
    for (const v of tek.naGordijn) vorm(doc, v, ox, oy);
    doc.restore();
  }

  // De legende naast het beeld.
  const lx = x + OOG_B + 14;
  const lb = tekstB - OOG_B - 14;
  let ly = beeldY;
  const groepen: [string, string][] = [
    ["F", "Talentfoci, binnenring"],
    ["V", "Talentversnellers, buitenring"],
    ["D", "Drivers, in het midden"],
  ];
  for (const [letter, kop] of groepen) {
    doc
      .save()
      .font(F.dmBold)
      .fontSize(6.6)
      .fillColor(KLEUR.inktZacht)
      .text(kop.toUpperCase(), lx, ly, { width: lb, characterSpacing: 0.7, lineBreak: false })
      .restore();
    ly += LEG_KOP;
    for (const l of tek.legende.filter((r) => r.nummer.startsWith(letter))) {
      doc
        .save()
        .font(F.dmBold)
        .fontSize(LEG_KORPS)
        .fillColor(KLEUR.inkt)
        .text(l.nummer, lx, ly, { width: 13, lineBreak: false })
        .restore();
      doc.save().circle(lx + 17.5, ly + LEG_KORPS * 0.42, 2.5).fillAndStroke(l.kleur, KLEUR.lijn).restore();
      doc
        .save()
        .font(F.dm)
        .fontSize(LEG_KORPS)
        .fillColor(KLEUR.inkt)
        .text(l.naam, lx + 24, ly, { width: lb - 24 - 40, lineBreak: false, ellipsis: true })
        .restore();
      doc
        .save()
        .font(F.dm)
        .fontSize(6.9)
        .fillColor(KLEUR.inktZacht)
        .text(oogStatuswoordKort(l.status), lx + lb - 40, ly + 0.6, {
          width: 40,
          align: "right",
          lineBreak: false,
        })
        .restore();
      ly += LEG_REGEL;
    }
    ly += 3;
  }

  let yy = beeldY + Math.max(OOG_H, legendehoogte(tek)) + 8;

  // De alertbalk: het woord voor het licht, de kop en de uitleg.
  const kleur = NIVEAUKLEUR[u.niveau];
  doc.font(F.dm).fontSize(8.4);
  const hKop = doc.heightOfString(`${u.niveauNaam.toUpperCase()} · ${u.alertKop}`, {
    width: tekstB - 26,
    lineGap: 1.6,
  });
  const hTxt = doc.heightOfString(u.alertTekst, { width: tekstB - 26, lineGap: 2.6 });
  const balkH = hKop + hTxt + 16;
  doc.save().roundedRect(x, yy, tekstB, balkH, 3).fill(KLEUR.papier2).restore();
  doc.save().rect(x, yy, 2.6, balkH).fill(kleur).restore();
  doc
    .save()
    .font(F.dmBold)
    .fontSize(8.4)
    .fillColor(kleur)
    .text(`${u.niveauNaam.toUpperCase()} · ${u.alertKop}`, x + 13, yy + 7, {
      width: tekstB - 26,
      lineGap: 1.6,
    })
    .restore();
  doc
    .save()
    .font(F.dm)
    .fontSize(8.4)
    .fillColor(KLEUR.inkt)
    .text(u.alertTekst, x + 13, yy + 7 + hKop + 2, { width: tekstB - 26, lineGap: 2.6 })
    .restore();
  yy += balkH + 6;

  for (const n of notenVan(blok, tek)) {
    doc.font(F.dm).fontSize(7.2);
    const h = doc.heightOfString(n, { width: tekstB, lineGap: 1.8 });
    doc
      .save()
      .fillColor(KLEUR.inktZacht)
      .text(n, x, yy, { width: tekstB, lineGap: 1.8 })
      .restore();
    yy += h + 4;
  }

  return yy - y;
}
