// ---------------------------------------------------------------------------
// Gedeelde instrument -> generator-registry (één bron van waarheid).
//
// WAAROM DIT BESTAAT
// Vroeger koos server/storage.ts (en een duplicaat in repositories/rapporten.ts
// en script/regen_reports.ts) via een groeiende if/else welk rapport werd
// gebouwd. Alleen "t4students" had een eigen tak; elk ander instrument — ook
// "t4p-business-kompas" — viel terug op de korte, generieke bouwRapportInhoud.
// Daardoor kreeg T4P nooit zijn volledige 24-secties-rapport.
//
// Deze registry centraliseert de instrument -> {bouw, render}-koppeling zodat
// alle rapportpaden dezelfde keuze maken. Een nieuw instrument voegt hier één
// regel toe; het probleem keert niet meer per pad terug.
// ---------------------------------------------------------------------------

import { bouwRapportInhoud, renderRapportHtml } from "./rapportgenerator";
import { bouwT4StudentsRapport, renderT4StudentsHtml } from "./t4students/rapport";
import { bouwT4pBusinessProfiel, renderT4pBusinessProfielHtml } from "./t4p/rapport";
import { bouwT4pBusinessKompas, renderT4pBusinessKompasHtml } from "./t4p/kompas";
import { bouwT4TeensRapport, renderT4TeensHtml } from "./t4teens/rapport";
import { renderRapportPdf } from "./rapport-pdf";

export interface GeneratorEntry {
  // bouw krijgt (contract, variant); niet elke generator gebruikt variant.
  bouw: (contract: any, variant: "kompas" | "coachatlas") => any;
  render: (inhoud: any) => string;
}

// Instrumenten met een eigen, toegewijde generator. Alles wat hier NIET in
// staat, valt via kiesGenerator terug op de generieke bouwRapportInhoud.
export const RAPPORT_GENERATORS: Record<string, GeneratorEntry> = {
  t4students: {
    bouw: (contract) => bouwT4StudentsRapport(contract),
    render: (inhoud) => renderT4StudentsHtml(inhoud),
  },
  // T4P Business Kompas: de gemeten A4-printlayout (24 hoofdstukken, eigen
  // @page-formaat, ingebedde fonts en iconen). De oude webweergave blijft
  // beschikbaar als bouwT4pBusinessProfiel/renderT4pBusinessProfielHtml in
  // server/t4p/rapport.ts, maar wordt niet meer voor het rapport gebruikt.
  "t4p-business-kompas": {
    bouw: (contract, variant) => bouwT4pBusinessKompas(contract, variant),
    render: (inhoud) => renderT4pBusinessKompasHtml(inhoud),
  },
  t4teens: {
    bouw: (contract) => bouwT4TeensRapport(contract),
    render: (inhoud) => renderT4TeensHtml(inhoud),
  },
};

// Generieke fallback (het oude "else"-pad).
const FALLBACK: GeneratorEntry = {
  bouw: (contract, variant) => bouwRapportInhoud(contract, variant),
  render: (inhoud) => renderRapportHtml(inhoud),
};

// True als het instrument een eigen generator heeft (geen generieke fallback).
// De AI-duiding mag alléén op de generieke fallback-inhoud draaien, omdat die
// verrijking de oude RapportInhoud-structuur verwacht.
export function heeftDedicatedGenerator(instrumentId: unknown): boolean {
  return typeof instrumentId === "string" && instrumentId in RAPPORT_GENERATORS;
}

// Kiest de generator voor een instrument; valt terug op de generieke generator.
export function kiesGenerator(instrumentId: unknown): GeneratorEntry {
  if (typeof instrumentId === "string" && RAPPORT_GENERATORS[instrumentId]) {
    return RAPPORT_GENERATORS[instrumentId];
  }
  return FALLBACK;
}

// Bouwt uit een (bevroren) contract de instrument-eigen HTML en zet die om naar
// een PDF-buffer via de gedeelde HTML->PDF-laag (server/rapport-pdf.ts). Werkt
// voor elk HTML-instrument in de registry én — via de FALLBACK — voor elk
// onbekend instrument, zodat er ALTIJD een PDF is. De pdfkit-instrumenten HDD en
// Driver-scan lopen NIET via deze helper; die behouden hun eigen PDF-functie.
// Gooit bij een render-fout; de aanroeper valt dan terug op de HTML-download.
export async function genereerRapportPdf(
  instrumentId: unknown,
  contract: any,
  variant: "kompas" | "coachatlas" = "kompas",
): Promise<Buffer> {
  const gen = kiesGenerator(instrumentId);
  const inhoud = gen.bouw(contract, variant);
  const html = gen.render(inhoud);
  return renderRapportPdf(html, { titel: inhoud?.titel });
}
