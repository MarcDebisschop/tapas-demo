// ---------------------------------------------------------------------------
// tests/t4students-coverfoto.test.ts
//
// De coverfoto van het Studiekompas moet in elke gegenereerde PDF staan, ook
// wanneer niemand een pad meegeeft. Dat is de reden dat het beeld als base64 in
// de bundel reist (server/t4students/beeld/coverfoto.ts) en niet als bestand op
// schijf: een pad werkt in de ontwikkelmap wel, maar valt weg zodra de server
// gebundeld draait, en dan zou de cover stil terugvallen op een leeg vlak.
//
// Wat hier gemeten wordt:
//   1. Het ingebouwde beeld is een geldige JPEG van behoorlijke omvang.
//   2. De PDF die de rapportketen aflevert draagt de bytes van dat beeld
//      letterlijk in zich. pdfkit neemt een JPEG ongewijzigd op (DCTDecode),
//      dus een fragment uit het midden van het bestand moet in de PDF terug te
//      vinden zijn. Vindt de toets dat fragment niet, dan staat de foto niet op
//      de cover.
//   3. De PDF blijft één geheel: 35 bladen, en de vlakke noodtint is niet nodig.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { COVERFOTO } from "../server/t4students/beeld/coverfoto";
import { bouwRapportUitContract, pdfVanRapport } from "../server/t4students/rapport-keten";
import { bouwT4StudentsAfnameContract } from "../server/t4students/afnamecontract";
import { itemsVanInstrument, itemSoort } from "../server/t4students/antwoorden";

/**
 * Een volledig ingevuld antwoordenblad, in dezelfde vorm als het hulpscript
 * scripts/t4students-proefpdf.ts gebruikt, zodat de keten tot alle 35 bladen
 * komt. De antwoorden lopen op met een teller, zodat er echte verschillen in
 * het rapport staan en geen vlak beeld.
 */
function antwoordenblad(): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  const items = itemsVanInstrument();
  let p1: string | null = null;
  let teller = 0;
  for (const item of items) {
    teller++;
    const soort = itemSoort(item);
    if (soort === "open-intro") {
      uit[item.id] = { text: "Ik wil iets doen waar ik mensen mee vooruithelp." };
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

describe("De coverfoto van het Studiekompas", () => {
  it("is een geldige JPEG in de bundel", () => {
    expect(COVERFOTO.length).toBeGreaterThan(50_000);
    // JPEG begint met FF D8 FF en eindigt met FF D9.
    expect(COVERFOTO[0]).toBe(0xff);
    expect(COVERFOTO[1]).toBe(0xd8);
    expect(COVERFOTO[2]).toBe(0xff);
    expect(COVERFOTO[COVERFOTO.length - 2]).toBe(0xff);
    expect(COVERFOTO[COVERFOTO.length - 1]).toBe(0xd9);
  });

  it("staat letterlijk in de PDF die de rapportketen aflevert", async () => {
    const contract = bouwT4StudentsAfnameContract({
      respondentCode: "T4S-COVER-1",
      name: "Proefblad Coverfoto",
      taal: "nl",
      responses: antwoordenblad(),
      itemTijden: null,
    });
    const rapport = bouwRapportUitContract(contract);
    expect(rapport.paginas.length).toBe(35);

    const pdf = await pdfVanRapport(rapport);
    expect(pdf.length).toBeGreaterThan(150_000);

    // Een fragment uit het midden van het beeld, ver van de kop, zodat de toets
    // niet op een gedeelde JPEG-kop kan slagen.
    const midden = Math.floor(COVERFOTO.length / 2);
    const vingerafdruk = COVERFOTO.subarray(midden, midden + 256);
    expect(pdf.includes(vingerafdruk)).toBe(true);
  }, 60_000);
});
