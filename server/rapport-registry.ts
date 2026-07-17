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
  "t4p-business-kompas": {
    bouw: (contract) => bouwT4pBusinessProfiel(contract),
    render: (inhoud) => renderT4pBusinessProfielHtml(inhoud),
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
