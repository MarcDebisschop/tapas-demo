// ---------------------------------------------------------------------------
// scripts/t4students-proefpdf.ts
//
// Genereert een echte T4Students-PDF uit een volledig ingevuld antwoordenblad,
// langs precies dezelfde keten als een live afname: de itembank levert de items,
// de scoring rekent, het afnamecontract wordt gebouwd en de rapportketen tekent
// de bladen. Bedoeld voor de visuele keuring van de bladen.
//
// Gebruik: npx tsx scripts/t4students-proefpdf.ts /tmp/proef.pdf
// ---------------------------------------------------------------------------

import { writeFileSync } from "node:fs";
import { itemsVanInstrument, itemSoort } from "../server/t4students/antwoorden";
import { bouwT4StudentsAfnameContract } from "../server/t4students/afnamecontract";
import { bouwRapportUitContract, pdfVanRapport } from "../server/t4students/rapport-keten";

const doel = process.argv[2] ?? "/tmp/t4students-proef.pdf";

// Een gevarieerd, volledig blad: niet elk antwoord hetzelfde, zodat de bladen
// echte verschillen tonen in plaats van een vlak beeld.
function vul(): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  const items = itemsVanInstrument();
  let p1: string | null = null;
  let teller = 0;
  for (const item of items) {
    teller++;
    const soort = itemSoort(item);
    if (soort === "open-intro") {
      uit[item.id] = {
        text: "Ik twijfel tussen een technische richting en iets met mensen. Ik wil weten waar mijn energie zit.",
      };
    } else if (soort === "battery") {
      uit[item.id] = { value: 7 };
    } else if (soort === "recognition+energy") {
      uit[item.id] = { recognition: teller % 4, energy: (teller % 5) - 2 };
    } else if (soort === "recognition") {
      uit[item.id] = { recognition: (teller % 3) + 1 };
    } else if (soort === "interest") {
      uit[item.id] = { interest: teller % 3 };
    } else if (item.options && item.options.length > 0) {
      const keuze = item.options[teller % item.options.length]!;
      uit[item.id] = { choice: keuze.key ?? keuze.id };
      if (item.id === "P1") p1 = String(keuze.key ?? keuze.id);
    }
  }
  const p2 = items.find((i) => i.variants);
  if (p2 && p1) {
    const variant = (p2.variants as Record<string, any>)[p1];
    if (variant) {
      uit[p2.id] =
        variant.itemType === "profile-scale"
          ? { value: 6 }
          : { choice: variant.options[0].key ?? variant.options[0].id };
    }
  }
  return uit;
}

async function main() {
  const blad = vul();
  const contract = bouwT4StudentsAfnameContract({
    respondentCode: "T4S-PROEF-1",
    name: "Proefblad Studiekompas",
    taal: "nl",
    responses: blad,
    itemTijden: null,
  });
  const rapport = bouwRapportUitContract(contract);
  const pdf = await pdfVanRapport(rapport);
  writeFileSync(doel, pdf);
  console.log("bladen:", rapport.paginas.length);
  console.log("bytes:", pdf.length, "->", doel);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
