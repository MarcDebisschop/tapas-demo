// Rendert een bewaard afnamecontract naar PDF, om opmaak na te kijken.
// Gebruik: npx tsx script/render-uit-contract.mts <contract.json> <uit.pdf>
import { readFileSync, writeFileSync } from "node:fs";
import { bouwRapportUitContract, pdfVanRapport } from "../server/t4students/rapport-keten";

const contract = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rapport = bouwRapportUitContract(contract);
const pdf = await pdfVanRapport(rapport);
writeFileSync(process.argv[3], pdf);
console.log("bladen in contract:", rapport.paginas.length, "bytes:", pdf.length);
