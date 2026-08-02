// ---------------------------------------------------------------------------
// script/render-t4students-prototype.mts
//
// Rekent de voorbeeldafname door met de echte scoringsmotor en schrijft er twee
// PDF's uit: een met de Verdieping en een met de Basis. Geen enkele score staat
// hier met de hand ingetypt; alles komt uit scoreStudiekompas.
//
// Gebruik:  npx tsx script/render-t4students-prototype.mts [uitvoermap]
// ---------------------------------------------------------------------------

import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SLicentie } from "../server/t4students/rapport-contract";

const WORTEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UIT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(WORTEL, "..");
const COVER = path.join(WORTEL, "client", "public", "rapport", "t4students-cover.jpg");

mkdirSync(UIT, { recursive: true });

const inst = T4STUDENTS_INSTRUMENT;
const resultaat = scoreStudiekompas(inst, VOORBEELDAFNAME.antwoorden, null, "nl");

async function schrijf(licentie: T4SLicentie, bestand: string): Promise<string[]> {
  const rapport = bouwT4StudentsRapport(inst, resultaat, VOORBEELDAFNAME.antwoorden, licentie, {
    naam: VOORBEELDAFNAME.naam,
    code: VOORBEELDAFNAME.code,
    datum: VOORBEELDAFNAME.datum,
    instrumentVersie: inst.version,
  });
  const { doc, meldingen } = renderT4StudentsRapport(rapport, { coverfoto: COVER });
  const pad = path.join(UIT, bestand);
  await new Promise<void>((klaar, mis) => {
    const stroom = createWriteStream(pad);
    stroom.on("finish", () => klaar());
    stroom.on("error", mis);
    doc.pipe(stroom);
    doc.end();
  });
  console.log(`${bestand}: ${rapport.paginas.length} pagina's uit het paginaplan`);
  return [...rapport.meldingen, ...meldingen];
}

const alles: string[] = [];
alles.push(...(await schrijf("verdieping", "prototype-t4students-verdieping.pdf")).map((m) => `verdieping | ${m}`));
alles.push(...(await schrijf("basis", "prototype-t4students-basis.pdf")).map((m) => `basis | ${m}`));

if (alles.length === 0) console.log("Geen meldingen.");
else {
  console.log("\nMELDINGEN");
  for (const m of alles) console.log("  - " + m);
}
