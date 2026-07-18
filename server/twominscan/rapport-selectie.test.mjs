// Standalone verificatie van de EG-code -> bestand resolver.
// Draait met: node server/twominscan/rapport-selectie.test.mjs
import { existsSync } from "node:fs";
import path from "node:path";

// Herhaal de map hier los (test = onafhankelijk van TS-compile).
const MAP = [
  ["TbXO-g","rood","EE"],["T/RbXO-g","rood","II"],["TbXO-z","rood","IE"],
  ["TbXN-z","rood","EE"],["T/RbXN-a","rood","II"],["TbXN-a","rood","IE"],
  ["RgXN-z","geel","EE"],["R/TgXN-z","geel","II"],["RgXN-a","geel","IE"],
  ["RgXO-a","geel","EE"],["T/RbXN-g","geel","II"],["RgXO-b","geel","IE"],
  ["RzXN-a","groen","EE"],["R/TzXN-a","groen","II"],["RzXN-b","groen","IE"],
  ["RzXO-b","groen","EE"],["R/TzXO-g","groen","II"],["RzXO-g","groen","IE"],
  ["TaXO-b","blauw","EE"],["T/RaXO-b","blauw","II"],["TaXO-g","blauw","IE"],
  ["TaXN-b","blauw","EE"],["T/RaXN-z","blauw","II"],["TaXN-z","blauw","IE"],
];

function fragment(raw, ie){ return raw.replace("X",ie).replace(/\//g,"_").replace(/-/g,"_"); }

let ok=0, fail=0;
for (const [raw,kleur,ie] of MAP){
  const naam = `${kleur}_${fragment(raw,ie)}_nl.pdf`;
  const p = path.join(process.cwd(),"client","public","twominscan-rapporten","nl",naam);
  if (existsSync(p)){ ok++; }
  else { fail++; console.log("ONTBREEKT:", naam); }
}
console.log(`\nResolver-test: ${ok}/24 bestanden gevonden, ${fail} ontbreken.`);
if (fail>0) process.exit(1);
console.log("ALLE 24 profielen resolven naar een bestaand NL-bestand. OK.");
