// ---------------------------------------------------------------------------
// script/render-motivatieblok-bewijsstuk.mts
//
// Rekent de bestaande voorbeeldafname (server/t4students/rapport-voorbeeld.ts)
// door met de echte scoringsmotor (scoreStudiekompas) en schrijft het
// Studiekompas in de Verdieping-uitvoering weg als bewijsstuk voor het nieuwe
// motivatieblok. Geen enkele score of tekst staat hier met de hand ingetypt;
// alles komt uit de motor en uit server/t4students/rapport-paginas.ts. Volgt
// dezelfde weg als het bestaande script/render-t4students-prototype.mts.
//
// Gebruik:  npx tsx script/render-motivatieblok-bewijsstuk.mts <uitvoerpad.pdf>
// ---------------------------------------------------------------------------

import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

const WORTEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UIT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(WORTEL, "..", "T4Students-Studiekompas-met-motivatie.pdf");
const COVER = path.join(WORTEL, "client", "public", "rapport", "t4students-cover.jpg");

mkdirSync(path.dirname(UIT), { recursive: true });

const inst = T4STUDENTS_INSTRUMENT;
const resultaat = scoreStudiekompas(inst, VOORBEELDAFNAME.antwoorden, null, "nl");

const rapport = bouwT4StudentsRapport(inst, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
  naam: VOORBEELDAFNAME.naam,
  code: VOORBEELDAFNAME.code,
  datum: VOORBEELDAFNAME.datum,
  instrumentVersie: inst.version,
});
const { doc, meldingen } = renderT4StudentsRapport(rapport, { coverfoto: COVER });

await new Promise<void>((klaar, mis) => {
  const stroom = createWriteStream(UIT);
  stroom.on("finish", () => klaar());
  stroom.on("error", mis);
  doc.pipe(stroom);
  doc.end();
});

console.log(`Geschreven: ${UIT}`);
console.log(`Licentie: verdieping`);
console.log(`Pagina's uit het paginaplan: ${rapport.paginas.length}`);
console.log(`Motivatiebalans van de motor: intrinsiek=${resultaat.motivatie.intrinsiek} extrinsiek=${resultaat.motivatie.extrinsiek} label=${resultaat.motivatie.balansLabel}`);

const alleMeldingen = [...rapport.meldingen, ...meldingen];
if (alleMeldingen.length === 0) console.log("Geen meldingen.");
else {
  console.log("\nMELDINGEN");
  for (const m of alleMeldingen) console.log("  - " + m);
}
