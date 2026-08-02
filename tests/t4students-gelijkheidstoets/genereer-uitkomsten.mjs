// ---------------------------------------------------------------------------
// tests/t4students-gelijkheidstoets/genereer-uitkomsten.mjs
//
// Draait de patronen uit patronen.json door de ORIGINELE scoringsmotor van
// T4Students, die buiten dit platform leeft, en zet de uitkomsten vast in
// uitkomsten/. Die bevroren uitkomsten zijn het bewijsmateriaal: de test
// tests/t4students-gelijkheidstoets.test.ts vergelijkt de overgezette motor
// er veld voor veld mee.
//
// Dit script hoort NIET bij de testsuite en draait niet mee met vitest. Het is
// eenmalig gedraaid om de uitkomsten te maken en staat hier zodat een lezer
// kan nagaan hoe ze tot stand kwamen. Het heeft het bronmateriaal nodig, dat
// buiten deze repository staat:
//
//   node tests/t4students-gelijkheidstoets/genereer-uitkomsten.mjs /pad/naar/t4s-bron
//
// Het gebruikt met opzet het ORIGINELE instrument-data.js, niet het omgezette
// server/data/t4students.json. Zo toont de vergelijking meteen aan dat het
// vervangen van de lange streepjes in de itemteksten de uitkomst niet raakt.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const bron = process.argv[2];
if (!bron) {
  console.error('Geef het pad naar de map met het bronmateriaal op.');
  process.exit(1);
}

// Beide bronbestanden zijn browserbestanden. We voeren ze uit in plaats van ze
// te parsen, zodat we exact krijgen wat de browsertoepassing ook krijgt.
const venster = {};
new Function('window', readFileSync(path.join(bron, 'instrument-data.js'), 'utf8'))(venster);
new Function('window', readFileSync(path.join(bron, 'scorer.js'), 'utf8'))(venster);

const instrument = venster.T4S_INSTRUMENT;
const score = venster.T4S_score;

const patronen = JSON.parse(readFileSync(path.join(hier, 'patronen.json'), 'utf8'));

// Twee van de alertteksten uit de bron bevatten een lang streepje. Die tekst
// hoort ongewijzigd bewaard te blijven, want het is bewijsmateriaal. Maar geen
// enkel bestand in deze repository mag zo'n teken letterlijk bevatten. JSON
// biedt daar de uitweg voor: we schrijven het als escape. JSON.parse levert
// daarna exact dezelfde tekenreeks als de bron uitstuurde.
function schrijfbaar(json) {
  return json
    .split('\u2014').join('\\u2014')
    .split('\u2013').join('\\u2013');
}

for (const p of patronen) {
  const uit = score(instrument, p.antwoorden, p.deelnemer, p.taal);
  writeFileSync(
    path.join(hier, 'uitkomsten', `${p.naam}.json`),
    schrijfbaar(JSON.stringify(uit, null, 2)) + '\n',
    'utf8',
  );
  console.log('geschreven:', p.naam);
}
console.log('aantal patronen:', patronen.length);
