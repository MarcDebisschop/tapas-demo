// ---------------------------------------------------------------------------
// tests/t4students-gelijkheidstoets/genereer-uitkomsten-na-fase1c.mts
//
// De TWEEDE reeks bevroren uitkomsten. Dezelfde zeventien patronen, maar nu
// door de motor zoals hij na fase 1c rekent, dus met de herstellingen erin.
// Het resultaat komt in uitkomsten-na-fase1c/ te staan, naast de eerste reeks
// in uitkomsten/, die onaangeroerd blijft.
//
// WAAROM TWEE REEKSEN NAAST ELKAAR
// De eerste reeks is het bewijs dat de overzetting van fase 1 niets veranderde:
// zij komt uit de originele browsermotor. De tweede reeks is het bewijs van wat
// fase 1c wel veranderde. Met de twee naast elkaar is elk verschil per patroon
// en per veld aan te wijzen, en dat is precies wat het verslag van fase 1c
// nodig heeft. De vergelijking zelf staat in
// tests/t4students-gelijkheidstoets.test.ts.
//
// Dit script hoort NIET bij de testsuite en draait niet mee met vitest. Het is
// eenmalig gedraaid en staat hier zodat een lezer kan nagaan hoe de tweede
// reeks tot stand kwam:
//
//   npx tsx tests/t4students-gelijkheidstoets/genereer-uitkomsten-na-fase1c.mts
//
// Anders dan het eerste script heeft dit script geen bronmateriaal van buiten
// nodig: het draait de motor van dit platform op het instrumentbestand van dit
// platform.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreStudiekompas } from "../../server/t4students/kompas-scoring.ts";
import { T4STUDENTS_INSTRUMENT } from "../../server/t4students/instrument.ts";

const hier = path.dirname(fileURLToPath(import.meta.url));
const doel = path.join(hier, "uitkomsten-na-fase1c");
mkdirSync(doel, { recursive: true });

interface Patroon {
  naam: string;
  taal: string;
  deelnemer: { naam?: string; code?: string } | null;
  antwoorden: Record<string, any>;
}

const patronen: Patroon[] = JSON.parse(
  readFileSync(path.join(hier, "patronen.json"), "utf8"),
);

// Om dezelfde reden als bij de eerste reeks: geen enkel bestand in deze
// repository mag een lang streepje letterlijk bevatten, en JSON-escapes leveren
// na inlezen exact dezelfde tekenreeks op.
function schrijfbaar(json: string): string {
  return json.split("\u2014").join("\\u2014").split("\u2013").join("\\u2013");
}

for (const p of patronen) {
  const uit = scoreStudiekompas(T4STUDENTS_INSTRUMENT, p.antwoorden, p.deelnemer, p.taal);
  writeFileSync(
    path.join(doel, `${p.naam}.json`),
    schrijfbaar(JSON.stringify(uit, null, 2)) + "\n",
    "utf8",
  );
  console.log("geschreven:", p.naam);
}
console.log("aantal patronen:", patronen.length);
